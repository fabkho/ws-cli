// ws open — open a workspace in the configured IDE(s)

import { defineCommand } from 'citty'
import { ws } from '../bash.js'

export const openCommand = defineCommand({
  meta: {
    name: 'open',
    description: 'Open a workspace in the configured IDE(s)',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug or index number (auto-detected from CWD if omitted)',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON',
    },
  },
  run: async ({ rawArgs }) => {
    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    const result = ws('open', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})
