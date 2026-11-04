# Troubleshooting

## A plugin does not appear in `opencode plugin list`

- Check the spec spelling, including the `::path:` segment.
- Private forks require Git credentials that OpenCode can use.
- Run `opencode plugin add ...` again and read the error.
- If you installed by editing JSON, validate `opencode.jsonc` (trailing commas are allowed in JSONC, not in JSON).

## The desktop pill is missing

- The GUI part loads only from the **global** config, not a project config.
- Open **Settings → Extensions → Plugins**, find `go-usage`, and click **Reload**.
- Confirm the plugin appears in `opencode plugin list`.
- If the plugin throws during setup, the switch may turn off. Check the log.

## prompt-craft does not rewrite

| Check | Action |
| --- | --- |
| Message shorter than `minChars` | Normal; short replies are passed through. |
| Message starts with `/` or `!` | Commands are passed through. |
| Message is a greeting or confirmation | Passed through by design. |
| Message already contains the five labels | Passed through by design. |
| Message longer than `maxChars` | Raise `maxChars` or use `/craft`. |
| Model unavailable or timing out | Set `debug: true`, inspect the log, or raise `timeoutMs`. |
| Cooldown after a failure | Wait for `cooldownMs`, or send `/craft`. |

Use `/craft <request>` to bypass every heuristic.

## prompt-craft changed my `@file` mentions

Inline mention markers are cleared because rewriting changes character offsets. The attached files are kept. If you need exact `@file` positions, disable prompt-craft for that message with `enabled: false` or prefix the message with `/craft` only when you do not need mentions.

## go-usage says the database is missing

The plugin looks for:

```text
$XDG_DATA_HOME/opencode/opencode.db
~/.local/share/opencode/opencode.db   (when XDG_DATA_HOME is unset)
```

Start OpenCode once so it creates the database, or set `XDG_DATA_HOME` to the correct parent directory.

## go-usage says there is no active account

Sign in with `/connect` or:

```sh
opencode auth login
```

Then reload the plugin.

## go-usage shows HTTP 401 or 403

The stored access token is stale or revoked. Sign out and sign in again in OpenCode. The plugin does not refresh credentials itself; it uses the active credential stored by OpenCode.

## go-usage has no session numbers

Session numbers appear after at least one assistant message in the current session. A brand-new session shows "暂无记录".

## The plugin worked, then stopped after an OpenCode upgrade

The plugin API is versioned with OpenCode. This repository targets OpenCode 2.2.5+. Check the log for a setup error, then open an issue with:

- OpenCode version (`opencode --version`)
- plugin version or commit
- the relevant lines from `~/.local/share/opencode/log/opencode.log`, with tokens and prompts removed

## Logs

```text
~/.local/share/opencode/log/opencode.log
```

On Windows:

```text
%USERPROFILE%\.local\share\opencode\log\opencode.log
```

Use `OPENCODE_LOG_LEVEL=DEBUG` for one reproduction. Redact credentials and message contents before sharing.

## Full reload

```sh
opencode service restart
```

In the desktop app, restarting also reloads GUI parts.
