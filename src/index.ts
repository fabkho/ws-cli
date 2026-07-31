#!/usr/bin/env node
// Workspace Management CLI — TypeScript wrapper around the bash tool.
// Provides AI-friendly structured output, typed configuration, and
// fixes for known bash script issues.

import { defineCommand, runMain } from 'citty'
import { createCommand } from './commands/create.js'
import { openCommand, serveCommand, statusCommand, mrCommand } from './commands/interactive.js'
import { testCommand } from './commands/test.js'
import { listCommand } from './commands/list.js'
import { removeCommand } from './commands/remove.js'
import { doctorCommand } from './commands/doctor.js'
import { syncCommand, trustCommand } from './commands/misc.js'

const main = defineCommand({
  meta: {
    name: 'ws',
    version: '0.1.0',
    description: 'Per-task git-worktree dev workspace orchestration',
  },
  subCommands: {
    create: createCommand,
    serve: serveCommand,
    test: testCommand,
    mr: mrCommand,
    list: listCommand,
    status: statusCommand,
    remove: removeCommand,
    open: openCommand,
    sync: syncCommand,
    trust: trustCommand,
    doctor: doctorCommand,
    // Hidden aliases for muscle memory
    ls: { ...listCommand, meta: { ...listCommand.meta, name: 'ls', hidden: true, alias: 'ls' } },
    rm: { ...removeCommand, meta: { ...removeCommand.meta, name: 'rm', hidden: true, alias: 'rm' } },
  },
})

runMain(main)
