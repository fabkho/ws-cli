// ws sync — sync VS Code SCM ignore lists across all workspaces
// ws trust — install sudoers rule for passwordless nginx reload

import { defineCommand } from 'citty'
import { ws } from '../bash.js'

function passthrough(name: string, description: string) {
  return defineCommand({
    meta: { name, description },
    args: {
      json: { type: 'boolean', description: 'Output JSON' },
    },
    run: async ({ rawArgs }) => {
      const forwardedArgs = rawArgs.filter(a => a !== '--json')
      const result = ws(name, forwardedArgs)
      process.exit(result.status ?? 1)
    },
  })
}

export const syncCommand = passthrough('sync', 'Sync VS Code SCM ignore lists')
export const trustCommand = passthrough('trust', 'Install sudoers rule for passwordless nginx reload')
