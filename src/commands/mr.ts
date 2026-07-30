// ws mr — open or create GitLab merge requests

import { defineCommand } from 'citty'
import { ws } from '../bash.js'

export const mrCommand = defineCommand({
  meta: {
    name: 'mr',
    description: 'Open or create GitLab merge requests for the workspace',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
    },
    fe: {
      type: 'boolean',
      description: 'Frontend repo only',
    },
    be: {
      type: 'boolean',
      description: 'Backend repo only',
    },
    all: {
      type: 'boolean',
      description: 'Both repos (default)',
    },
    target: {
      type: 'string',
      description: 'Target branch for the MR',
      valueHint: 'branch',
    },
    dryRun: {
      type: 'boolean',
      description: 'Print what would happen without pushing',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON with MR status',
    },
  },
  run: async ({ rawArgs }) => {
    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    if (!forwardedArgs.some(a => a === '--fe' || a === '--be' || a === '--all')) {
      forwardedArgs.unshift('--all')
    }
    const result = ws('mr', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})
