// ws remove — tear down a workspace with interactive confirmation

import { defineCommand } from 'citty'
import { confirm, intro, outro, isCancel } from '@clack/prompts'
import { ws } from '../bash.js'
import { resolveSlug } from './helpers.js'

export const removeCommand = defineCommand({
  meta: {
    name: 'remove',
    description: 'Tear down a workspace (worktrees, routing, test DB)',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
      required: false,
    },
    force: {
      type: 'boolean',
      alias: 'f',
      description: 'Skip confirmation prompt',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON',
    },
  },
  run: async ({ args, rawArgs }) => {
    const slug = await resolveSlug(args.slug as string | undefined)
    if (!slug) process.exit(1)

    if (!args.force) {
      intro(`Tear down ${slug}`)

      const ok = await confirm({
        message: `Remove worktrees, routing, and test DB for ${slug}?`,
      })

      if (isCancel(ok) || !ok) {
        outro('Cancelled.')
        process.exit(0)
      }
    }

    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    if (!forwardedArgs.includes(slug)) forwardedArgs.push(slug)
    const result = ws('remove', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})
