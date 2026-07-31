// ws open — open a workspace in the configured IDE(s)
// ws serve — prepare and serve a workspace at its subdomain
// ws status — health report for workspaces
// ws mr — open or create GitLab merge requests

import { defineCommand } from 'citty'
import { select, intro, outro, isCancel, log } from '@clack/prompts'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { ws } from '../bash.js'
import { loadConfig } from '../config.js'
import { resolveSlug } from './helpers.js'

type OpenSide = 'both' | 'frontend' | 'backend'

export const openCommand = defineCommand({
  meta: { name: 'open', description: 'Open a workspace in the configured IDE(s)' },
  args: {
    slug: { type: 'positional', description: 'Workspace slug or index number', required: false },
    fe: { type: 'boolean', description: 'Frontend only' },
    be: { type: 'boolean', description: 'Backend only' },
    json: { type: 'boolean', description: 'Output JSON' },
  },
  run: async ({ args }) => {
    const slug = await resolveSlug(args.slug as string | undefined)
    if (!slug) process.exit(1)

    const config = loadConfig()
    const fePath = join(config.workspacesRoot, slug, config.frontendDirName)
    const bePath = join(config.workspacesRoot, slug, config.backendDirName)

    // Resolve which side(s) to open
    let side: OpenSide = 'both'
    if (args.fe) side = 'frontend'
    else if (args.be) side = 'backend'
    else if (config.frontendIde === config.backendIde) {
      side = 'both'  // same IDE — open both in one window
    } else {
      intro(`Open ${slug}`)
      const chosen = await select({
        message: 'Which side?',
        options: [
          { value: 'both', label: `Both (${config.frontendIde} + ${config.backendIde})` },
          { value: 'frontend', label: `Frontend only (${config.frontendIde})` },
          { value: 'backend', label: `Backend only (${config.backendIde})` },
        ],
      })
      if (isCancel(chosen)) { outro('Cancelled.'); process.exit(0) }
      side = chosen as OpenSide
    }

    // Open the IDE(s)
    const opened: string[] = []

    if (side === 'both' || side === 'frontend') {
      openIde(config.frontendIde, fePath)
      opened.push(`${config.frontendIde} → ${config.frontendDirName}`)
    }
    if (side === 'both' || side === 'backend') {
      openIde(config.backendIde, bePath)
      opened.push(`${config.backendIde} → ${config.backendDirName}`)
    }

    log.success(`Opened: ${opened.join(', ')}`)
    process.exit(0)
  },
})

function openIde(ide: string, dir: string): void {
  spawn(ide, ide === 'zed' ? ['-n', dir] : [dir], {
    stdio: 'ignore',
    detached: true,
  }).unref()
}


export const serveCommand = defineCommand({
  meta: { name: 'serve', description: 'Prepare and serve a workspace at its subdomain' },
  args: {
    slug: { type: 'positional', description: 'Workspace slug', required: false },
    allApps: { type: 'boolean', description: 'Serve every known app, not just defaults' },
    force: { type: 'boolean', description: 'Regenerate env files and nginx block' },
    verbose: { type: 'boolean', alias: 'v', description: 'Show verbose output' },
    dryRun: { type: 'boolean', description: 'Print actions without executing' },
    json: { type: 'boolean', description: 'Output JSON with serve status' },
  },
  run: async ({ args, rawArgs }) => {
    const slug = await resolveSlug(args.slug as string | undefined)
    if (!slug) process.exit(1)

    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    if (!forwardedArgs.includes(slug)) forwardedArgs.push(slug)
    const result = ws('serve', forwardedArgs)

    // Safety net: fix env URLs bash sed might have missed
    if (result.success && !args.dryRun) {
      const config = loadConfig()
      const sub = slug.replace(/^.*?_/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-') || slug.toLowerCase()
      const host = `${sub}.${config.baseDomain}`
      const { fixWorkspaceEnvs } = await import('../lib/env.js')
      const envResult = fixWorkspaceEnvs(config, slug, host)
      if (envResult.fixed > 0) {
        log.info(`env URLs post-fixed (${envResult.fixed} file(s))`)
      }
    }

    process.exit(result.status ?? 1)
  },
})

export const statusCommand = defineCommand({
  meta: { name: 'status', description: 'Health report for workspaces' },
  args: {
    slug: { type: 'positional', description: 'Workspace slug', required: false },
    json: { type: 'boolean', description: 'Output JSON' },
    mr: { type: 'boolean', description: 'Include MR lookup' },
  },
  run: async ({ args, rawArgs }) => {
    const slug = await resolveSlug(args.slug as string | undefined)
    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    if (slug && !forwardedArgs.includes(slug)) forwardedArgs.push(slug)
    const result = ws('status', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})

export const mrCommand = defineCommand({
  meta: { name: 'mr', description: 'Open or create GitLab merge requests for the workspace' },
  args: {
    slug: { type: 'positional', description: 'Workspace slug', required: false },
    fe: { type: 'boolean', description: 'Frontend repo only' },
    be: { type: 'boolean', description: 'Backend repo only' },
    all: { type: 'boolean', description: 'Both repos (default)' },
    target: { type: 'string', description: 'Target branch for the MR', valueHint: 'branch' },
    dryRun: { type: 'boolean', description: 'Print what would happen without pushing' },
    json: { type: 'boolean', description: 'Output JSON with MR status' },
  },
  run: async ({ args, rawArgs }) => {
    const slug = await resolveSlug(args.slug as string | undefined)
    if (!slug) process.exit(1)

    const forwardedArgs = rawArgs.filter(a => a !== '--json')
    if (!forwardedArgs.includes(slug)) forwardedArgs.push(slug)
    if (!forwardedArgs.some(a => a === '--fe' || a === '--be' || a === '--all')) {
      forwardedArgs.unshift('--all')
    }
    const result = ws('mr', forwardedArgs)
    process.exit(result.status ?? 1)
  },
})
