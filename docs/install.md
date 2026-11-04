# Install

## Requirements

- OpenCode 2.2.5 or newer (desktop or CLI)
- Node.js 22+ only for development; OpenCode ships its own runtime for normal use
- An OpenCode Go subscription for `go-usage` (prompt-craft works with any model)

## Option A — install from GitHub (recommended)

The OpenCode CLI accepts npm-compatible Git specifications, including a repository subdirectory selector:

```sh
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft'
opencode plugin add 'github:jokerXYH/opencode-companion#main::path:plugins/go-usage'
```

Check the result:

```sh
opencode plugin list
```

You should see:

```text
ID            VERSION  SOURCE
prompt-craft  ...      github:jokerXYH/opencode-companion#...
go-usage      ...      github:jokerXYH/opencode-companion#...
```

Then reload:

- Desktop: restart the app once, or open **Settings → Extensions → Plugins** and click **Reload**.
- CLI/TUI: run `/reload`.

To pin a release, use a tag or commit instead of `#main`:

```sh
opencode plugin add 'github:jokerXYH/opencode-companion#v1.0.1::path:plugins/prompt-craft'
```

## Option B — local checkout

```sh
git clone https://github.com/jokerXYH/opencode-companion.git
```

Add absolute paths to the **global** config so the desktop GUI parts load:

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

Windows example:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": [
    "C:/Users/you/opencode-companion/plugins/prompt-craft",
    "C:/Users/you/opencode-companion/plugins/go-usage"
  ]
}
```

Relative paths resolve from the config file that contains the entry. They are supported, but absolute paths are less surprising when the config is global.

## Option C — automatic discovery

OpenCode discovers direct plugin directories under:

```text
~/.config/opencode/plugins/<name>/
<project>/.opencode/plugins/<name>/
```

Copy or symlink the two plugin directories there:

```sh
mkdir -p ~/.config/opencode/plugins
cp -R plugins/prompt-craft ~/.config/opencode/plugins/
cp -R plugins/go-usage ~/.config/opencode/plugins/
```

Discovery is convenient for development, but the desktop pill still requires the plugin to be present in the config that the desktop app loads. For a normal install, prefer Option A or B.

## Verify

1. `opencode plugin list` shows both IDs.
2. The `go_usage` tool appears in a session, or the desktop composer shows the Go usage pill.
3. `/craft 给游戏加个存档` rewrites the request before sending.

## Upgrade

```sh
opencode plugin update
opencode plugin list
```

For a local checkout, run `git pull`, then reload. Local plugin changes are not always watched; run `opencode service restart` if the new code does not load.

## Uninstall

```sh
opencode plugin remove 'github:jokerXYH/opencode-companion#main::path:plugins/prompt-craft'
opencode plugin remove 'github:jokerXYH/opencode-companion#main::path:plugins/go-usage'
```

The argument is the configured package specifier, not the plugin ID. For local paths, delete the entries from `opencode.jsonc` and remove the directories.

## Platform notes

### Windows

- Configuration: `%USERPROFILE%\.config\opencode\opencode.jsonc`
- Data: `%USERPROFILE%\.local\share\opencode\opencode.db`
- Logs: `%USERPROFILE%\.local\share\opencode\log\opencode.log`
- Use forward slashes in JSON paths, or escape backslashes.

### macOS / Linux

- Respect `XDG_CONFIG_HOME` and `XDG_DATA_HOME` when set.
- Otherwise use `~/.config/opencode` and `~/.local/share/opencode`.

### Remote or standalone servers

Plugins run in the OpenCode server. If you connect the TUI to a remote server, install the plugin on that server, not only on the local machine. Desktop GUI parts always come from the local desktop app's global configuration.
