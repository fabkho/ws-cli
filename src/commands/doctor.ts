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

function checkEnvUrls(envPath: string, baseDomain: string, host: string): Check {
  if (!existsSync(envPath)) {
    return { label: `${envPath}`, pass: false, detail: 'file not found' }
  }
  const content = readFileSync(envPath, 'utf-8')
  const httpRe = new RegExp(`http://${baseDomain.replace(/\./g, '\\.')}`, 'g')
  const httpsRe = new RegExp(`https://${baseDomain.replace(/\./g, '\\.')}`, 'g')

  // Count http:// references to base domain (should be rewritten to https)
  const httpMatches = content.match(httpRe)?.length ?? 0
  // Count https:// references to base domain that should point to workspace host
  const httpsBaseMatches = content.match(httpsRe)?.length ?? 0
  // Count correct host references
  const hostRe = new RegExp(`https://${host.replace(/\./g, '\\.')}`, 'g')
  const hostMatches = content.match(hostRe)?.length ?? 0

  if (httpMatches > 0) {
    return {
      label: envPath.split('/').slice(-2).join('/'),
      pass: false,
      detail: `${httpMatches} http:// URL(s) not rewritten to workspace host — auth will fail`,
    }
  }
  if (httpsBaseMatches > 0) {
    return {
      label: envPath.split('/').slice(-2).join('/'),
      pass: false,
      detail: `${httpsBaseMatches} https:// URL(s) pointing to main (${baseDomain}), not workspace host`,
    }
  }
  return {
    label: envPath.split('/').slice(-2).join('/'),
    pass: true,
    detail: `${hostMatches} URL(s) correctly point to ${host}`,
  }
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
    const sub = slug.replace(/^.*?_/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-')
    const host = `${sub}.${config.baseDomain}`

    for (const app of config.defaultApps) {
      const appEntry = config.apps.find(a => a.key === app)
      if (!appEntry) continue
      const envPath = join(wtFrontend, appEntry.dir, '.env')
      if (existsSync(envPath)) {
        checks.push(checkEnvUrls(envPath, config.baseDomain, host))
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
      checks.push(checkEnvUrls(backendEnv, config.baseDomain, host))
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
