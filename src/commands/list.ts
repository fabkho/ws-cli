// ws list — interactive workspace browser

import { defineCommand } from 'citty'
import { select, intro, outro, isCancel, note, log } from '@clack/prompts'
import gradient from 'gradient-string'
import { loadConfig } from '../config.js'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync, spawn } from 'node:child_process'

// ---- data ----

interface W {
  slug: string
  color: string
  served: boolean
  feBranch: string
  beBranch: string
  feAhead: number
  beAhead: number
  subdomain: string
  adminUrl: string
  lastCommit: Date | null
}

function workspaceColor(dir: string, slug: string): string {
  const ws = join(dir, `${slug}.code-workspace`)
  if (!existsSync(ws)) return ''
  try {
    const m = readFileSync(ws, 'utf-8').match(/"titleBar\.activeBackground"\s*:\s*"(#[0-9a-fA-F]{6})"/)
    return m?.[1] ?? ''
  } catch { return '' }
}

function git(cwd: string, cmd: string): string {
  try { return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() }
  catch { return '' }
}

function worktreeBranch(wt: string): string {
  if (!existsSync(join(wt, '.git'))) return '—'
  return git(wt, 'symbolic-ref --quiet --short HEAD') || 'detached'
}

function commitsAhead(wt: string, base = 'main'): number {
  if (!existsSync(join(wt, '.git'))) return 0
  const ref = git(wt, `rev-parse --verify --quiet "refs/remotes/origin/${base}"`)
  const baseRef = ref ? `origin/${base}` : base
  return parseInt(git(wt, `rev-list --count "${baseRef}..HEAD"`), 10) || 0
}

function lastCommitDate(wt: string): Date | null {
  if (!existsSync(join(wt, '.git'))) return null
  const ts = git(wt, 'log -1 --format=%ct')
  return ts ? new Date(parseInt(ts, 10) * 1000) : null
}

function subdomain(slug: string): string {
  const p = slug.includes('_') ? slug.split('_')[0] : slug
  return p.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
}

function relativeTime(d: Date | null): string {
  if (!d) return '—'
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function gather(): W[] {
  const config = loadConfig()
  const root = config.workspacesRoot
  if (!existsSync(root)) return []

  return readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => {
      const d = join(root, e.name)
      const fe = join(d, config.frontendDirName)
      const be = join(d, config.backendDirName)
      const feOk = existsSync(fe)
      const beOk = existsSync(be)
      const sub = subdomain(e.name)
      const lc = lastCommitDate(feOk ? fe : beOk ? be : '')
      return {
        slug: e.name,
        color: workspaceColor(d, e.name),
        served: feOk && beOk,
        feBranch: feOk ? worktreeBranch(fe) : '—',
        beBranch: beOk ? worktreeBranch(be) : '—',
        feAhead: feOk ? commitsAhead(fe, config.frontendBaseBranch) : 0,
        beAhead: beOk ? commitsAhead(be, config.backendBaseBranch) : 0,
        subdomain: sub,
        adminUrl: `https://${sub}.${config.baseDomain}${config.adminPath}`,
        lastCommit: lc,
      }
    })
    .sort((a, b) => {
      if (a.served !== b.served) return a.served ? -1 : 1
      if (!a.lastCommit && !b.lastCommit) return 0
      if (!a.lastCommit) return 1
      if (!b.lastCommit) return -1
      return b.lastCommit.getTime() - a.lastCommit.getTime()
    })
}

// ---- command ----

