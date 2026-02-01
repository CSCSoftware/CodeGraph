# AiDex

[![npm version](https://img.shields.io/npm/v/aidex-mcp.svg)](https://www.npmjs.com/package/aidex-mcp)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Node.js 18+](https://img.shields.io/badge/Node.js-18%2B-brightgreen.svg)](https://nodejs.org/)
[![MCP Server](https://img.shields.io/badge/MCP-Server-blue.svg)](https://modelcontextprotocol.io/)

**Stop wasting 80% of your AI's context window on code searches.**

AiDex is an MCP server that gives AI coding assistants instant access to your entire codebase through a persistent, pre-built index. Works with any MCP-compatible AI assistant: Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI, VS Code Copilot, and more.

<!-- TODO: Add demo GIF showing aidex_query vs grep -->

## The Problem

Every time your AI assistant searches for code, it:
- **Greps** through thousands of files → hundreds of results flood the context
- **Reads** file after file to understand the structure → more context consumed
- **Forgets** everything when the session ends → repeat from scratch

A single "Where is X defined?" question can eat 2,000+ tokens. Do that 10 times and you've burned half your context on navigation alone.

## The Solution

Index once, query forever:

```
# Before: grep flooding your context
AI: grep "PlayerHealth" → 200 hits in 40 files
AI: read File1.cs, File2.cs, File3.cs...
→ 2000+ tokens consumed, 5+ tool calls

# After: precise results, minimal context
AI: aidex_query({ term: "PlayerHealth" })
→ Engine.cs:45, Player.cs:23, UI.cs:156
→ ~50 tokens, 1 tool call
```

**Result: 50-80% less context used for code navigation.**

## Why Not Just Grep?

| | Grep/Ripgrep | AiDex |
|---|---|---|
| **Context usage** | 2000+ tokens per search | ~50 tokens |
| **Results** | All text matches | Only identifiers |
| **Precision** | `log` matches `catalog`, `logarithm` | `log` finds only `log` |
| **Persistence** | Starts fresh every time | Index survives sessions |
| **Structure** | Flat text search | Knows methods, classes, types |

**The real cost of grep**: Every grep result includes surrounding context. Search for `User` in a large project and you'll get hundreds of hits - comments, strings, partial matches. Your AI reads through all of them, burning context tokens on noise.

**AiDex indexes identifiers**: It uses Tree-sitter to actually parse your code. When you search for `User`, you get the class definition, the method parameters, the variable declarations - not every comment that mentions "user".

## How It Works

1. **Index your project once** (~1 second per 1000 files)
   ```
   aidex_init({ path: "/path/to/project" })
   ```

2. **AI searches the index instead of grepping**
   ```
   aidex_query({ term: "Calculate", mode: "starts_with" })
   → All functions starting with "Calculate" + exact line numbers

   aidex_query({ term: "Player", modified_since: "2h" })
   → Only matches changed in the last 2 hours
   ```

3. **Get file overviews without reading entire files**
   ```
   aidex_signature({ file: "src/Engine.cs" })
   → All classes, methods, and their signatures
   ```

The index lives in `.aidex/index.db` (SQLite) - fast, portable, no external dependencies.

## Features

- **Smart Extraction**: Uses Tree-sitter to parse code properly - indexes identifiers, not keywords
- **Method Signatures**: Get function prototypes without reading implementations
- **Project Summary**: Auto-detected entry points, main classes, language breakdown
- **Incremental Updates**: Re-index single files after changes
- **Cross-Project Links**: Query across multiple related projects
- **Time-based Filtering**: Find what changed in the last hour, day, or week
- **Project Structure**: Query all files (code, config, docs, assets) without filesystem access
- **Session Notes**: Leave reminders for the next session - persists in the database
- **Auto-Cleanup**: Excluded files (e.g., build outputs) are automatically removed from index

## Supported Languages

| Language | Extensions |
|----------|------------|
| C# | `.cs` |
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Rust | `.rs` |
| Python | `.py`, `.pyw` |
| C | `.c`, `.h` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx` |
| Java | `.java` |
| Go | `.go` |
| PHP | `.php` |
| Ruby | `.rb`, `.rake` |

## Quick Start

### 1. Install & Register

```bash
npm install -g aidex-mcp
aidex setup
```

`aidex setup` automatically detects and registers AiDex with your installed AI clients (Claude Code, Claude Desktop, Cursor, Windsurf, Gemini CLI, VS Code Copilot). To unregister: `aidex unsetup`.

### 2. Or register manually with your AI assistant

**For Claude Code** (`~/.claude/settings.json` or `~/.claude.json`):
```json
{
  "mcpServers": {
    "aidex": {
      "type": "stdio",
      "command": "aidex",
      "env": {}
    }
  }
}
```

**For Claude Desktop** (`%APPDATA%/Claude/claude_desktop_config.json` on Windows):
```json
{
  "mcpServers": {
    "aidex": {
      "command": "aidex"
    }
  }
}
```

> **Note:** Both `aidex` and `aidex-mcp` work as command names.

> **Important:** The server name in your config determines the MCP tool prefix. Use `"aidex"` as shown above — this gives you tool names like `aidex_query`, `aidex_signature`, etc. Using a different name (e.g., `"codegraph"`) would change the prefix accordingly.

**For Gemini CLI** (`~/.gemini/settings.json`):
```json
{
  "mcpServers": {
    "aidex": {
      "command": "aidex"
    }
  }
}
```

**For VS Code Copilot** (run `MCP: Open User Configuration` in Command Palette):
```json
{
  "servers": {
    "aidex": {
      "type": "stdio",
      "command": "aidex"
    }
  }
}
```

**For other MCP clients**: See your client's documentation for MCP server configuration.

### 3. Make your AI actually use it

Add to your AI's instructions (e.g., `~/.claude/CLAUDE.md` for Claude Code):

```markdown
## AiDex - Use for ALL code searches!

**Before using Grep/Glob, check if `.aidex/` exists in the project.**

If yes, use AiDex instead:
- `aidex_query` - Find functions, classes, variables by name
- `aidex_signature` - Get all methods in a file with line numbers
- `aidex_signatures` - Get methods from multiple files (glob pattern)
- `aidex_summary` - Project overview with entry points

If no `.aidex/` exists, offer to run `aidex_init` first.
```

### 4. Index your project

Ask your AI: *"Index this project with AiDex"*

Or manually in the AI chat:
```
aidex_init({ path: "/path/to/your/project" })
```

## Available Tools

| Tool | Description |
|------|-------------|
| `aidex_init` | Index a project (creates `.aidex/`) |
| `aidex_query` | Search by term (exact/contains/starts_with) |
| `aidex_signature` | Get one file's classes + methods |
| `aidex_signatures` | Get signatures for multiple files (glob) |
| `aidex_update` | Re-index a single changed file |
| `aidex_remove` | Remove a deleted file from index |
| `aidex_summary` | Project overview |
| `aidex_tree` | File tree with statistics |
| `aidex_describe` | Add documentation to summary |
| `aidex_link` | Link another indexed project |
| `aidex_unlink` | Remove linked project |
| `aidex_links` | List linked projects |
| `aidex_status` | Index statistics |
| `aidex_scan` | Find indexed projects in directory tree |
| `aidex_files` | List project files by type (code/config/doc/asset) |
| `aidex_note` | Read/write session notes (persists between sessions) |
| `aidex_session` | Start session, detect external changes, auto-reindex |
| `aidex_viewer` | Open interactive project tree in browser |

## Time-based Filtering

Track what changed recently with `modified_since` and `modified_before`:

```
aidex_query({ term: "render", modified_since: "2h" })   # Last 2 hours
aidex_query({ term: "User", modified_since: "1d" })     # Last day
aidex_query({ term: "API", modified_since: "1w" })      # Last week
```

Supported formats:
- **Relative**: `30m` (minutes), `2h` (hours), `1d` (days), `1w` (weeks)
- **ISO date**: `2026-01-27` or `2026-01-27T14:30:00`

Perfect for questions like *"What did I change in the last hour?"*

## Project Structure

AiDex indexes ALL files in your project (not just code), letting you query the structure:

```
aidex_files({ path: ".", type: "config" })  # All config files
aidex_files({ path: ".", type: "test" })    # All test files
aidex_files({ path: ".", pattern: "**/*.md" })  # All markdown files
aidex_files({ path: ".", modified_since: "30m" })  # Changed this session
```

File types: `code`, `config`, `doc`, `asset`, `test`, `other`, `dir`

Use `modified_since` to find files changed in this session - perfect for *"What did I edit?"*

## Session Notes

Leave reminders for the next session - no more losing context between chats:

```
aidex_note({ path: ".", note: "Test the glob fix after restart" })  # Write
aidex_note({ path: ".", note: "Also check edge cases", append: true })  # Append
aidex_note({ path: "." })                                              # Read
aidex_note({ path: ".", clear: true })                                 # Clear
```

**Use cases:**
- Before ending a session: *"Remember to test X next time"*
- AI auto-reminder: Save what to verify after a restart
- Handover notes: Context for the next session without editing config files

Notes are stored in the SQLite database (`.aidex/index.db`) and persist indefinitely.

## Interactive Viewer

Explore your indexed project visually in the browser:

```
aidex_viewer({ path: "." })
```

Opens `http://localhost:3333` with:
- **Interactive file tree** - Click to expand directories
- **File signatures** - Click any file to see its types and methods
- **Live reload** - Changes detected automatically while you code
- **Git status icons** - See which files are modified, staged, or untracked

Close with `aidex_viewer({ path: ".", action: "close" })`

## CLI Usage

```bash
aidex scan Q:/develop       # Find all indexed projects
aidex init ./myproject      # Index a project from command line
```

> `aidex-mcp` works as an alias for `aidex`.

## Performance

| Project | Files | Items | Index Time | Query Time |
|---------|-------|-------|------------|------------|
| Small (AiDex) | 19 | 1,200 | <1s | 1-5ms |
| Medium (RemoteDebug) | 10 | 1,900 | <1s | 1-5ms |
| Large (LibPyramid3D) | 18 | 3,000 | <1s | 1-5ms |
| XL (MeloTTS) | 56 | 4,100 | ~2s | 1-10ms |

## Technology

- **Parser**: [Tree-sitter](https://tree-sitter.github.io/) - Real parsing, not regex
- **Database**: SQLite with WAL mode - Fast, single file, zero config
- **Protocol**: [MCP](https://modelcontextprotocol.io/) - Works with any compatible AI

## Project Structure

```
.aidex/                  ← Created in YOUR project
├── index.db             ← SQLite database
└── summary.md           ← Optional documentation

AiDex/                   ← This repository
├── src/
│   ├── commands/        ← Tool implementations
│   ├── db/              ← SQLite wrapper
│   ├── parser/          ← Tree-sitter integration
│   └── server/          ← MCP protocol handler
└── build/               ← Compiled output
```

## Contributing

PRs welcome! Especially for:
- New language support
- Performance improvements
- Documentation

## License

MIT License - see [LICENSE](LICENSE)

## Authors

Uwe Chalas & Claude
