// Prototype commands for ws list — 5 different UI approaches.
// All share the same data gathering. Registered as ws list-1 through ws list-5.

import { defineCommand } from 'citty'
import gradient from 'gradient-string'
import { loadConfig } from '../config.js'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

// ---- shared data ----

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
  created: Date | null
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
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch { return '' }
}

function worktreeBranch(wt: string): string {
  if (!existsSync(join(wt, '.git'))) return '—'
  return git(wt, 'symbolic-ref --quiet --short HEAD') || 'detached'
}

function commitsAhead(wt: string, base = 'main'): number {
  if (!existsSync(join(wt, '.git'))) return 0
  const ref = git(wt, `rev-parse --verify --quiet "refs/remotes/origin/${base}"`)
  const baseRef = ref ? `origin/${base}` : base
  const count = git(wt, `rev-list --count "${baseRef}..HEAD"`)
  return parseInt(count, 10) || 0
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
        created: statSync(d, { throwIfNoEntry: false })?.birthtime ?? null,
      }
    })
}

// ---- rendering helpers ----

const R = '\x1b[0m'
const D = '\x1b[2m'
const B = '\x1b[1m'
function rgb(r: number, g: number, b: number) { return `\x1b[38;2;${r};${g};${b}m` }
function hex(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

function dot(c: string): string {
  if (!c) return `${D}●${R}`
  const [r, g, b] = hex(c)
  return `${rgb(r, g, b)}●${R}`
}

function nameSlug(s: string, c: string, served: boolean): string {
  if (!served) return `${D}${s}${R}`
  if (!c) return s
  const [r, g, b] = hex(c)
  return `${B}${rgb(r, g, b)}${s}${R}`
}

function link(url: string): string {
  return `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`
}

function relativeTime(d: Date | null): string {
  if (!d) return '—'
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 5) return `${weeks}w ago`
  return `${Math.floor(weeks / 4)}mo ago`
}

function activityBucket(d: Date | null): string {
  if (!d) return 'unknown'
  const now = Date.now()
  const diff = now - d.getTime()
  const hrs = diff / 3600000
  if (hrs < 24) return 'Today'
  if (hrs < 48) return 'Yesterday'
  if (hrs < 168) return 'This week'
  if (hrs < 720) return 'This month'
  return 'Older'
}

// ---- prototype commands ----