export const listCommand = defineCommand({
  meta: { name: 'list', description: 'Browse workspaces interactively' },
  args: {
    json: { type: 'boolean', description: 'Output JSON (non-interactive)' },
    filter: { type: 'positional', description: 'Fuzzy-filter by name', required: false },
  },
  run: async ({ args }) => {
    let workspaces = gather()

    if (args.filter) {
      const { default: Fuse } = await import('fuse.js')
      const fuse = new Fuse(workspaces, { keys: ['slug', 'subdomain'], threshold: 0.4 })
      workspaces = fuse.search(args.filter as string).map(r => r.item)
    }

    // JSON mode — non-interactive
    if (args.json) {
      console.log(JSON.stringify({ workspaces, count: workspaces.length }, null, 2))
      process.exit(0)
    }

    if (workspaces.length === 0) {
      console.log(`\n  No workspaces found.\n`)
      process.exit(0)
    }

    const config = loadConfig()
    while (true) {
      const grad = gradient(['#FF71CE', '#01CDFE'])
      intro(`${grad('workspaces')}  ${workspaces.length} total`)

      // Build options with hints
      const options = workspaces.map(w => {
        const time = relativeTime(w.lastCommit)
        const ahead = w.feAhead > 0 || w.beAhead > 0 ? ` +${w.feAhead}/+${w.beAhead}` : ''
        return {
          value: w.slug,
          label: `${w.served ? '●' : '○'} ${w.slug}`,
          hint: `${time}${ahead}`,
        }
      })

      const selected = await select({
        message: 'Browse workspaces (↑↓ to move, enter to inspect):',
        options,
      })

      if (isCancel(selected)) {
        outro('Done.')
        process.exit(0)
      }

      const w = workspaces.find(x => x.slug === selected)
      if (!w) continue

      // Detail panel
      const ahead = w.feAhead > 0 || w.beAhead > 0
        ? `fe +${w.feAhead}  be +${w.beAhead}`
        : 'no unmerged commits'

      note(
        `status:    ${w.served ? 'served' : 'not served'}\n` +
        `fe branch: ${w.feBranch}\n` +
        `be branch: ${w.beBranch}\n` +
        `ahead:     ${ahead}\n` +
        `activity:  ${relativeTime(w.lastCommit)}\n` +
        `url:       ${w.adminUrl}`,
        w.slug,
      )

      // Action menu
      const action = await select({
        message: 'What would you like to do?',
        options: [
          { value: 'open', label: 'Open in IDE', hint: `zed + ${config.backendIde}` },
          { value: 'serve', label: 'Serve / re-serve', hint: 'ws serve --force' },
          { value: 'doctor', label: 'Run doctor', hint: 'diagnose issues' },
          { value: 'back', label: 'Back to list' },
          { value: 'quit', label: 'Quit' },
        ],
      })

      if (isCancel(action) || action === 'quit') {
        outro('Done.')
        process.exit(0)
      }

      if (action === 'back') continue

      if (action === 'open') {
        const fePath = join(config.workspacesRoot, w.slug, config.frontendDirName)
        const bePath = join(config.workspacesRoot, w.slug, config.backendDirName)
        const side = await select({
          message: 'Which side?',
          options: [
            { value: 'both', label: `Both (${config.frontendIde} + ${config.backendIde})` },
            { value: 'frontend', label: `Frontend only (${config.frontendIde})` },
            { value: 'backend', label: `Backend only (${config.backendIde})` },
          ],
        })
        if (isCancel(side)) continue
        if (side === 'both' || side === 'frontend') {
          spawn(config.frontendIde, config.frontendIde === 'zed' ? ['-n', fePath] : [fePath], { stdio: 'ignore', detached: true }).unref()
        }
        if (side === 'both' || side === 'backend') {
          spawn(config.backendIde, config.backendIde === 'zed' ? ['-n', bePath] : [bePath], { stdio: 'ignore', detached: true }).unref()
        }
        log.success(`Opened ${w.slug}`)
        outro('Done.')
        process.exit(0)
      }

      if (action === 'serve') {
        const spin = (await import('@clack/prompts')).spinner()
        spin.start('Running ws serve --force…')
        execSync(`workspaces serve '${w.slug}' --force`, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        })
        spin.stop('Done')
        log.success(`Served: ${w.adminUrl}`)
        outro('Done.')
        process.exit(0)
      }

      if (action === 'doctor') {
        const spin = (await import('@clack/prompts')).spinner()
        spin.start('Running doctor…')
        try {
          execSync(`node ${process.argv[1]} doctor '${w.slug}' --fix`, {
            stdio: 'inherit',
            env: { ...process.env },
          })
        } catch { /* doctor exits non-zero on issues */ }
        process.exit(0)
      }
    }
  },
})
