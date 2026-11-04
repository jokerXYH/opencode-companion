# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-11-04

### Added

- Public release as **OpenCode Companion** (`opencode-companion`).
- `prompt-craft` plugin: structured prompt rewriting, `/craft`, skip heuristics, timeout, cooldown, and debug logging.
- `go-usage` plugin: `go_usage` tool, typed RPC, desktop composer pill, peak/off-peak status, quota, session cache hit rate, spend, and warnings.
- Configurable timezone, peak windows, workdays, and warnings for `go-usage`.
- Unit tests for the pure helpers in both plugins.
- Type checking and tests in CI on Windows and Linux.
- Install, configuration, development, troubleshooting, security, and contribution docs.

### Changed

- Renamed the project from `opencode-config` to `opencode-companion`.
- Package names changed to `opencode-companion-go-usage` and `opencode-companion-prompt-craft` to avoid an npm name collision.
- `go-usage` now respects `XDG_DATA_HOME` and reports a clear error when the OpenCode database or credential is missing.
- `go-usage` session schema errors no longer hide account quota data.
- Removed personal configuration, the duplicate Python CLI, sync scripts, and the unrelated game-design skill from the public repository.

[Unreleased]: https://github.com/jokerXYH/opencode-companion/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/jokerXYH/opencode-companion/releases/tag/v1.0.0
