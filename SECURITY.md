# Security Policy

## Supported versions

Security fixes are provided for the latest release on `main`. Please upgrade before reporting an issue if you are on an older commit.

## Reporting a vulnerability

Please do not open a public issue for a vulnerability. Use GitHub's private vulnerability reporting:

<https://github.com/jokerXYH/opencode-companion/security/advisories/new>

Include:

- affected plugin and version/commit
- OpenCode version and platform
- reproduction steps
- impact, especially if credentials or local files are involved
- any suggested fix

You will get an acknowledgement as soon as possible. Please allow time for a fix and release before public disclosure.

## Credential handling

`go-usage` reads the active OpenCode credential from the local OpenCode database in read-only mode. The access token is sent only to:

```text
https://opencode.ai/inference/go/v1/usage
```

The plugin does not log, cache, or persist the token. It has no telemetry and makes no other network requests.

`prompt-craft` sends your message to the model selected in OpenCode, using OpenCode's own generation API. It does not add a provider or a network endpoint.

## Repository hygiene

- No tokens, credentials, cookies, private keys, or personal configuration belong in this repository.
- Run `npm run check` before opening a pull request.
- Redact prompts, logs, account identifiers, and tokens from issues and screenshots.

## Dependency policy

The plugins rely on `@opencode/plugin`, which OpenCode provides at runtime. New runtime dependencies should be avoided; if one is unavoidable, explain why in the pull request and check its license.
