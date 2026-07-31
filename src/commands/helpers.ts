// Shared helpers for interactive commands

import { outro, log } from '@clack/prompts'
import search, { Separator } from '@inquirer/search'
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

/**
 * Auto-detect workspace slug from CWD, or use type-ahead search to pick one.
 * Numbers and existing slugs pass through — bash handles index lookup.
 */
export async function resolveSlug(argSlug: string | undefined): Promise<string | null> {
  if (argSlug !== undefined) return argSlug

  const config = loadConfig()
  const cwd = process.cwd()

  if (cwd.startsWith(config.workspacesRoot)) {
    const slug = cwd.slice(config.workspacesRoot.length + 1).split('/')[0]
    if (slug) return slug
  }

  if (!existsSync(config.workspacesRoot)) {
    log.error('No workspaces found and not inside one.')
    return null
  }

  const all = gatherWorkspaces()
  if (all.length === 0) { log.error('No workspaces found.'); return null }

  // Type-ahead search: type to fuzzy-filter, arrow keys to select
  const selected = await search<string>({
    message: 'Type to search, ↑↓ to pick, enter to open:',
    source: (term) => {
      const items = term
        ? all.filter(w => w.slug.toLowerCase().includes(term.toLowerCase()))
        : all
      if (items.length === 0) return []

      const options: Array<{ value: string; name: string; description: string } | Separator> = []

      const served = items.filter(w => w.served)
      if (served.length > 0) {
        options.push(new Separator(`─── Served (${served.length}) ───`))
        for (const w of served) {
          options.push({
            value: w.slug,
            name: w.slug,
            description: `${relativeTime(w.lastCommit)}`,
          })
        }
      }

      const unserved = items.filter(w => !w.served)
      if (unserved.length > 0) {
        options.push(new Separator(`─── Not served (${unserved.length}) ───`))
        for (const w of unserved) {
          options.push({
            value: w.slug,
            name: w.slug,
            description: 'not served',
          })
        }
      }

      return options
    },
    pageSize: 12,
  })

  console.log('') // blank line after search prompt
  if (selected === undefined) {
    outro('Cancelled.')
    return null
  }
  return selected
}
