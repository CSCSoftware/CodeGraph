# Contributing to AiDex

Thank you for your interest in contributing! AiDex is a community-driven project and we welcome all kinds of contributions.

## Ways to Contribute

- **Bug reports** — Found something broken? [Open an issue](https://github.com/CSCSoftware/AiDex/issues/new?template=bug_report.yml)
- **Feature requests** — Have an idea? [Start a Discussion](https://github.com/CSCSoftware/AiDex/discussions/new?category=ideas)
- **Code contributions** — PRs are welcome (see below)
- **Language support** — Add keyword filters for new languages in `src/parser/languages/`
- **Documentation** — Improve README, add examples, fix typos
- **Share your setup** — Tell us how you use AiDex in [Show & Tell](https://github.com/CSCSoftware/AiDex/discussions/new?category=show-and-tell)

## Before You Start

1. **Check existing issues and discussions** to avoid duplicates
2. **For larger changes** — open a Discussion or issue first to align on the approach
3. **For bug fixes** — a PR is always welcome, no prior discussion needed

## Development Setup

```bash
git clone https://github.com/CSCSoftware/AiDex.git
cd AiDex
npm install
npm run build
```

After changes:
```bash
npm run build   # Recompile TypeScript
```

Register the local build in your MCP client (Claude Code `~/.claude/settings.json`):
```json
{
  "mcpServers": {
    "aidex": {
      "command": "node",
      "args": ["/path/to/AiDex/build/index.js"]
    }
  }
}
```

## Project Structure

```
src/
├── commands/        # Tool implementations (one file per tool)
├── parser/          # Tree-sitter + language keyword filters
├── db/              # SQLite schema + queries
├── server/          # MCP protocol + tool handler
└── viewer/          # Interactive browser UI
```

Adding a new language? Drop a keyword file in `src/parser/languages/` — look at an existing one for the format.

## Pull Request Guidelines

- Keep PRs focused — one feature or fix per PR
- Update `CHANGELOG.md` with a brief description under `[Unreleased]`
- If you add a new tool, document it in `MCP-API-REFERENCE.md`
- TypeScript — match the existing code style (no strict enforcement, just consistency)

## Reporting Security Issues

Please **do not** open a public issue for security vulnerabilities. Contact us directly at `u.chalas@csc-software.de`.

## Questions?

Head over to [GitHub Discussions](https://github.com/CSCSoftware/AiDex/discussions) — we're happy to help.
