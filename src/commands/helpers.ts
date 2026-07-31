// Shared helpers for interactive commands

import { text, select, intro, outro, isCancel, log } from '@clack/prompts'
import { existsSync, readdirSync } from 'node:fs'
import { loadConfig } from '../config.js'

/**
 * Auto-detect workspace slug from CWD, prompt with fuzzy search, or pass through.
 * Numbers and existing slugs pass through — bash handles index lookup.
 * Returns null if cancelled or no workspaces exist.
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

  const slugs: string[] = []
  for (const entry of readdirSync(config.workspacesRoot, { withFileTypes: true })) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) slugs.push(entry.name)
  }
  if (slugs.length === 0) { log.error('No workspaces found.'); return null }

  // Fuzzy search: type to filter, then pick from results
  intro('Select a workspace')

  const query = await text({
    message: 'Search workspaces (type to filter):',
    placeholder: 'e.g. booking, dnd, CU-86…',
  })

  if (isCancel(query)) { outro('Cancelled.'); return null }

  let options = slugs.map(s => ({ value: s, label: s }))

  if (query && query.trim()) {
    const { default: Fuse } = await import('fuse.js')
    const fuse = new Fuse(slugs, { threshold: 0.4 })
    const results = fuse.search(query.trim())
    if (results.length === 0) {
      log.warn(`No workspace matches "${query}"`)
      return null
    }
    options = results.map(r => ({ value: r.item, label: r.item }))
  }

  if (options.length === 1) return options[0].value

  const selected = await select({
    message: `Pick a workspace (${options.length} match${options.length > 1 ? 'es' : ''}):`,
    options,
  })

  if (isCancel(selected)) { outro('Cancelled.'); return null }
  return selected as string
}
