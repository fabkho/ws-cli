// Parse the bash config.sh into a typed WsmConfig object.
// Finds config via WSM_CONFIG env var, or resolves from the bash `ws` on PATH.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { WsmConfig, IdeName, TerminalApp, SessionTab, AppEntry } from './types.js'
import { defaultConfig } from './types.js'

// ---- Resolve the bash config file ----

function resolveBashHome(): string {
  try {
    // The bash `ws` dispatcher must be on PATH (installed via install.sh).
    const wsPath = execSync('which ws', { encoding: 'utf-8' }).trim()
    // Follow symlinks to the real dispatcher, then go up to its dir.
    const realPath = execSync(`readlink -f "${wsPath}" 2>/dev/null || realpath "${wsPath}" 2>/dev/null || echo "${wsPath}"`, { encoding: 'utf-8' }).trim()
    return dirname(realPath)
  } catch {
    throw new Error(
      'Cannot find the workspace-management bash tool.\n' +
      'Install it first: clone workspace-management and run install.sh\n' +
      'Or set WSM_CONFIG to point directly at your config.sh file.',
    )
  }
}

function findConfigPath(bashHome: string): string {
  // 1. Explicit override
  if (process.env.WSM_CONFIG && existsSync(process.env.WSM_CONFIG)) {
    return process.env.WSM_CONFIG
  }
  // 2. Next to the bash dispatcher
  const nextToDispatcher = join(bashHome, 'config.sh')
  if (existsSync(nextToDispatcher)) return nextToDispatcher
  // 3. XDG config
  const xdg = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'workspace-management', 'config.sh')
  if (existsSync(xdg)) return xdg
  throw new Error(
    `Config file not found. Copy config.example.sh to config.sh next to the workspaces command,\n` +
    `or to ${xdg},\n` +
    `or set WSM_CONFIG to your config file.`,
  )
}

// ---- Parse bash config into typed object ----

interface RawConfig {
  [key: string]: string | string[]
}

function parseBashConfig(configPath: string): RawConfig {
  // Source config.sh, apply defaults (mirroring common.sh's load_config),
  // then dump all known variables with declare -p.
  const script = `
    source '${configPath}'
    TASK_ID_PREFIX_LC="$(printf '%s' "\${TASK_ID_PREFIX:-CU}" | tr '[:upper:]' '[:lower:]')"
    FRONTEND_IDE="$(printf '%s' "\${FRONTEND_IDE:-vscode}" | tr '[:upper:]' '[:lower:]')"
    BACKEND_IDE="$(printf '%s' "\${BACKEND_IDE:-vscode}" | tr '[:upper:]' '[:lower:]')"
    TERMINAL_APP="\${TERMINAL_APP:-terminal}"
    TEST_DB_ENABLED="\${TEST_DB_ENABLED:-true}"
    declare -p ROOT_DIR FRONTEND_DIR_NAME BACKEND_DIR_NAME FRONTEND_REPO BACKEND_REPO WORKSPACES_ROOT 2>/dev/null || true
    declare -p FRONTEND_BASE_BRANCH BACKEND_BASE_BRANCH TASK_ID_PREFIX TASK_URL_TEMPLATE 2>/dev/null || true
    declare -p FRONTEND_IDE BACKEND_IDE NO_OPEN_AFTER_CREATE 2>/dev/null || true
    declare -p USE_REMOTE_MAIN REQUIRE_CONFIRM_REMOVE 2>/dev/null || true
    declare -p MAIN_WORKSPACE_FILE SYNC_MAIN_WORKSPACE 2>/dev/null || true
    declare -p EXTRA_WORKSPACE_FOLDERS 2>/dev/null || true
    declare -p TERMINAL_APP POST_CREATE_TERMINALS SESSION_TABS 2>/dev/null || true
    declare -p BASE_DOMAIN ADMIN_PATH PORT_RANGE_START 2>/dev/null || true
    declare -p VALET_CERT VALET_CERT_KEY VALET_PHP_SOCK VALET_NGINX_DIR VALET_LOG 2>/dev/null || true
    declare -p APPS DEFAULT_APPS 2>/dev/null || true
    declare -p TEST_DB_ENABLED TEST_DB_PREFIX TEST_DB_HOST TEST_DB_USER TEST_DB_PASSWORD 2>/dev/null || true
  `
  const output = execSync(script, {
    shell: '/bin/bash',
    encoding: 'utf-8',
  })

  const raw: RawConfig = {}
  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('declare -')) continue

    // declare -- VAR="value"
    const scalarMatch = trimmed.match(/^declare\s+(?:--\s+)?(\w+)="(.*)"$/)
    if (scalarMatch) {
      raw[scalarMatch[1]] = scalarMatch[2]
      continue
    }
    // Array: extract values
    const arrayMatch = trimmed.match(/^declare\s+-a\s+(\w+)=\((.*)\)$/)
    if (arrayMatch) {
      const values = arrayMatch[2]
        .split(/\s+/)
        .map(v => v.replace(/^\[[0-9]+\]="(.*)"$/, '$1'))
        .filter(Boolean)
      raw[arrayMatch[1]] = values
    }
  }

  return raw
}

