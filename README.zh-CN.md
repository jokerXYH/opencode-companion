# OpenCode Companion

两个专注、克制的 [OpenCode](https://opencode.ai) 插件：把随手写的一句话补成结构化提示词，以及随时看清 OpenCode Go 的额度与消耗。

[English](README.md) · [安装](docs/install.md) · [配置](docs/configuration.md) · [故障排查](docs/troubleshooting.md) · [参与贡献](CONTRIBUTING.md)

[![CI](https://github.com/jokerXYH/opencode-companion/actions/workflows/ci.yml/badge.svg)](https://github.com/jokerXYH/opencode-companion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![OpenCode](https://img.shields.io/badge/OpenCode-v2-111111)](https://opencode.ai)

## 插件

| 插件 | 作用 | 依赖 |
| --- | --- | --- |
| **prompt-craft** | 在消息进入会话前，把随手写的一句话补成「目标 / 上下文 / 约束 / 验收 / 不做」五段式提示词。提供 `/craft` 手动入口。 | 任意 OpenCode 可用模型 |
| **go-usage** | 显示 OpenCode Go 额度、当前峰谷计价、本次会话命中率、费用与上下文提醒。提供 `go_usage` 工具和桌面胶囊。 | OpenCode 2.2.5+ 的 OpenCode Go 订阅 |

两个插件都「失败即放行」：改写或额度请求失败时，消息和会话照常进行，不会被插件挡住。

## 安装

推荐 OpenCode 2.2.5 或更新版本。用 OpenCode CLI 从 GitHub 安装：

```sh
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft'
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/go-usage'
```

`plugin add` 会写入全局 OpenCode 配置。用 `opencode plugin list` 确认出现 `prompt-craft` 和 `go-usage`，然后重启一次桌面端或执行 `/reload`。

使用本地仓库时：

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

桌面胶囊等 GUI 部分只从全局配置加载。Windows / macOS / Linux 的细节和卸载方式见 [docs/install.md](docs/install.md)。

## 使用

### prompt-craft

正常输入即可。消息进入会话前，prompt-craft 会让当前模型补齐缺失的槽位，再把改写后的文本交给 agent。原文保存在消息 metadata 的 `prompt-craft.original` 中。

```text
你输入：   给游戏加个存档
改写后：   目标：玩家退出后重进，能从上次所在关卡继续，进度不丢失。
           上下文：假设：沿用现有技术栈；单存档槽。
           约束：不改动现有关卡数据结构；不做云同步。
           验收：关闭页面重开，角色出现在上次退出时的关卡与坐标。
           不做：多存档槽、自动备份、加密。
```

想强制改写时使用 `/craft <需求>`。短回复、命令、已经结构化的提示词、长日志和子会话提示词都会原样放行。完整选项见 [plugins/prompt-craft/README.md](plugins/prompt-craft/README.md)。

### go-usage

让 agent 调用 `go_usage` 工具，或直接看桌面端的输入框胶囊。它会显示：

- 当前 / 下一个高峰时段和计价倍率
- 5 小时、每周、每月额度百分比
- 本次会话的命中率、费用、轮数和 token 构成
- 长会话、低命中率、大上下文、高峰计价、月度额度不足等提醒

插件只读本地 OpenCode 数据库里的当前凭据，并仅发送到 OpenCode 用量接口。token 不会被打印、缓存或写入任何文件。详见 [plugins/go-usage/README.md](plugins/go-usage/README.md) 和 [SECURITY.md](SECURITY.md)。

## 配置

两个插件都接受 options。完整示例见 [examples/opencode.json](examples/opencode.json)。

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

本地加载时把 package 换成插件目录的绝对路径。npm 包名（`opencode-companion-prompt-craft`、`opencode-companion-go-usage`）是为将来发布预留的，目前请使用 Git 或本地路径安装。完整选项表见 [docs/configuration.md](docs/configuration.md)。

## 隐私

- 没有遥测、统计或第三方网络请求。
- prompt-craft 使用你已经选择的模型处理消息，不新增 provider。
- go-usage 只读本地 OpenCode 凭据数据库；access token 仅发送到 `https://opencode.ai/inference/go/v1/usage` 获取你自己的额度，不会打印或存储。

## 开发

```sh
npm install
npm run check
```

`npm run check` 会做 TypeScript 类型检查和单元测试。插件是纯 TypeScript，无构建步骤；桌面 GUI 部分是已提交的 CommonJS bundle：`plugins/go-usage/dist/gui-experimental.cjs`。

仓库结构、测试策略和发布清单见 [docs/development.md](docs/development.md)。

## 项目更名

本项目原名 `opencode-config`，现更名为 **OpenCode Companion**（`opencode-companion`），定位为专注的公开插件集合。旧 GitHub 地址会自动跳转。

## 许可证

[MIT](LICENSE) © 2026 jokerXYH
