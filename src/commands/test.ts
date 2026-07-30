// ws test — run backend tests against the workspace test database

import { defineCommand } from 'citty'
import { ws } from '../bash.js'

export const testCommand = defineCommand({
  meta: {
    name: 'test',
    description: 'Run backend tests against the workspace test database',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
    },
    dryRun: {
      type: 'boolean',
      description: 'Print the command without running',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON with test results',
    },
  },
  run: async ({ rawArgs }) => {
    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    const result = ws('test', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})
