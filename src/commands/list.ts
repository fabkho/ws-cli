// ws list — list all workspaces

import { defineCommand } from 'citty'
import { wsCapture } from '../bash.js'
import { loadConfig } from '../config.js'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const listCommand = defineCommand({
  meta: {
    name: 'list',
    description: 'List all workspaces',
  },
  args: {
    json: {
      type: 'boolean',
      description: 'Output JSON with workspace details',
    },
  },
  run: async ({ args }) => {
    if (args.json) {
      // JSON output — read workspaces directly (fast, no bash needed)
      const config = loadConfig()
      const root = config.workspacesRoot
      const entries: Array<{
        slug: string
        frontendExists: boolean
        backendExists: boolean
      }> = []

      if (existsSync(root)) {
        for (const entry of readdirSync(root, { withFileTypes: true })) {
          if (!entry.isDirectory()) continue
          const slug = entry.name
          const sessionDir = join(root, slug)
          entries.push({
            slug,
            frontendExists: existsSync(join(sessionDir, config.frontendDirName)),
            backendExists: existsSync(join(sessionDir, config.backendDirName)),
          })
        }
      }

      console.log(JSON.stringify({ workspaces: entries, count: entries.length }, null, 2))
      process.exit(0)
    }

    // Pretty output — delegate to bash
    const result = wsCapture('list')
    console.log(result.stdout)
    if (result.stderr) console.error(result.stderr)
    process.exit(result.status ?? 1)
  },
})
