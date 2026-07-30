# ws-cli

TypeScript CLI wrapper for [workspace-management](https://github.com/vinson-vinson-vinson/workspace-management) — AI-friendly workspace orchestration.

Wraps the bash `ws` tool with Citty for structured output, typed configuration, and pre/post-processing fixes.

## Install

```bash
git clone <this-repo>
cd ws-cli
npm install
npm run build
```

Requires the bash workspace-management tool installed on PATH (`install.sh` from that repo).

## Usage

```bash
node dist/index.js --help
node dist/index.js list --json
node dist/index.js create CU-1234_my-feature --no-terminals
node dist/index.js test --dry-run CU-1234_my-feature
```

Or symlink for convenience:
```bash
ln -s $(pwd)/dist/index.js ~/.local/bin/ws-cli
```

## Architecture

- **CLI shell**: Citty for arg parsing, subcommand routing, auto-generated help
- **Operations**: delegates to bash `ws` on PATH for worktree/nginx/valet
- **Config**: parses bash `config.sh` into typed `WsmConfig` at startup
- **`--json`**: structured output on every command for AI consumption

## Commands

| Command | Description | Notes |
|---------|-------------|-------|
| `create` | Create a workspace | `--no-terminals`, `--terminals-side` |
| `serve` | Prepare + serve at subdomain | Delegated to bash |
| `test` | Run backend tests | Auto-detects PHP from composer.json |
| `mr` | Open/create GitLab MRs | |
| `list` | List workspaces | `--json` is native TS |
| `status` | Health report | |
| `remove` | Tear down workspace | |
| `open` | Open in IDE(s) | |
| `sync` | Sync SCM ignore lists | |
| `trust` | Install sudoers rule | |