function parseApps(raw: string[] | undefined, rawDefaults: string[] | undefined): { apps: AppEntry[]; defaultApps: string[] } {
  const apps: AppEntry[] = []
  if (raw && raw.length > 0) {
    for (const entry of raw) {
      const parts = entry.split(':')
      if (parts.length >= 4) {
        apps.push({
          key: parts[0],
          dir: parts[1],
          route: parts[2],
          offset: parseInt(parts[3], 10),
        })
      }
    }
  }
  const defaults = rawDefaults && rawDefaults.length > 0 ? [...rawDefaults] : ['admin', 'shop']
  return { apps, defaultApps: defaults }
}

function parseSessionTabs(raw: string[] | undefined): SessionTab[] {
  const tabs: SessionTab[] = []
  if (raw && raw.length > 0) {
    for (const entry of raw) {
      const parts = entry.split(':')
      if (parts.length >= 3) {
        const side = parts[1] as 'frontend' | 'backend'
        tabs.push({ name: parts[0], side, command: parts.slice(2).join(':') })
      }
    }
  }
  return tabs.length > 0 ? tabs : defaultConfig().sessionTabs
}

// Cache the parsed config — it never changes during a process lifetime.
let _config: WsmConfig | null = null

export function loadConfig(): WsmConfig {
  if (_config) return _config

  const bashHome = resolveBashHome()
  const configPath = findConfigPath(bashHome)
  const raw = parseBashConfig(configPath)
  const defaults = defaultConfig()
  const { apps, defaultApps } = parseApps(raw.APPS as string[] | undefined, raw.DEFAULT_APPS as string[] | undefined)

  _config = {
    rootDir: (raw.ROOT_DIR as string) ?? defaults.rootDir,
    frontendDirName: (raw.FRONTEND_DIR_NAME as string) ?? defaults.frontendDirName,
    backendDirName: (raw.BACKEND_DIR_NAME as string) ?? defaults.backendDirName,
    frontendRepo: (raw.FRONTEND_REPO as string) ?? defaults.frontendRepo,
    backendRepo: (raw.BACKEND_REPO as string) ?? defaults.backendRepo,
    workspacesRoot: (raw.WORKSPACES_ROOT as string) ?? defaults.workspacesRoot,

    frontendBaseBranch: (raw.FRONTEND_BASE_BRANCH as string) ?? defaults.frontendBaseBranch,
    backendBaseBranch: (raw.BACKEND_BASE_BRANCH as string) ?? defaults.backendBaseBranch,
    taskIdPrefix: (raw.TASK_ID_PREFIX as string) ?? defaults.taskIdPrefix,
    taskUrlTemplate: (raw.TASK_URL_TEMPLATE as string) ?? defaults.taskUrlTemplate,

    frontendIde: (raw.FRONTEND_IDE as IdeName) ?? defaults.frontendIde,
    backendIde: (raw.BACKEND_IDE as IdeName) ?? defaults.backendIde,
    noOpenAfterCreate: (raw.NO_OPEN_AFTER_CREATE as string) === 'true',

    useRemoteMain: (raw.USE_REMOTE_MAIN as string) === 'true',
    requireConfirmRemove: (raw.REQUIRE_CONFIRM_REMOVE as string) !== 'false',

    mainWorkspaceFile: (raw.MAIN_WORKSPACE_FILE as string) ?? defaults.mainWorkspaceFile,
    syncMainWorkspace: (raw.SYNC_MAIN_WORKSPACE as string) !== 'false',
    extraWorkspaceFolders: (raw.EXTRA_WORKSPACE_FOLDERS as string[]) ?? defaults.extraWorkspaceFolders,

    terminalApp: (raw.TERMINAL_APP as TerminalApp) ?? defaults.terminalApp,
    terminalEnabled: false,
    terminalSide: '',
    postCreateTerminals: (raw.POST_CREATE_TERMINALS as string[]) ?? defaults.postCreateTerminals,
    sessionTabs: parseSessionTabs(raw.SESSION_TABS as string[] | undefined),

    baseDomain: (raw.BASE_DOMAIN as string) ?? defaults.baseDomain,
    adminPath: (raw.ADMIN_PATH as string) ?? defaults.adminPath,
    portRangeStart: parseInt((raw.PORT_RANGE_START as string) ?? String(defaults.portRangeStart), 10),

    valetCert: (raw.VALET_CERT as string) ?? defaults.valetCert,
    valetCertKey: (raw.VALET_CERT_KEY as string) ?? defaults.valetCertKey,
    valetPhpSock: (raw.VALET_PHP_SOCK as string) ?? defaults.valetPhpSock,
    valetNginxDir: (raw.VALET_NGINX_DIR as string) ?? defaults.valetNginxDir,
    valetLog: (raw.VALET_LOG as string) ?? defaults.valetLog,

    apps,
    defaultApps,

    testDbEnabled: (raw.TEST_DB_ENABLED as string) !== 'false',
    testDbPrefix: (raw.TEST_DB_PREFIX as string) ?? defaults.testDbPrefix,
    testDbHost: (raw.TEST_DB_HOST as string) ?? defaults.testDbHost,
    testDbUser: (raw.TEST_DB_USER as string) ?? defaults.testDbUser,
    testDbPassword: (raw.TEST_DB_PASSWORD as string) ?? defaults.testDbPassword,
  }

  return _config
}
