// ws doctor — interactive workspace diagnostic
// Walks through common failure modes and suggests fixes.

import { defineCommand } from 'citty'
import { intro, outro, confirm, log, spinner, note, isCancel } from '@clack/prompts'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadConfig } from '../config.js'

interface Check {
  label: string
  pass: boolean
  detail: string
}

// The main repo's env is the source of truth: every base-domain URL must be
// rewritten to the workspace host with its scheme intact (app-admin's
// BASE_URL is http:// on purpose — it is the registered OAuth redirect URI),
// and ECHO_HOST_URL must stay on the base domain. Asserting "no http://
// anywhere" inverted that invariant and reported healthy workspaces as broken.
function checkEnvUrls(envPath: string, mainEnvPath: string, baseDomain: string, host: string): Check {
  const label = envPath.split('/').slice(-2).join('/')
  if (!existsSync(envPath)) {
    return { label, pass: false, detail: 'file not found' }
  }
  const escaped = baseDomain.replace(/\./g, '\\.')
  const hasBaseUrl = new RegExp(`https?://${escaped}`)
  const rewriteRe = new RegExp(`(https?)://${escaped}`, 'g')
  const parse = (path: string) => {
    const vars = new Map<string, string>()
    for (const line of readFileSync(path, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
      if (m) vars.set(m[1], m[2])
    }
    return vars
  }

  const ws = parse(envPath)
  const main = existsSync(mainEnvPath) ? parse(mainEnvPath) : new Map<string, string>()
  const problems: string[] = []
  let checked = 0

  for (const [key, mainValue] of main) {
    if (!hasBaseUrl.test(mainValue)) continue
    const actual = ws.get(key)
    if (actual === undefined) continue
    const expected = key === 'ECHO_HOST_URL'
      ? mainValue
      : mainValue.replace(rewriteRe, (_m, scheme: string) => `${scheme}://${host}`)
    checked++
    if (actual !== expected) problems.push(`${key}: expected ${expected}, got ${actual}`)
  }

  // Base-domain URLs the template diff can't cover (key missing from main env).
  for (const [key, value] of ws) {
    if (key === 'ECHO_HOST_URL' || main.has(key)) continue
    if (hasBaseUrl.test(value)) problems.push(`${key}: still points at ${baseDomain}, not ${host}`)
  }

  if (problems.length > 0) {
    return { label, pass: false, detail: problems.join('; ') }
  }
  return { label, pass: true, detail: `${checked} URL(s) match the main env, host ${host}` }
}

export const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Diagnose workspace issues interactively',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
      required: false,
    },
    fix: {
      type: 'boolean',
      description: 'Automatically fix detected issues where possible',
    },
  },
  run: async ({ args }) => {
    const config = loadConfig()

    // Resolve slug from CWD or argument
    const cwd = process.cwd()
    let slug = args.slug as string | undefined
    if (!slug && cwd.startsWith(config.workspacesRoot)) {
      slug = cwd.slice(config.workspacesRoot.length + 1).split('/')[0]
    }
    if (!slug) {
      log.error('Not inside a workspace and no slug provided.')
      log.info('Run from a workspace directory or: ws doctor <slug>')
      process.exit(1)
    }

    const sessionDir = join(config.workspacesRoot, slug)
    const wtFrontend = join(sessionDir, config.frontendDirName)
    const wtBackend = join(sessionDir, config.backendDirName)

    intro(`ws doctor — ${slug}`)

    const spin = spinner()
    spin.start('Checking workspace health')

    const checks: Check[] = []

    // 1. Worktree existence
    checks.push({
      label: 'Frontend worktree',
      pass: existsSync(wtFrontend),
      detail: existsSync(wtFrontend) ? wtFrontend : 'directory missing',
    })
    checks.push({
      label: 'Backend worktree',
      pass: existsSync(wtBackend),
      detail: existsSync(wtBackend) ? wtBackend : 'directory missing',
    })

    // 2. .code-workspace file
    const wsFile = join(sessionDir, `${slug}.code-workspace`)
    checks.push({
      label: 'Workspace file',
      pass: existsSync(wsFile),
      detail: existsSync(wsFile) ? wsFile : 'missing — IDE won\'t open correctly',
    })

    // 3. Env file URL checks
    // Mirrors bash resolve_subdomain: the part BEFORE the first underscore
    // (the task id for task workspaces), lowercased, non-DNS collapsed to '-'.
    const sub = slug.split('_')[0].toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '')
    const host = `${sub}.${config.baseDomain}`

    for (const app of config.defaultApps) {
      const appEntry = config.apps.find(a => a.key === app)
      if (!appEntry) continue
      const envPath = join(wtFrontend, appEntry.dir, '.env')
      if (existsSync(envPath)) {
        checks.push(checkEnvUrls(envPath, join(config.frontendRepo, appEntry.dir, '.env'), config.baseDomain, host))
      } else {
        checks.push({
          label: `${appEntry.dir}/.env`,
          pass: false,
          detail: 'not served yet — run ws serve',
        })
      }
    }

    // Backend env
    const backendEnv = join(wtBackend, '.env')
    if (existsSync(backendEnv)) {
      checks.push(checkEnvUrls(backendEnv, join(config.backendRepo, '.env'), config.baseDomain, host))
    }

    // 4. Cognitor key
    const cogRel = 'cognitor.key'
    const cogPath = join(wtBackend, 'storage', cogRel)
    checks.push({
      label: 'Cognitor JWT key',
      pass: existsSync(cogPath),
      detail: existsSync(cogPath) ? cogPath : 'missing — auth will 500',
    })

    // 5. Vendor directory
    checks.push({
      label: 'Backend vendor',
      pass: existsSync(join(wtBackend, 'vendor')),
      detail: existsSync(join(wtBackend, 'vendor')) ? 'present' : 'missing — run ws serve',
    })

    spin.stop('Done')

    // Display results
    const passed = checks.filter(c => c.pass)
    const failed = checks.filter(c => !c.pass)

    for (const c of passed) {
      log.success(`${c.label}: ${c.detail}`)
    }
    for (const c of failed) {
      log.error(`${c.label}: ${c.detail}`)
    }

    if (failed.length === 0) {
      note('All checks passed — workspace looks healthy.', '✓ Clean bill of health')
      outro(`https://${host}${config.adminPath}`)
      process.exit(0)
    }

    note(
      `${failed.length} issue(s) found. Run 'ws serve ${slug}' to recreate env files,\n` +
      `or 'ws serve ${slug} --force' to regenerate everything.`,
      `${failed.length} issue(s) found`,
    )

    const shouldFix = args.fix || await confirm({
      message: 'Run ws serve --force to fix env files?',
    })

    if (isCancel(shouldFix) || !shouldFix) {
      outro('Run ws serve to fix manually.')
      process.exit(1)
    }

    // Fix: re-serve
    const { spawnSync } = await import('node:child_process')
    log.info('Running ws serve --force…')
    const result = spawnSync('workspaces', ['serve', slug, '--force'], {
      stdio: 'inherit',
      env: { ...process.env },
    })

    if (result.status === 0) {
      outro('Fixed. Run ws doctor again to verify.')
      process.exit(0)
    } else {
      log.error('ws serve failed — check the output above.')
      process.exit(1)
    }
  },
})
