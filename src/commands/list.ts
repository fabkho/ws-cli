// ws list — list all workspaces with color-coded output

import { defineCommand } from 'citty'
import { loadConfig } from '../config.js'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

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

// ---- data gathering ----

function workspaceColor(sessionDir: string, slug: string): string {
  const wsFile = join(sessionDir, `${slug}.code-workspace`)
  if (!existsSync(wsFile)) return ''
  try {
    const content = readFileSync(wsFile, 'utf-8')
    const match = content.match(/"titleBar\.activeBackground"\s*:\s*"(#[0-9a-fA-F]{6})"/)
    return match?.[1] ?? ''
  } catch { return '' }
}

function worktreeBranch(worktree: string): string {
  if (!existsSync(join(worktree, '.git'))) return '—'
  try {
    return execSync('git symbolic-ref --quiet --short HEAD', {
      cwd: worktree, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
    }).trim() || 'detached'
  } catch { return '—' }
}

function slugToSubdomain(slug: string): string {
  const prefix = slug.includes('_') ? slug.split('_')[0] : slug
  return prefix.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
}

function gatherWorkspaces(): WorkspaceInfo[] {
  const config = loadConfig()
  const root = config.workspacesRoot
  if (!existsSync(root)) return []

  return readdirSync(root, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => {
      const slug = e.name
      const dir = join(root, slug)
      const feDir = join(dir, config.frontendDirName)
      const beDir = join(dir, config.backendDirName)
      const feOk = existsSync(feDir)
      const beOk = existsSync(beDir)
      const sub = slugToSubdomain(slug)
      return {
        slug,
        color: workspaceColor(dir, slug),
        frontendExists: feOk,
        backendExists: beOk,
        feBranch: feOk ? worktreeBranch(feDir) : '—',
        beBranch: beOk ? worktreeBranch(beDir) : '—',
        subdomain: sub,
        adminUrl: feOk ? `https://${sub}.${config.baseDomain}${config.adminPath}` : '',
      }
    })
}

// ---- rendering ----

function hexToRgb(hex: string): [number, number, number] {
  const s = hex.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

function rgb(r: number, g: number, b: number): string {
  return `\x1b[38;2;${r};${g};${b}m`
}

const RESET = '\x1b[0m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'

function slug(s: string, color: string): string {
  if (!color) return s
  const [r, g, b] = hexToRgb(color)
  return `${BOLD}${rgb(r, g, b)}${s}${RESET}`
}

function dot(color: string): string {
  if (!color) return `${DIM}●${RESET}`
  const [r, g, b] = hexToRgb(color)
  return `${rgb(r, g, b)}●${RESET}`
}

function branch(label: string, name: string): string {
  return `${DIM}${label}:${RESET} ${name}`
}

function link(url: string, label: string): string {
  return `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`
}

// ---- command ----

export const listCommand = defineCommand({
  meta: { name: 'list', description: 'List all workspaces' },
  args: {
    json: { type: 'boolean', description: 'Output JSON with workspace details' },
    all: { type: 'boolean', alias: 'a', description: 'Show git branches and full details' },
  },
  run: async ({ args }) => {
    const workspaces = gatherWorkspaces()

    if (args.json) {
      console.log(JSON.stringify({ workspaces, count: workspaces.length }, null, 2))
      process.exit(0)
    }

    if (workspaces.length === 0) {
      console.log('  No workspaces found.')
      process.exit(0)
    }

    const showBranches = !!args.all
    const tty = process.stdout.isTTY

    // Header
    console.log('')
    console.log(`  ${DIM}#${RESET}  ${DIM}workspace${RESET}`)

    for (const [i, w] of workspaces.entries()) {
      const num = String(i).padStart(2)
      const name = w.frontendExists ? slug(w.slug, w.color) : `${DIM}${w.slug}${RESET}`
      const url = w.adminUrl
        ? tty ? link(w.adminUrl, w.subdomain) : w.adminUrl
        : '—'

      let line = ` ${num}  ${dot(w.color)}  ${name}  ${DIM}${url}${RESET}`
      if (showBranches) {
        line += `    ${branch('fe', w.feBranch)}  ${branch('be', w.beBranch)}`
      }
      console.log(line)
    }

    if (tty) process.stdout.write('\x1b]8;;\x1b\\')  // close any open OSC 8
    console.log('')
    console.log(`  ${DIM}${workspaces.length} workspace(s)${RESET}`)
    console.log('')
  },
})
