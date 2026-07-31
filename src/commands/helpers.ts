// Shared helpers for interactive commands

import { select, intro, outro, isCancel, log } from '@clack/prompts'
import { existsSync, readdirSync } from 'node:fs'
import { loadConfig } from '../config.js'

/**
 * Auto-detect workspace slug from CWD or prompt the user to pick one.
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
    if (entry.isDirectory()) slugs.push(entry.name)
  }
  if (slugs.length === 0) {
    log.error('No workspaces found.')
    return null
  }

  intro('Select a workspace')
  const selected = await select({
    message: 'Pick a workspace:',
    options: slugs.map(s => ({ value: s, label: s })),
  })

  if (isCancel(selected)) {
    outro('Cancelled.')
    return null
  }
  return selected as string
}
