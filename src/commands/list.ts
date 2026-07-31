// ws list — color-coded workspace list with activity info

import { defineCommand } from 'citty'
import gradient from 'gradient-string'
import { loadConfig } from '../config.js'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

// ---- types ----

interface WorkspaceInfo {
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

// ---- data ----

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

function gather(): WorkspaceInfo[] {
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

// ---- rendering ----

const R = '\x1b[0m'
const D = '\x1b[2m'
const B = '\x1b[1m'
const G = '\x1b[32m'

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

function colorSlug(s: string, c: string, served: boolean): string {
  if (!served) return `${D}${s}${R}`
  if (!c) return s
  const [r, g, b] = hex(c)
  return `${B}${rgb(r, g, b)}${s}${R}`
}

function link(url: string): string {
  return `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`
}

function aheadLabel(fe: number, be: number): string {
  if (fe === 0 && be === 0) return ''
  return `  ${G}+${fe}${R}/${G}+${be}${R}`
}

// ---- command ----

export const listCommand = defineCommand({
  meta: { name: 'list', description: 'List all workspaces' },
  args: {
    json: { type: 'boolean', description: 'Output JSON' },
    all: { type: 'boolean', alias: 'a', description: 'Show git branches and ahead/behind' },
    filter: { type: 'positional', description: 'Fuzzy-filter by name', required: false },
  },
  run: async ({ args }) => {
    let workspaces = gather()

    if (args.filter) {
      const { default: Fuse } = await import('fuse.js')
      const fuse = new Fuse(workspaces, { keys: ['slug', 'subdomain'], threshold: 0.4 })
      workspaces = fuse.search(args.filter as string).map(r => r.item)
    }

    if (args.json) {
      console.log(JSON.stringify({ workspaces, count: workspaces.length }, null, 2))
      process.exit(0)
    }
    if (workspaces.length === 0) {
      console.log(`\n  ${D}No workspaces found.${R}\n`)
      process.exit(0)
    }

    const showDetail = !!args.all
    const tty = process.stdout.isTTY
    const grad = gradient(['#FF71CE', '#01CDFE'])

    // Stats bar
    const served = workspaces.filter(w => w.served).length
    const dirty = workspaces.filter(w => w.feAhead > 0 || w.beAhead > 0).length
    const recent = workspaces.filter(w => w.lastCommit && (Date.now() - w.lastCommit.getTime()) < 86400000).length

    console.log(`\n  ${grad('workspaces')}`)
    console.log(`  ${D}${workspaces.length} total  ·  ${served} served  ·  ${dirty} with changes  ·  ${recent} active today${R}\n`)

    for (const w of workspaces) {
      const time = `${D}${relativeTime(w.lastCommit)}${R}`
      const name = colorSlug(w.slug, w.color, w.served)
      const ahead = showDetail ? aheadLabel(w.feAhead, w.beAhead) : ''
      const url = w.served
        ? tty ? link(w.adminUrl) : w.adminUrl
        : '(not served)'

      console.log(`  ${dot(w.color)} ${name}`)
      if (showDetail) {
        console.log(`  ${D}fe${R} ${w.feBranch}${ahead}  ${D}be${R} ${w.beBranch}`)
      }
      console.log(`  ${time}  ·  ${D}${url}${R}`)
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')
    const filtered = args.filter ? ` (filtered from ${gather().length})` : ''
    console.log(`\n  ${D}${workspaces.length} workspace(s) — ${served} served${filtered}${R}\n`)
    process.exit(0)
  },
})
