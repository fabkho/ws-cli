// Types for the workspace-management CLI configuration.
// Mirrors the bash config.sh variables with strict typing.

export type IdeName = 'vscode' | 'phpstorm' | 'webstorm' | 'zed'
export type TerminalApp = 'terminal' | 'warp'

export interface AppEntry {
  key: string       // e.g. 'admin'
  dir: string       // e.g. 'app-admin'
  route: string     // e.g. '/admin'
  offset: number    // port offset within workspace block
}

export interface SessionTab {
  name: string
  side: 'frontend' | 'backend'
  command: string
}

export interface WsmConfig {
  // Paths
  rootDir: string
  frontendDirName: string
  backendDirName: string
  frontendRepo: string
  backendRepo: string
  workspacesRoot: string

  // Git
  frontendBaseBranch: string
  backendBaseBranch: string
  taskIdPrefix: string
  taskUrlTemplate: string

  // IDE
  frontendIde: IdeName
  backendIde: IdeName
  noOpenAfterCreate: boolean

  // Git strategy
  useRemoteMain: boolean
  requireConfirmRemove: boolean

  // VS Code
  mainWorkspaceFile: string
  syncMainWorkspace: boolean
  extraWorkspaceFolders: string[]

  // Terminal
  terminalApp: TerminalApp
  terminalEnabled: boolean
  terminalSide: 'frontend' | 'backend' | ''
  postCreateTerminals: string[]
  sessionTabs: SessionTab[]

  // Serving
  baseDomain: string
  adminPath: string
  portRangeStart: number

  // Valet
  valetCert: string
  valetCertKey: string
  valetPhpSock: string
  valetNginxDir: string
  valetLog: string

  // Apps
  apps: AppEntry[]
  defaultApps: string[]

  // Test DB
  testDbEnabled: boolean
  testDbPrefix: string
  testDbHost: string
  testDbUser: string
  testDbPassword: string
}

// Default values mirroring common.sh's load_config defaults
export function defaultConfig(): WsmConfig {
  return {
    rootDir: '',
    frontendDirName: 'anny-ui',
    backendDirName: 'bookings-api',
    frontendRepo: '',
    backendRepo: '',
    workspacesRoot: '',

    frontendBaseBranch: 'main',
    backendBaseBranch: 'main',
    taskIdPrefix: 'CU',
    taskUrlTemplate: '',

    frontendIde: 'vscode',
    backendIde: 'vscode',
    noOpenAfterCreate: false,

    useRemoteMain: false,
    requireConfirmRemove: true,

    mainWorkspaceFile: '',
    syncMainWorkspace: true,
    extraWorkspaceFolders: [],

    terminalApp: 'terminal',
    terminalEnabled: false,
    terminalSide: '',
    postCreateTerminals: [],
    sessionTabs: [
      { name: 'queue', side: 'backend', command: 'php artisan horizon' },
      { name: 'agent (api)', side: 'backend', command: 'claude' },
      { name: 'agent (ui)', side: 'frontend', command: 'claude' },
    ],

    baseDomain: 'anny.test',
    adminPath: '/admin/calendar',
    portRangeStart: 20000,

    valetCert: '',
    valetCertKey: '',
    valetPhpSock: '',
    valetNginxDir: '',
    valetLog: '',

    apps: [
      { key: 'admin', dir: 'app-admin', route: '/admin', offset: 1 },
      { key: 'shop', dir: 'app-shop', route: '/b', offset: 2 },
    ],
    defaultApps: ['admin', 'shop'],

    testDbEnabled: true,
    testDbPrefix: 'anny_bookings_test',
    testDbHost: '127.0.0.1',
    testDbUser: 'root',
    testDbPassword: '',
  }
}
