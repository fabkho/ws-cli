#!/usr/bin/env node
// Workspace Management CLI — TypeScript wrapper around the bash tool.
// Provides AI-friendly structured output, typed configuration, and
// fixes for known bash script issues.

import { defineCommand, runMain } from 'citty'
import { createCommand } from './commands/create.js'
import { openCommand, serveCommand, statusCommand, mrCommand } from './commands/interactive.js'
import { testCommand } from './commands/test.js'
import { listCommand } from './commands/list.js'
import { list1, list2, list3, list4, list5 } from './commands/list-prototypes.js'
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
    'list-1': list1,
    'list-2': list2,
    'list-3': list3,
    'list-4': list4,
    'list-5': list5,
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
