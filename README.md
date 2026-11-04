# OpenCode Companion

Two small, focused plugins for [OpenCode](https://opencode.ai): write clearer prompts and keep an eye on OpenCode Go usage.

[中文说明](README.zh-CN.md) · [Install](docs/install.md) · [Configuration](docs/configuration.md) · [Troubleshooting](docs/troubleshooting.md) · [Contributing](CONTRIBUTING.md)

[![CI](https://github.com/jokerXYH/opencode-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/jokerXYH/opencode-companion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-v2-111111)](https://opencode.ai)

## Plugins

| Plugin | What it does | Requires |
| --- | --- | --- |
| **prompt-craft** | Rewrites a rough request into a structured prompt (goal / context / constraints / acceptance / out of scope) before it reaches the agent. Adds a `/craft` command and a manual escape hatch. | Any model available to OpenCode |
| **go-usage** | Shows OpenCode Go quota, current peak/off-peak pricing, this session's cache hit rate, spend, and context warnings. Adds a `go_usage` tool and an optional desktop pill. | An OpenCode Go subscription on OpenCode 2.2.5+ |

Both plugins fail open: if a rewrite or usage request fails, your message or session is never blocked. Plugin UI strings are currently Chinese; docs are bilingual and localization PRs are welcome.

## Install

OpenCode 2.2.5 or newer is recommended. Install from GitHub with the OpenCode CLI:

```sh
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft'
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/go-usage'
```

`plugin add` writes the plugin to your global OpenCode configuration. Use `opencode plugin list` to confirm both IDs (`prompt-craft`, `go-usage`) appear, then restart the desktop app once or run `/reload`.

To use a local checkout instead:

```sh
git clone https://github.com/jokerXYH/opencode-companion.git
```

```jsonc
// ~/.config/opencode/opencode.jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "/absolute/path/to/opencode-companion/plugins/prompt-craft",
    "/absolute/path/to/opencode-companion/plugins/go-usage"
  ]
}
```

The desktop pill and other GUI parts are loaded only from the global configuration. See [docs/install.md](docs/install.md) for Windows/macOS/Linux notes and uninstall steps.

## Use

### prompt-craft

Type normally. Before a message enters the session, prompt-craft asks the current model to fill the missing slots, then sends the rewritten prompt. The original text is kept in the message metadata under the `prompt-craft` key (`original` field).

```text
You type:   给游戏加个存档
Rewritten:  目标：玩家退出后重进，能从上次所在关卡继续，进度不丢失。
            上下文：假设：沿用现有技术栈；单存档槽。
            约束：不改动现有关卡数据结构；不做云同步。
            验收：关闭页面重开，角色出现在上次退出时的关卡与坐标。
            不做：多存档槽、自动备份、加密。
```

Use `/craft <request>` when you want to force a rewrite. Short replies, commands, already-structured prompts, long pastes, and subagent prompts are passed through untouched. See [plugins/prompt-craft/README.md](plugins/prompt-craft/README.md) for every option.

### go-usage

Ask the agent to call the `go_usage` tool, or open the desktop composer pill. It shows:

- active/next peak window and the current price multiplier
- 5-hour, weekly, and monthly quota percentages
- this session's cache hit rate, spend, request count, and token split
- warnings for long sessions, low cache hit rates, large contexts, peak pricing, and a nearly exhausted monthly quota

The plugin reads the active OpenCode credential from the local OpenCode database and sends it only to the OpenCode usage endpoint. The token is never logged, cached, or written anywhere. See [plugins/go-usage/README.md](plugins/go-usage/README.md) and [SECURITY.md](SECURITY.md).

## Configuration

Both plugins accept an options object. A complete example lives at [examples/opencode.json](examples/opencode.json).

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft",
      "options": { "enabled": true, "timeoutMs": 15000 }
    },
    {
      "package": "github:jokerXYH/opencode-companion#main::path:plugins/go-usage",
      "options": { "timezoneOffsetMinutes": 480 }
    }
  ]
}
```

When loading from a checkout, replace each Git spec with the absolute plugin directory. The npm package names (`opencode-companion-prompt-craft`, `opencode-companion-go-usage`) are reserved for a future publish and are not the supported install path yet. Full option tables are in [docs/configuration.md](docs/configuration.md).

## Privacy

- No telemetry, analytics, or third-party network calls.
- prompt-craft sends your message to the model you already selected. It adds no new provider.
- go-usage reads your local OpenCode credential database read-only. The access token is sent only to `https://opencode.ai/inference/go/v1/usage` to fetch your own quota. It is never printed or stored by the plugin.

## Development

```sh
npm install
npm run check
```

`npm run check` runs TypeScript type checking and the unit tests. The plugins are plain TypeScript with no build step; OpenCode loads the source directly. The desktop GUI part is a committed CommonJS bundle at `plugins/go-usage/dist/gui-experimental.cjs`.

See [docs/development.md](docs/development.md) for the repository layout, test strategy, and release checklist.

## Project name

This project was previously developed as `opencode-config`. It is now **OpenCode Companion** (`opencode-companion`), a focused public plugin collection. The GitHub repository redirects the old URL.

## License

[MIT](LICENSE) © 2026 jokerXYH
