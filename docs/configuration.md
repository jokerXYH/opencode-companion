# Configuration

Both plugins are configured through the `plugins` array in `opencode.json(c)`. The object form passes options:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-companion/plugins/prompt-craft",
      "options": { "enabled": true }
    },
    {
      "package": "/absolute/path/to/opencode-companion/plugins/go-usage",
      "options": { "timezoneOffsetMinutes": 480 }
    }
  ]
}
```

When installing from GitHub, use the repository specs:

```jsonc
{
  "plugins": [
    "github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft",
    "github:jokerXYH/opencode-companion#main::path:plugins/go-usage"
  ]
}
```

The npm package names (`opencode-companion-prompt-craft`, `opencode-companion-go-usage`) are prepared for a future publish. Until then, use a Git spec or a local absolute path.

`opencode plugin add` writes these entries to the global config for you. The root `opencode.json` is not part of the project; use [examples/opencode.json](../examples/opencode.json) as a starting point.

## prompt-craft

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | `true` | Disable the plugin without removing it. |
| `model` | string | session model | Rewrite model in `provider/model` form. |
| `minChars` | number | `4` | Skip shorter messages. |
| `maxChars` | number | `4000` | Skip longer messages. |
| `timeoutMs` | number | `15000` | Abort and send the original after this timeout. |
| `cooldownMs` | number | `60000` | Pause rewriting after a failure. |
| `debug` | boolean | `false` | Log skip and failure reasons. |

Example: use a fast model for rewriting while keeping a larger model for the session.

```jsonc
{
  "package": "/absolute/path/to/opencode-companion/plugins/prompt-craft",
  "options": {
    "model": "opencode-go/deepseek-v4.1-flash",
    "timeoutMs": 8000
  }
}
```

## go-usage

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `timezoneOffsetMinutes` | number | `480` | Offset from UTC used for peak windows and reset times. |
| `peakWindows` | string[] | `["09:00-12:00", "14:00-18:00"]` | Local-time peak windows. |
| `workdays` | number[] | `[1,2,3,4,5]` | ISO weekdays that use peak pricing (`0` = Sunday). |
| `warnings` | boolean | `true` | Show session discipline warnings. |

Example: UTC+1, a single peak window, Monday–Friday.

```jsonc
{
  "package": "/absolute/path/to/opencode-companion/plugins/go-usage",
  "options": {
    "timezoneOffsetMinutes": 60,
    "peakWindows": ["08:00-12:00"],
    "workdays": [1, 2, 3, 4, 5]
  }
}
```

Invalid values fall back to defaults instead of throwing:

- timezone outside `[-720, 840]` → `480`
- malformed peak window → default windows
- empty or invalid workdays → Monday–Friday

## Reloading

OpenCode watches configuration and plugin files and reloads them after a save. If a change does not take effect:

```sh
opencode service restart
```

In the desktop app, **Settings → Extensions → Plugins → Reload** reloads a single plugin.

## Disabling one plugin temporarily

Use the plugin ID with a leading `-`:

```jsonc
{
  "plugins": [
    "github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft",
    "github:jokerXYH/opencode-companion#main::path:plugins/go-usage",
    "-prompt-craft"
  ]
}
```

Or set `"enabled": false` in prompt-craft's options.
