# go-usage

See your OpenCode Go quota, peak/off-peak pricing, and the current session's efficiency without leaving the composer.

The plugin has three parts:

- a `go_usage` tool the agent can call
- a typed RPC method (`stats`) used by the desktop GUI
- an optional desktop composer pill (`gui-experimental`)

## What it shows

```text
⚠ 本次会话已 34 轮，上下文越长每轮越贵 —— 建议开新会话
当前时段：空闲（明天 09:00 进入高峰）— 当前半价
本次对话 命中 92.4% · 费用 $0.42 · 12 轮 · 输入 0.31M · 缓存读 3.81M · 输出 0.04M
额度：5小时 18% · 每周 43% · 每月 61%（剩 39%）
重置：11-18 08:00 · 按当前速度本月约用到 78%，安全
账号 you@example.com
```

Warnings cover long sessions, cache hit rate below 90%, average context above 150K, peak pricing, and less than 20% monthly quota remaining.

## Requirements

- OpenCode 2.2.5 or newer
- An active OpenCode Go subscription signed in through OpenCode
- The OpenCode data database at the standard path:
  - `$XDG_DATA_HOME/opencode/opencode.db` when `XDG_DATA_HOME` is set
  - otherwise `~/.local/share/opencode/opencode.db`

## Install

```sh
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/go-usage'
```

Or use a local checkout:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "/absolute/path/to/opencode-companion/plugins/go-usage" }
  ]
}
```

The desktop pill is loaded only when the plugin is in the **global** `opencode.json(c)`. If it does not appear, open **Settings → Extensions → Plugins** and use **Reload**.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-companion/plugins/go-usage",
      "options": {
        "timezoneOffsetMinutes": 480,
        "peakWindows": ["09:00-12:00", "14:00-18:00"],
        "workdays": [1, 2, 3, 4, 5],
        "warnings": true
      }
    }
  ]
}
```

| Option | Default | Description |
| --- | --- | --- |
| `timezoneOffsetMinutes` | `480` (UTC+8) | Timezone used to evaluate peak windows and format reset times. |
| `peakWindows` | `["09:00-12:00", "14:00-18:00"]` | Local-time windows that use peak pricing. Invalid entries fall back to the default. |
| `workdays` | `[1,2,3,4,5]` | ISO weekday numbers that use peak pricing. `0` is Sunday. |
| `warnings` | `true` | Show session-level discipline warnings. |

The server part computes all numbers. The GUI part only renders them, so changing options does not require rebuilding the bundle.

## Privacy and credentials

`go-usage` reads the active credential from the local OpenCode database in read-only mode. It extracts the access token and sends it to:

```text
https://opencode.ai/inference/go/v1/usage
```

That is the same usage endpoint used by the OpenCode console. The token is not logged, cached, or written by this plugin. The plugin has no telemetry and contacts no other host.

If the database, the credential, or the usage endpoint is unavailable, the plugin reports the error and does not retry in a tight loop.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `OpenCode data database not found` | Start OpenCode once, or set `XDG_DATA_HOME` to the directory that contains `opencode/opencode.db`. |
| `No active OpenCode Console account` | Sign in with `/connect` or `opencode auth login`. |
| `Usage endpoint returned HTTP 401/403` | The stored credential is stale; sign out and sign in again. |
| Pill shows an error | Open **Settings → Extensions → Plugins → Reload**. Check `~/.local/share/opencode/log/opencode.log`. |
| No session numbers | Send at least one message in the current session. |

## Files

- `index.ts` — tool and RPC registration, database access, usage request, formatting.
- `lib.ts` — pure time, formatting, and settings helpers.
- `rpc.ts` — typed RPC contract.
- `dist/gui-experimental.cjs` — desktop composer pill. Its RPC contract duplicates `rpc.ts` because the GUI bundle may only require modules shared by the desktop app.

## License

MIT
