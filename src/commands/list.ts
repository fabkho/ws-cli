// ws list — color-coded workspace list with column alignment

import { defineCommand } from 'citty'
import { loadConfig } from '../config.js'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

// ---- types ----

interface WorkspaceInfo {
  slug: string
  color: string
  frontendExists: boolean
  backendExists: boolean
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
        frontendExists: feOk,
        backendExists: beOk,
        feBranch: feOk ? worktreeBranch(fe) : '—',
        beBranch: beOk ? worktreeBranch(be) : '—',
        subdomain: sub,
        adminUrl: feOk ? `https://${sub}.${config.baseDomain}${config.adminPath}` : '',
      }
    })
    .sort((a, b) => {
      // Served first, then alphabetically
      const aS = a.frontendExists && a.backendExists
      const bS = b.frontendExists && b.backendExists
      if (aS !== bS) return aS ? -1 : 1
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

function colorSlug(s: string, c: string): string {
  if (!c) return s
  const [r, g, b] = hex(c)
  return `${B}${rgb(r, g, b)}${s}${R}`
}

function colorDot(c: string): string {
  if (!c) return `${D}●${R}`
  const [r, g, b] = hex(c)
  return `${rgb(r, g, b)}●${R}`
}

function link(url: string, label: string): string {
  return `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`
}

/** Visible width of a string after stripping ANSI/OSC codes */
function vw(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x1b\]8;.*?\x1b\\/g, '').length
}

function pad(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - vw(s)))
}

// ---- command ----

export const listCommand = defineCommand({
  meta: { name: 'list', description: 'List all workspaces' },
  args: {
    json: { type: 'boolean', description: 'Output JSON' },
    all: { type: 'boolean', alias: 'a', description: 'Show git branches' },
    filter: {
      type: 'positional',
      description: 'Fuzzy-filter workspaces by name',
      required: false,
    },
  },
  run: async ({ args }) => {
    let workspaces = gather()

    // Fuzzy filter
    if (args.filter) {
      const { default: Fuse } = await import('fuse.js')
      const fuse = new Fuse(workspaces, {
        keys: ['slug', 'subdomain'],
        threshold: 0.4,
      })
      workspaces = fuse.search(args.filter as string).map(r => r.item)
    }

    if (args.json) {
      console.log(JSON.stringify({ workspaces, count: workspaces.length }, null, 2))
      process.exit(0)
    }
    if (workspaces.length === 0) { console.log('  No workspaces.\n'); process.exit(0) }

    const showBranch = !!args.all
    const tty = process.stdout.isTTY

    // Compute column widths
    const slugPad = Math.max(...workspaces.map(w => vw(w.slug)), 8) + 2
    const urlPad = Math.max(...workspaces.map(w => vw(w.adminUrl || w.subdomain || '—')), 8) + 2

    // Header
    console.log('')
    console.log(`  ${D}#   workspace${' '.repeat(slugPad - 11)}url${R}`)
    console.log(`  ${D}${'─'.repeat(4 + slugPad + urlPad)}${R}`)

    for (const [i, w] of workspaces.entries()) {
      const num = String(i).padStart(2)
      const dot = colorDot(w.color)
      const name = w.frontendExists ? colorSlug(w.slug, w.color) : `${D}${w.slug}${R}`
      const url = w.adminUrl
        ? tty ? link(w.adminUrl, w.adminUrl) : w.adminUrl
        : '—'

      let line = ` ${num} ${dot}  ${pad(name, slugPad)}`
      if (showBranch) {
        line += ` ${D}fe:${R}${pad(w.feBranch, 14)} ${D}be:${R}${w.beBranch}`
      } else {
        line += `${D}${url}${R}`
      }
      console.log(line)
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')
    const served = workspaces.filter(w => w.frontendExists && w.backendExists).length
    console.log('')
    console.log(`  ${D}${workspaces.length} workspace(s) — ${served} served${R}`)
    console.log('')
  },
})
