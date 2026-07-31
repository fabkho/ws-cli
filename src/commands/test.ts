// ws test — run backend tests against the workspace test database

import { defineCommand } from 'citty'
import { ws } from '../bash.js'
import { resolveSlug } from './helpers.js'

export const testCommand = defineCommand({
  meta: {
    name: 'test',
    description: 'Run backend tests against the workspace test database',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
      required: false,
    },
    dryRun: { type: 'boolean', description: 'Print the command without running' },
    json: { type: 'boolean', description: 'Output JSON with test results' },
  },
  run: async ({ args, rawArgs }) => {
    const slug = await resolveSlug(args.slug as string | undefined)
    if (!slug) process.exit(1)

    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    if (!forwardedArgs.includes(slug)) forwardedArgs.push(slug)
    const result = ws('test', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})
