// .env file helpers — post-process workspaces after ws serve to fix
// known issues (the http:// URL bug in the bash sed patterns).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { WsmConfig } from '../types.js'

/**
 * Ensure all BASE_DOMAIN URLs in an env file point to the workspace subdomain.
 * The bash prepare_frontend_env/prepare_backend_env sed patterns only match
 * `https://` URLs, missing `http://` ones (e.g. BASE_URL=http://anny.test/admin).
 * This post-processing step catches anything the sed missed.
 */
export function fixEnvUrls(
  envPath: string,
  host: string,
  baseDomain: string,
): { fixed: boolean; details: string[] } {
  if (!existsSync(envPath)) return { fixed: false, details: ['file not found'] }

  const content = readFileSync(envPath, 'utf-8')
  const domainRe = new RegExp(`https?://${baseDomain.replace(/\./g, '\\.')}`, 'g')
  const replacements: string[] = []
  let modified = false

  const lines = content.split('\n')
  const fixed = lines.map((line, i) => {
    // Skip ECHO_HOST_URL — the bash already correctly leaves it untouched
    if (line.startsWith('ECHO_HOST_URL=')) return line

    const match = line.match(domainRe)
    if (match) {
      const newLine = line.replace(domainRe, `https://${host}`)
      if (newLine !== line) {
        replacements.push(`  line ${i + 1}: ${match[0]} -> https://${host}`)
        modified = true
        return newLine
      }
    }
    return line
  })

  if (modified) {
    writeFileSync(envPath, fixed.join('\n'))
  }

  return {
    fixed: modified,
    details: replacements,
  }
}

/**
 * Post-process all env files for a workspace after ws serve.
 * Called automatically by the serve command handler.
 */
export function fixWorkspaceEnvs(
  config: WsmConfig,
  slug: string,
  host: string,
): { fixed: number } {
  const sessionDir = join(config.workspacesRoot, slug)
  let fixedCount = 0

  // Frontend .env files (one per app)
  for (const app of config.defaultApps) {
    const appEntry = config.apps.find(a => a.key === app)
    if (!appEntry) continue
    const envPath = join(sessionDir, config.frontendDirName, appEntry.dir, '.env')
    const result = fixEnvUrls(envPath, host, config.baseDomain)
    if (result.fixed) fixedCount++
  }

  // Backend .env
  const backendEnv = join(sessionDir, config.backendDirName, '.env')
  const backendResult = fixEnvUrls(backendEnv, host, config.baseDomain)
  if (backendResult.fixed) fixedCount++

  return { fixed: fixedCount }
}