/** Compact recency-sorted list */
export const list1 = defineCommand({
  meta: { name: 'list-1', description: 'Compact + recency-sorted' },
  args: { json: { type: 'boolean' } },
  run: async () => {
    const workspaces = gather().sort((a, b) => {
      if (!a.lastCommit && !b.lastCommit) return 0
      if (!a.lastCommit) return 1
      if (!b.lastCommit) return -1
      return b.lastCommit.getTime() - a.lastCommit.getTime()
    })
    if (workspaces.length === 0) { console.log('  No workspaces.\n'); process.exit(0) }

    const tty = process.stdout.isTTY
    console.log(`\n  ${gradient(['#FF71CE', '#01CDFE'])('workspaces')}  ${D}recent first${R}\n`)

    for (const [i, w] of workspaces.entries()) {
      const num = D + String(i).padStart(2) + R
      const time = D + relativeTime(w.lastCommit).padStart(7) + R
      const name = nameSlug(w.slug, w.color, w.served)
      const diff = (w.feAhead > 0 || w.beAhead > 0)
        ? `  ${D}+${w.feAhead}/${+w.beAhead}${R}`
        : ''
      const url = w.served
        ? tty ? link(w.adminUrl) : D + w.adminUrl + R
        : `${D}(not served)${R}`

      console.log(` ${num}  ${time}  ${dot(w.color)}  ${name}${diff}`)
      console.log(`          ${url}`)
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')
    console.log(`\n  ${D}${workspaces.length} workspace(s)${R}\n`)
    process.exit(0)
  },
})

/** Activity buckets */
export const list2 = defineCommand({
  meta: { name: 'list-2', description: 'Grouped by activity buckets' },
  args: { json: { type: 'boolean' } },
  run: async () => {
    const workspaces = gather()
    if (workspaces.length === 0) { console.log('  No workspaces.\n'); process.exit(0) }

    const buckets: Record<string, W[]> = {}
    for (const w of workspaces) {
      const b = activityBucket(w.lastCommit)
      if (!buckets[b]) buckets[b] = []
      buckets[b].push(w)
    }

    const order = ['Today', 'Yesterday', 'This week', 'This month', 'Older', 'unknown']
    const tty = process.stdout.isTTY

    console.log(`\n  ${gradient(['#FF71CE', '#01CDFE'])('workspaces')}  ${D}by activity${R}\n`)

    for (const bucket of order) {
      const items = buckets[bucket]
      if (!items || items.length === 0) continue
      console.log(`  ${B}▸ ${bucket}${R}  ${D}(${items.length})${R}`)
      for (const w of items) {
        const time = D + relativeTime(w.lastCommit).padStart(7) + R
        const name = nameSlug(w.slug, w.color, w.served)
        const url = w.served
          ? tty ? link(w.adminUrl) : D + w.adminUrl + R
          : `${D}(not served)${R}`
        console.log(`     ${time}  ${dot(w.color)}  ${name}`)
        console.log(`            ${url}`)
      }
      console.log('')
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')
    console.log(`  ${D}${workspaces.length} workspace(s)${R}\n`)
    process.exit(0)
  },
})

/** Interactive picker (list + open merge) */
export const list3 = defineCommand({
  meta: { name: 'list-3', description: 'Interactive picker with details' },
  run: async () => {
    const { select, intro, outro, isCancel, note } = await import('@clack/prompts')

    const workspaces = gather()
    if (workspaces.length === 0) { console.log('  No workspaces.\n'); process.exit(0) }

    intro(`${gradient(['#FF71CE', '#01CDFE'])('workspaces')} — select to open`)

    const options = workspaces.map(w => {
      const time = relativeTime(w.lastCommit)
      const diff = w.feAhead > 0 || w.beAhead > 0 ? ` +${w.feAhead}/+${w.beAhead}` : ''
      return {
        value: w.slug,
        label: `${w.served ? '●' : '○'} ${w.slug}`,
        hint: `${time}${diff}`,
      }
    })

    const selected = await select({
      message: `Pick a workspace (${workspaces.length} total):`,
      options,
    })

    if (isCancel(selected)) { outro('Cancelled.'); process.exit(0) }

    const w = workspaces.find(x => x.slug === selected)!
    note(
      `slug:      ${w.slug}\n` +
      `status:    ${w.served ? 'served' : 'not served'}\n` +
      `fe branch: ${w.feBranch}  (+${w.feAhead})\n` +
      `be branch: ${w.beBranch}  (+${w.beAhead})\n` +
      `activity:  ${relativeTime(w.lastCommit)}\n` +
      `url:       ${w.adminUrl}`,
      w.slug,
    )

    const { spawn } = await import('node:child_process')
    const { confirm: confirmFn } = await import('@clack/prompts')
    const open = await confirmFn({ message: 'Open in IDE?' })
    if (!isCancel(open) && open) {
      const config = loadConfig()
      const fePath = join(config.workspacesRoot, w.slug, config.frontendDirName)
      const bePath = join(config.workspacesRoot, w.slug, config.backendDirName)
      spawn('zed', ['-n', fePath], { stdio: 'ignore', detached: true }).unref()
      if (config.frontendIde !== config.backendIde) {
        spawn(config.backendIde, [bePath], { stdio: 'ignore', detached: true }).unref()
      }
      outro(`Opened ${w.slug}`)
    } else {
      outro('Done.')
    }
    process.exit(0)
  },
})

/** Dashboard with stats + branch diffs */
export const list4 = defineCommand({
  meta: { name: 'list-4', description: 'Dashboard with stats + branch diffs' },
  args: { json: { type: 'boolean' } },
  run: async () => {
    const workspaces = gather()
    if (workspaces.length === 0) { console.log('  No workspaces.\n'); process.exit(0) }

    const served = workspaces.filter(w => w.served)
    const dirty = workspaces.filter(w => w.feAhead > 0 || w.beAhead > 0)
    const recent = workspaces.filter(w => {
      if (!w.lastCommit) return false
      return (Date.now() - w.lastCommit.getTime()) < 86400000 // 24h
    })

    const tty = process.stdout.isTTY
    console.log(`\n  ${gradient(['#FF71CE', '#01CDFE'])('workspaces')}\n`)

    // Stats bar
    console.log(`  ${B}${workspaces.length}${R} total  ·  ${B}${served.length}${R} served  ·  ${B}${dirty.length}${R} with changes  ·  ${B}${recent.length}${R} active today\n`)

    // Detailed list
    for (const [i, w] of workspaces.entries()) {
      const num = D + String(i).padStart(2) + R
      const time = D + relativeTime(w.lastCommit).padStart(7) + R
      const name = nameSlug(w.slug, w.color, w.served)
      const feDiff = w.feAhead > 0 ? ` ${rgb(0, 200, 0)}+${w.feAhead}${R}` : ''
      const beDiff = w.beAhead > 0 ? ` ${rgb(0, 200, 0)}+${w.beAhead}${R}` : ''
      const url = w.served
        ? tty ? link(w.adminUrl) : D + w.adminUrl + R
        : `${D}—${R}`

      console.log(` ${num}  ${time}  ${dot(w.color)}  ${name}`)
      console.log(`       ${D}fe${R} ${w.feBranch}${feDiff}  ${D}be${R} ${w.beBranch}${beDiff}`)
      console.log(`       ${url}`)
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')
    console.log('')
    process.exit(0)
  },
})

/** Minimal grid — dots + slugs only */
export const list5 = defineCommand({
  meta: { name: 'list-5', description: 'Minimal grid — dots + slugs' },
  args: { json: { type: 'boolean' } },
  run: async () => {
    const workspaces = gather().sort((a, b) => a.slug.localeCompare(b.slug))
    if (workspaces.length === 0) { console.log('  No workspaces.\n'); process.exit(0) }

    console.log(`\n  ${gradient(['#FF71CE', '#01CDFE'])('workspaces')}  ${D}${workspaces.length} total${R}\n`)

    // Simple grid: 2 columns of dot + slug
    const cols = 2
    const colWidth = 40
    for (let i = 0; i < workspaces.length; i += cols) {
      let line = '  '
      for (let j = 0; j < cols && i + j < workspaces.length; j++) {
        const w = workspaces[i + j]
        const entry = `${dot(w.color)} ${nameSlug(w.slug, w.color, w.served)}`
        // Pad to column width (accounting for ANSI codes)
        const clean = entry.replace(/\x1b\[[0-9;]*m/g, '')
        line += entry + ' '.repeat(Math.max(2, colWidth - clean.length))
      }
      console.log(line)
    }

    console.log('')
    process.exit(0)
  },
})
