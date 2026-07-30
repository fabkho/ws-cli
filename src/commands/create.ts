// ws create — create a new workspace (interactive if no name given)

import { defineCommand } from 'citty'
import { text, intro, outro, isCancel } from '@clack/prompts'
import { ws } from '../bash.js'

export const createCommand = defineCommand({
  meta: {
    name: 'create',
    description: 'Create a new per-task git-worktree workspace',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Workspace name (e.g. CU-1234_my-feature or my-feature)',
      required: false,
    },
    base: {
      type: 'positional',
      description: 'Base branch to cut from (optional)',
      required: false,
    },
    neanderthal: {
      type: 'boolean',
      alias: 'n',
      description: 'Skip auto-started serve/dev-server terminals',
    },
    terminals: {
      type: 'boolean',
      description: 'Open terminals after create (default: false for warp, true for terminal)',
    },
    terminalsSide: {
      type: 'string',
      description: 'Only open terminals for: frontend | backend',
      valueHint: 'side',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON with workspace details',
    },
    dryRun: {
      type: 'boolean',
      description: 'Print actions without executing',
    },
  },
  run: async ({ args }) => {
    let name = (args.name as string) || ''

    if (!name) {
      intro('Create a new workspace')

      name = (await text({
        message: 'Workspace name (CU-1234_my-feature or my-feature):',
        placeholder: 'CU-1234_my-feature',
        validate: (v) => {
          if (!v?.trim()) return 'Name is required'
        },
      })) as string

      if (isCancel(name)) {
        outro('Cancelled.')
        process.exit(0)
      }
    }

    const bashArgs: string[] = [name]
    if (args.base) bashArgs.push(args.base as string)
    if (args.neanderthal) bashArgs.push('--neanderthal')
    if (args.dryRun) bashArgs.push('--dry-run')

    // Terminal control via env vars
    const env: Record<string, string> = {}
    if (args.terminals !== undefined) {
      env.TERMINAL_ENABLED = args.terminals ? 'true' : 'false'
    }
    if (args.terminalsSide) {
      env.TERMINAL_SIDE = args.terminalsSide as string
    }

    const result = ws('create', bashArgs, {
      capture: args.json as boolean,
      env: Object.keys(env).length > 0 ? env : undefined,
    })

    if (args.json) {
      console.log(JSON.stringify({
        success: result.success,
        slug: name,
        status: result.status,
      }))
    }

    process.exit(result.status ?? 1)
  },
})
