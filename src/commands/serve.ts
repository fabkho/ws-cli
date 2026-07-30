// ws serve — prepare and serve a workspace at its subdomain
// Post-processes env files as a safety net (bash fix in MR #11 handles the
// common case; this catches anything the sed missed).

import { defineCommand } from 'citty'
import { ws } from '../bash.js'
import { loadConfig } from '../config.js'
import { fixWorkspaceEnvs } from '../lib/env.js'

export const serveCommand = defineCommand({
  meta: {
    name: 'serve',
    description: 'Prepare and serve a workspace at its subdomain',
  },
  args: {
    slug: {
      type: 'positional',
      description: 'Workspace slug (auto-detected from CWD if omitted)',
    },
    allApps: {
      type: 'boolean',
      description: 'Serve every known app, not just defaults',
    },
    force: {
      type: 'boolean',
      description: 'Regenerate env files and nginx block',
    },
    verbose: {
      type: 'boolean',
      alias: 'v',
      description: 'Show verbose output',
    },
    dryRun: {
      type: 'boolean',
      description: 'Print actions without executing',
    },
    json: {
      type: 'boolean',
      description: 'Output JSON with serve status',
    },
  },
  run: async ({ args }) => {
    const config = loadConfig()
    const bashArgs: string[] = []
    if (args.slug) bashArgs.push(args.slug as string)
    if (args.allApps) bashArgs.push('--all-apps')
    if (args.force) bashArgs.push('--force')
    if (args.verbose) bashArgs.push('--verbose')
    if (args.dryRun) bashArgs.push('--dry-run')

    const result = ws('serve', bashArgs)

    // Safety net: fix any env URLs the bash sed might have missed.
    // This is a no-op when the bash fix (MR #11) already handled everything.
    if (result.success && !args.dryRun) {
      const slug = (args.slug as string) || ''
      if (slug) {
        const sub = slug.replace(/^.*?_/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-') || slug.toLowerCase()
        const host = `${sub}.${config.baseDomain}`
        const envResult = fixWorkspaceEnvs(config, slug, host)
        if (envResult.fixed > 0) {
          console.log(`  ✓ env URLs post-fixed (${envResult.fixed} file(s) had unrewritten URLs)`)
        }
      }
    }

    process.exit(result.status ?? 1)
  },
})
