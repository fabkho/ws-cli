// Shared helpers for interactive commands

import { select, outro, log } from '@clack/prompts'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { execSync } from 'node:child_process'
import { loadConfig } from '../config.js'

interface W {
  slug: string
  served: boolean
  lastCommit: Date | null
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

function git(cwd: string, cmd: string): string {
  try { return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim() }
  catch { return '' }
}

function lastCommitDate(wt: string): Date | null {
  if (!existsSync(join(wt, '.git'))) return null
  const ts = git(wt, 'log -1 --format=%ct')
  return ts ? new Date(parseInt(ts, 10) * 1000) : null
}

function gatherWorkspaces(): W[] {
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
      const lc = lastCommitDate(feOk ? fe : beOk ? be : '')
      return { slug: e.name, served: feOk && beOk, lastCommit: lc }
    })
    .sort((a, b) => {
      if (a.served !== b.served) return a.served ? -1 : 1
      if (!a.lastCommit && !b.lastCommit) return 0
      if (!a.lastCommit) return 1
      if (!b.lastCommit) return -1
      return b.lastCommit.getTime() - a.lastCommit.getTime()
    })
}

function fuzzyFilter(query: string, items: W[]): W[] {
  const q = query.toLowerCase()
  return items.filter(w => w.slug.toLowerCase().includes(q))
}

/**
 * Resolve a workspace slug:
 * - Explicit slug → pass through (bash handles index numbers too)
 * - CWD inside a workspace → auto-detect
 * - Search query → fuzzy filter, then:
 *   0 matches → error
 *   1 match  → return it directly
 *   2+ matches → clack select() to pick
 * - No arg at all → clack select() with all workspaces
 */
export async function resolveSlug(argSlug: string | undefined): Promise<string | null> {
  // Explicit slug — pass through (bash handles numbers, exact slugs)
  if (argSlug !== undefined) {
    // Check if it's a direct match (exact slug or index number)
    const config = loadConfig()
    if (/^\d+$/.test(argSlug) || existsSync(join(config.workspacesRoot, argSlug))) {
      return argSlug
    }
    // Fuzzy search — treat as query
    const matches = fuzzyFilter(argSlug, gatherWorkspaces())
    if (matches.length === 0) {
      log.error(`No workspace matches "${argSlug}"`)
      return null
    }
    if (matches.length === 1) return matches[0].slug

    // Multiple matches — let user pick
    const chosen = await select({
      message: `${matches.length} workspaces match "${argSlug}":`,
      options: matches.map(w => ({
        value: w.slug,
        label: w.served ? w.slug : `${w.slug} (not served)`,
        hint: relativeTime(w.lastCommit),
      })),
    })
    if (!chosen) { outro('Cancelled.'); return null }
    return chosen as string
  }

  // No arg — auto-detect from CWD or show full picker
  const config = loadConfig()
  const cwd = process.cwd()

  if (cwd.startsWith(config.workspacesRoot)) {
    const slug = cwd.slice(config.workspacesRoot.length + 1).split('/')[0]
    if (slug) return slug
  }

  const all = gatherWorkspaces()
  if (all.length === 0) { log.error('No workspaces found.'); return null }

  const chosen = await select({
    message: 'Pick a workspace:',
    options: all.map(w => ({
      value: w.slug,
      label: w.served ? w.slug : `${w.slug} (not served)`,
      hint: relativeTime(w.lastCommit),
    })),
  })

  if (!chosen) { outro('Cancelled.'); return null }
  return chosen as string
}
