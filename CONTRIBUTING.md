# Contributing

Thanks for helping improve OpenCode Companion.

## Before you start

- Open an issue for behavior changes or new options so the scope can be agreed first.
- Keep the project focused: two OpenCode plugins and their docs, tests, and optional skill. Unrelated tooling belongs in another repository.
- Never include credentials, tokens, personal paths, or local configuration in a commit.

## Setup

```sh
git clone https://github.com/jokerXYH/opencode-companion.git
cd opencode-companion
npm install
npm run check
```

## Making a change

1. Create a branch: `git checkout -b fix/short-description`.
2. Add or update tests for behavior changes.
3. Run `npm run check`.
4. If you changed the GUI bundle, install the plugin from a real config and confirm the pill still works.
5. Open a pull request with a short description and the verification you ran.

## Code style

- TypeScript, ES modules, no semicolons, double quotes (match the existing files).
- Keep pure logic in `lib.ts` or `rewrite.ts` so it can be tested without OpenCode.
- Plugin entry files should stay small and fail open: a plugin bug must not block messages or lose data.
- Do not add runtime dependencies that OpenCode does not already provide.

## Plugin-specific notes

### prompt-craft

- The rewrite prompt, skip rules, and output cleanup are separate concerns. Keep `rewrite.ts` pure.
- Never make the hook throw. Catch every error and send the original message.

### go-usage

- Treat the OpenCode database as read-only and never log its contents.
- The access token is only for the usage request. Do not store it.
- `dist/gui-experimental.cjs` duplicates the RPC contract by design. Update it whenever `rpc.ts` changes.
- Verify the usage endpoint and database schema assumptions against a real OpenCode Go install.

## Commit messages

Use a short imperative subject, optionally with a conventional prefix:

```text
feat(go-usage): add configurable peak windows
fix(prompt-craft): keep original text when rewrite is empty
docs: clarify global vs project plugin config
test: cover timezone boundaries
```

## Reporting security issues

Do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contribution is licensed under the [MIT License](LICENSE).
