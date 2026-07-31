# Changelog

## [0.1.2](https://github.com/fabkho/ws-cli/compare/ws-cli-0.1.1...ws-cli-0.1.2) (2026-07-31)


### Features

* type-ahead search in ws open (and all slug pickers) ([3ac5a37](https://github.com/fabkho/ws-cli/commit/3ac5a376c63098116ee69dc57ff731c357c6e93f))


### Bug Fixes

* **ci:** pass NODE_AUTH_TOKEN to setup-node for .npmrc ([ac81f66](https://github.com/fabkho/ws-cli/commit/ac81f664c6157fd4d85ca67d0e9ae8848a6f985b))
* **ci:** write .npmrc explicitly before publish ([4741ad7](https://github.com/fabkho/ws-cli/commit/4741ad79ae3c5c73c151f471dcc5ce06446c093f))
* rename to @fabkho/ws-cli (ws-cli taken on npm) ([3daa9a9](https://github.com/fabkho/ws-cli/commit/3daa9a9c1cb716858c9b1fb1050d3456b8b63bc2))
* ws open uses clack select + argument-based fuzzy search ([2565ae0](https://github.com/fabkho/ws-cli/commit/2565ae06abce39cd52e6787fc55ac711afae9dc1))

## [0.1.1](https://github.com/fabkho/ws-cli/compare/ws-cli-0.1.0...ws-cli-0.1.1) (2026-07-31)


### Features

* 5 list prototypes (ws list-1 through list-5) ([c2bb6e4](https://github.com/fabkho/ws-cli/commit/c2bb6e4f3ece7bd3cd161023a2bb0d15cd35cdf3))
* cli-table3 for ws list + gradient-string banner ([62927e6](https://github.com/fabkho/ws-cli/commit/62927e6d36f95a830dbed4001635e754eaa59ff8))
* fuzzy search with fuse.js in ws list and interactive picker ([b36a3bf](https://github.com/fabkho/ws-cli/commit/b36a3bfe7d518587c0cc8f6cf952657e49027a83))
* initial release — interactive workspace management CLI ([38b1225](https://github.com/fabkho/ws-cli/commit/38b1225b7cdc70c4c1ba79616b1cb4db09354b38))
* interactive slug resolution on open/serve/status/mr/test ([da0fd0c](https://github.com/fabkho/ws-cli/commit/da0fd0cd71beda42ea60ce8f524ef251e4feafad))
* native color-coded ws list with workspace accent colors ([6ad4c83](https://github.com/fabkho/ws-cli/commit/6ad4c832bb32bd3b2c8b2fba9cda2d7dc60f4d33))
* type-ahead search in ws list via @inquirer/search ([63b024e](https://github.com/fabkho/ws-cli/commit/63b024e756abe58a304050091e4c4a801e6b7459))
* ws open --fe/--be and interactive side picker ([379c835](https://github.com/fabkho/ws-cli/commit/379c8351cb809405057a00d49cdcfe8a5b65d9ba))


### Bug Fixes

* add .release-please-manifest.json for release-please ([e39082f](https://github.com/fabkho/ws-cli/commit/e39082f30fccde671fe506f0ebe6a4e088e03d84))
* card-style ws list — no wrapping on narrow terminals ([827f0bd](https://github.com/fabkho/ws-cli/commit/827f0bd12e542825732df0113a157467393a508a))
* **ci:** fallow needs --base main and full git history ([a21ac6c](https://github.com/fabkho/ws-cli/commit/a21ac6cacd7edeadcc1f280d82a24939685b5601))
* **ci:** fetch main branch before fallow audit ([e04f9fe](https://github.com/fabkho/ws-cli/commit/e04f9fea15061f0b617bc974b691a2faa1b1c81f))
* use workspaces (not ws) for bash delegation to avoid recursion ([d775611](https://github.com/fabkho/ws-cli/commit/d775611443a48b70a7a6126a4b757863534df42a))
* ws remove now prompts for slug when not provided ([523fdc3](https://github.com/fabkho/ws-cli/commit/523fdc3face8da272dcb272cb62c6c532c547589))


### Reverts

* back to simple card-style ws list with stats bar ([3d71968](https://github.com/fabkho/ws-cli/commit/3d71968b5a8da54f5f8970342d49b2eaab792af5))
