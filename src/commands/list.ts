// ws list — compact card-style workspace list

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
  subdomain: string
  adminUrl: string
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

function worktreeBranch(wt: string): string {
  if (!existsSync(join(wt, '.git'))) return '—'
  try {
    return execSync('git symbolic-ref --quiet --short HEAD', {
      cwd: wt, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || 'detached'
  } catch { return '—' }
}

function subdomain(slug: string): string {
  const p = slug.includes('_') ? slug.split('_')[0] : slug
  return p.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
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
      return {
        slug: e.name,
        color: workspaceColor(d, e.name),
        served: feOk && beOk,
        feBranch: feOk ? worktreeBranch(fe) : '—',
        beBranch: beOk ? worktreeBranch(be) : '—',
        subdomain: sub,
        adminUrl: feOk ? `https://${sub}.${config.baseDomain}${config.adminPath}` : '',
      }
    })
    .sort((a, b) => {
      if (a.served !== b.served) return a.served ? -1 : 1
      return a.slug.localeCompare(b.slug)
    })
}

// ---- rendering ----

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

function slug(s: string, c: string, served: boolean): string {
  if (!served) return `${D}${s}${R}`
  if (!c) return s
  const [r, g, b] = hex(c)
  return `${B}${rgb(r, g, b)}${s}${R}`
}

function link(url: string): string {
  return `\x1b]8;;${url}\x1b\\${url}\x1b]8;;\x1b\\`
}

// ---- command ----

export const listCommand = defineCommand({
  meta: { name: 'list', description: 'List all workspaces' },
  args: {
    json: { type: 'boolean', description: 'Output JSON' },
    all: { type: 'boolean', alias: 'a', description: 'Show git branches' },
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

    const showBranch = !!args.all
    const tty = process.stdout.isTTY
    const grad = gradient(['#FF71CE', '#01CDFE'])

    console.log(`\n  ${grad('workspaces')}`)
    console.log(`  ${D}${'─'.repeat(60)}${R}`)

    for (const [i, w] of workspaces.entries()) {
      const num = D + String(i).padStart(2) + R
      const name = slug(w.slug, w.color, w.served)
      const url = w.adminUrl
        ? tty ? link(w.adminUrl) : D + w.adminUrl + R
        : `${D}(not served)${R}`

      console.log(` ${num}  ${dot(w.color)}  ${name}`)
      if (showBranch) {
        const trunc = (s: string) => s.length > 25 ? s.slice(0, 24) + '…' : s
        console.log(`      ${D}fe${R} ${trunc(w.feBranch)}  ${D}be${R} ${trunc(w.beBranch)}`)
      }
      console.log(`      ${url}`)
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')
    const served = workspaces.filter(w => w.served).length
    const filtered = args.filter ? ` (filtered from ${gather().length})` : ''
    console.log(`  ${D}${'─'.repeat(60)}${R}`)
    console.log(`  ${D}${workspaces.length} workspace(s) — ${served} served${filtered}${R}\n`)
  },
})
