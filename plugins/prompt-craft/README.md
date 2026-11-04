# prompt-craft

Turn a rough request into a structured, executable prompt before it reaches the agent.

```
You type:   给游戏加个存档
Rewritten:  目标：玩家退出后重进，能从上次所在关卡继续，进度不丢失。
            上下文：假设：沿用现有技术栈；单存档槽。
            约束：不改动现有关卡数据结构；不做云同步。
            验收：关闭页面重开，角色出现在上次退出时的关卡与坐标。
            不做：多存档槽、自动备份、加密。
```

The rewrite happens in a `session.prompt` hook. The rewritten text is the message the agent sees; the original is stored in message metadata under the `prompt-craft` key (`original` field).

## Install

From the repository root:

```sh
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft'
```

Or point OpenCode at a local checkout:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    { "package": "/absolute/path/to/opencode-companion/plugins/prompt-craft" }
  ]
}
```

The package name is `opencode-companion-prompt-craft`. It is prepared for npm, but the supported install path today is GitHub or a local directory.

## Options

```jsonc
{
  "plugins": [
    {
      "package": "/absolute/path/to/opencode-companion/plugins/prompt-craft",
      "options": {
        "enabled": true,
        "model": "opencode-go/deepseek-v4.1-flash",
        "minChars": 4,
        "maxChars": 4000,
        "timeoutMs": 15000,
        "cooldownMs": 60000,
        "debug": false
      }
    }
  ]
}
```

| Option | Default | Description |
| --- | --- | --- |
| `enabled` | `true` | Set to `false` to disable the plugin without removing it. |
| `model` | current session model | Model used for rewriting, in `provider/model` form. Omit to follow the session model. |
| `minChars` | `4` | Messages shorter than this are passed through. |
| `maxChars` | `4000` | Messages longer than this are passed through (pasted logs, code, etc.). |
| `timeoutMs` | `15000` | Abort the rewrite after this many milliseconds and send the original. |
| `cooldownMs` | `60000` | After a rewrite failure, pass messages through for this long before retrying. |
| `debug` | `false` | Print skip and failure reasons to the OpenCode log. |

Configuration changes reload automatically. Editing the plugin source also reloads it.

## Behavior

- Rewrites before the message enters the session.
- Passes through: empty messages, `/` and `!` commands, greetings and confirmations (`继续`, `好的`, `ok`, `1`), already-structured prompts, messages over `maxChars`, and subagent prompts.
- If the model is unavailable, times out, or returns unusable output, the original message is sent. The plugin never blocks a message.
- Inline `@file` mentions are cleared because character offsets change after rewriting; attached files are preserved.
- Use `/craft <request>` to force a rewrite, skipping the heuristics.
- If the rewrite fails repeatedly, set `enabled: false` temporarily or raise `debug` to inspect the cause.

## Files

- `index.ts` — prompt hook, `/craft` command, skip rules, cache, timeout, and cooldown.
- `rewrite.ts` — rewrite instructions and output cleanup. Pure functions, easy to adjust and test.

## Limitations

- The rewrite instructions are currently Chinese-first: they preserve the source language and work best with Chinese input. English input is preserved as English, but the five slot labels come from the Chinese template.
- `ctx.experimental.generate.text` is an experimental OpenCode API. The plugin is tested against OpenCode 2.2.5.

## License

MIT
