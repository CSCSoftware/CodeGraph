# CodeGraph

**Stop wasting 80% of your AI's context window on code searches.**

CodeGraph is an MCP server that gives AI coding assistants instant access to your entire codebase through a persistent, pre-built index. Works with any MCP-compatible AI assistant: Claude Code, Cursor, Windsurf, Continue.dev, and more.

<!-- TODO: Add demo GIF showing codegraph_query vs grep -->

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
AI: codegraph_query({ term: "PlayerHealth" })
→ Engine.cs:45, Player.cs:23, UI.cs:156
→ ~50 tokens, 1 tool call
```

**Result: 50-80% less context used for code navigation.**

## How It Works

1. **Index your project once** (~1 second per 1000 files)
   ```
   codegraph_init({ path: "/path/to/project" })
   ```

2. **AI searches the index instead of grepping**
   ```
   codegraph_query({ term: "Calculate", mode: "starts_with" })
   → All functions starting with "Calculate" + exact line numbers
   ```

3. **Get file overviews without reading entire files**
   ```
   codegraph_signature({ file: "src/Engine.cs" })
   → All classes, methods, and their signatures
   ```

The index lives in `.codegraph/index.db` (SQLite) - fast, portable, no external dependencies.

## Features

- **Smart Extraction**: Uses Tree-sitter to parse code properly - indexes identifiers, not keywords
- **Method Signatures**: Get function prototypes without reading implementations
- **Project Summary**: Auto-detected entry points, main classes, language breakdown
- **Incremental Updates**: Re-index single files after changes
- **Cross-Project Links**: Query across multiple related projects

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

### 1. Install

```bash
git clone https://github.com/CSCSoftware/CodeGraph.git
cd CodeGraph
npm install && npm run build
```

### 2. Register with your AI assistant

**For Claude Code CLI** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/CodeGraph/build/index.js"],
      "env": {}
    }
  }
}
```

**For Claude Desktop** (`%APPDATA%/Claude/claude_desktop_config.json` on Windows):
```json
{
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["/path/to/CodeGraph/build/index.js"]
    }
  }
}
```

**For other MCP clients**: See your client's documentation for MCP server configuration.

### 3. Make your AI actually use it

Add to your AI's instructions (e.g., `~/.claude/CLAUDE.md` for Claude Code):

```markdown
## CodeGraph - Use for ALL code searches!

**Before using Grep/Glob, check if `.codegraph/` exists in the project.**

If yes, use CodeGraph instead:
- `codegraph_query` - Find functions, classes, variables by name
- `codegraph_signature` - Get all methods in a file with line numbers
- `codegraph_signatures` - Get methods from multiple files (glob pattern)
- `codegraph_summary` - Project overview with entry points

If no `.codegraph/` exists, offer to run `codegraph_init` first.
```

### 4. Index your project

Ask your AI: *"Index this project with CodeGraph"*

Or manually in the AI chat:
```
codegraph_init({ path: "/path/to/your/project" })
```

## Available Tools

| Tool | Description |
|------|-------------|
| `codegraph_init` | Index a project (creates `.codegraph/`) |
| `codegraph_query` | Search by term (exact/contains/starts_with) |
| `codegraph_signature` | Get one file's classes + methods |
| `codegraph_signatures` | Get signatures for multiple files (glob) |
| `codegraph_update` | Re-index a single changed file |
| `codegraph_remove` | Remove a deleted file from index |
| `codegraph_summary` | Project overview |
| `codegraph_tree` | File tree with statistics |
| `codegraph_describe` | Add documentation to summary |
| `codegraph_link` | Link another indexed project |
| `codegraph_unlink` | Remove linked project |
| `codegraph_links` | List linked projects |
| `codegraph_status` | Index statistics |
| `codegraph_scan` | Find indexed projects in directory tree |

## CLI Usage

```bash
node build/index.js scan Q:/develop   # Find all indexed projects
node build/index.js init ./myproject  # Index a project from command line
```

## Performance

| Project | Files | Items | Index Time | Query Time |
|---------|-------|-------|------------|------------|
| Small (CodeGraph) | 19 | 1,200 | <1s | 1-5ms |
| Medium (RemoteDebug) | 10 | 1,900 | <1s | 1-5ms |
| Large (LibPyramid3D) | 18 | 3,000 | <1s | 1-5ms |
| XL (MeloTTS) | 56 | 4,100 | ~2s | 1-10ms |

## Technology

- **Parser**: [Tree-sitter](https://tree-sitter.github.io/) - Real parsing, not regex
- **Database**: SQLite with WAL mode - Fast, single file, zero config
- **Protocol**: [MCP](https://modelcontextprotocol.io/) - Works with any compatible AI

## Project Structure

```
.codegraph/              ← Created in YOUR project
├── index.db             ← SQLite database
└── summary.md           ← Optional documentation

CodeGraph/               ← This repository
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
