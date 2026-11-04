# Development

## Layout

```text
.
├── plugins/
│   ├── go-usage/          # quota + session usage plugin
│   │   ├── index.ts       # server part: tool, RPC, database, network
│   │   ├── lib.ts         # pure time/formatting helpers
│   │   ├── rpc.ts         # typed RPC contract
│   │   └── dist/
│   │       └── gui-experimental.cjs
│   └── prompt-craft/      # prompt rewriting plugin
│       ├── index.ts       # hook, /craft command, cache
│       └── rewrite.ts     # instructions + output cleanup
├── skills/prompt-craft/   # optional OpenCode skill companion
├── tests/                 # node:test + tsx
├── docs/
└── examples/
```

Each plugin is its own package. The root package is private and only exists to run type checking and tests across the workspace.

## Setup

```sh
npm install
npm run check
```

Useful commands:

```sh
npm run typecheck          # tsc --noEmit
npm test                   # node --import tsx --test tests/*.test.ts
npm run check              # both
```

The plugins run in OpenCode's Bun runtime. The source is loaded directly; there is no build step for the server parts.

## Testing approach

- Pure helpers (`go-usage/lib.ts`, `prompt-craft/rewrite.ts`) have unit tests.
- The plugin entry files are type-checked against `@opencode/plugin`.
- The GUI bundle is CommonJS and is not type-checked. Keep its RPC contract identical to `rpc.ts`; the duplication is required because the desktop bundle may only require modules shared by the app.
- Before releasing, install the plugin from the actual Git spec in a clean config directory and verify `opencode plugin list` plus one real session.

## Local plugin iteration

1. Add the local directories to a test config, or install them with the local path form.
2. Reload the plugin after changes.
3. Watch the log if a plugin fails to load:

```text
~/.local/share/opencode/log/opencode.log
```

For a local install, `opencode service restart` is the reliable way to pick up changes that are not watched.

## Release checklist

1. Update versions in `plugins/*/package.json` and the root `package.json`.
2. Move the changelog entries from `Unreleased` to the new version.
3. Run `npm run check`.
4. Test both plugins from a clean OpenCode config:
   - `opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft'`
   - `opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/go-usage'`
   - `opencode plugin list`
   - call `go_usage` and `/craft`
5. Commit, tag (`v1.0.0`), and push.
6. Create a GitHub release with notes.

The packages are prepared for npm (`opencode-companion-go-usage`, `opencode-companion-prompt-craft`) but are not published yet. If you publish them, run `npm publish -w plugins/go-usage` and `npm publish -w plugins/prompt-craft` after the release checklist.

## Scope

This repository intentionally contains only the two plugins and their docs, tests, and optional skill. New unrelated features belong in a separate repository.
