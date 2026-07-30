// ws status — workspace health report

import { defineCommand } from 'citty'
import { wsCapture } from '../bash.js'

export const statusCommand = defineCommand({
  meta: {
    name: 'status',
    description: 'Health report for workspaces',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON (already supported by bash ws status --json)',
    },
    mr: {
      type: 'boolean',
      description: 'Include MR lookup',
    },
  },
  run: async ({ rawArgs }) => {
    const subIdx = rawArgs.indexOf('status') + 1
    const forwardedArgs = subIdx > 0 ? rawArgs.slice(subIdx) : []

    // ws status already supports --json natively
    const result = wsCapture('status', forwardedArgs)
    console.log(result.stdout)
    if (result.stderr) console.error(result.stderr)
    process.exit(result.status ?? 1)
  },
})
