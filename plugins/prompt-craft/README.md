# prompt-craft

把随手写的一句话，在发给模型之前补成结构化提示词：

```
目标：玩家退出后重进，能从上次所在关卡继续，进度不丢失。
上下文：假设：沿用现有技术栈；单存档槽。
约束：不改动现有关卡数据结构；不做云同步。
验收：关闭页面重开，角色出现在上次退出时的关卡与坐标。
不做：多存档槽、自动备份、加密。
```

## 开关与配置

在 `~/.config/opencode/opencode.json` 的 `plugins` 里（已加好）：

```jsonc
{
  "plugins": [
    "./plugins/prompt-craft"
  ]
}
```

带参数时写成对象形式：

```jsonc
{
  "plugins": [
    {
      "package": "./plugins/prompt-craft",
      "options": {
        "enabled": true,
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

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `enabled` | `true` | `false` 完全不介入 |
| `model` | 会话当前模型 | 指定改写模型，形如 `"opencode-go/deepseek-v4.1-flash"` |
| `minChars` | `4` | 短于这个长度不改写 |
| `maxChars` | `4000` | 长于这个长度不改写（粘贴日志之类） |
| `timeoutMs` | `15000` | 超时按原文发送 |
| `cooldownMs` | `60000` | 改写失败后暂停多久 |
| `debug` | `false` | 在日志里打印跳过/失败原因 |

改完配置不用重启，OpenCode 会自动重载。插件自身文件被修改也会触发重载。

## 行为

- 消息进入会话前改写，改后的文本就是会话里的正式内容，原始文本存在消息 metadata 的 `prompt-craft.original`。
- 以下情况原样放行：空消息、`/` 和 `!` 开头的命令、寒暄与确认（「继续」「好的」「ok」「1」）、已经是五段式的提示词、超过 `maxChars` 的长文、子会话（subagent）的提示词。
- 改写失败、超时、模型不可用时一律按原文发送，不会挡住消息。
- 原文里的 `@文件` 引用会被清掉行内标记（附件本身保留），因为改写后字符偏移已失效。
- 不想等这一次？任何一条消息都可以用 `/craft` 强制改写，或临时把 `enabled` 改成 `false`。

## 文件

- `index.ts` — 插件主体：prompt hook、`/craft` 命令、跳过规则、缓存与超时。
- `rewrite.ts` — 改写用的指令和输出清理，纯函数，便于单独调整。
