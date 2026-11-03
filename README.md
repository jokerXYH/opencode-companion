# opencode-config-sync

个人 OpenCode 配置、go-usage 与 prompt-craft 插件源码。**不包含任何 token 或登录凭据**（凭据保存在本机 `~/.local/share/opencode/opencode.db`，不要提交）。

## 在新电脑上恢复

1. 安装 OpenCode 桌面版
2. 把本仓库的文件复制到 `~/.config/opencode/`（保持目录结构）：
   - `cli.json`、`opencode.json`、`cache-hit.json`
   - `go-usage.py`、`go-usage.cmd`
   - `plugins/go-usage/`、`plugins/prompt-craft/`
3. 在 OpenCode 里登录 OpenCode Console（`/connect` 或 `opencode auth login`）
4. 设置 → 扩展 → 插件 → 对应插件 → Reload

## prompt-craft

消息发送前用当前模型把随手写的一句话补成「目标 / 上下文 / 约束 / 验收 / 不做」五段式，再交给 agent。配置项见 `plugins/prompt-craft/README.md`；不想用时把 `opencode.json` 里对应那条删掉，或设 `"options": { "enabled": false }`。

## 注意

- `plugins/go-usage/rpc.cjs` 与 `dist/gui-experimental.cjs` 中的 RPC 定义必须保持一致，修改时两处都要改。
- 路径与账号都从本机读取，换电脑不需要改代码。
- `sync.cmd` 会原样复制 `plugins/` 下所有插件目录，新增插件不用再改脚本。
