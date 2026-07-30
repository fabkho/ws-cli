// Shell out to the bash `ws` dispatcher (must be on PATH via install.sh).
// All commands delegate to the bash scripts for the heavy lifting
// (worktrees, nginx, valet, osascript, etc.).

import { spawnSync, type SpawnSyncOptions } from 'node:child_process'

export interface BashResult {
  success: boolean
  stdout: string
  stderr: string
  status: number | null
}

export interface BashOpts {
  capture?: boolean
  env?: Record<string, string>
}

/**
 * Run a bash workspace-management subcommand via the `ws` dispatcher.
 * Requires the bash tool to be installed on PATH (run install.sh from
 * the workspace-management repo).
 */
export function ws(subcommand: string, args: string[] = [], opts: BashOpts = {}): BashResult {
  const spawnOpts: SpawnSyncOptions = {
    stdio: opts.capture ? 'pipe' : 'inherit',
    env: {
      ...process.env,
      ...opts.env,
    },
  }

  const result = spawnSync('ws', [subcommand, ...args], spawnOpts)

  return {
    success: result.status === 0,
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
    status: result.status,
  }
}

/**
 * Run with stdout captured for JSON output.
 */
export function wsCapture(subcommand: string, args: string[] = [], env?: Record<string, string>): BashResult {
  return ws(subcommand, args, { capture: true, env })
}
