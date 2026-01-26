# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeGraph is an **MCP Server Tool** that provides Claude Code with a persistent, local index system per project. Instead of grep/read through thousands of files on every search, CodeGraph pre-indexes:

- **Items:** All meaningful terms (identifiers, not language keywords)
- **Signatures:** Quick file profiles (prototypes + header comments)
- **Summary:** Project description (auto + manual)
- **Dependencies:** Links to other indexed projects for cross-project queries

## Build & Development

```bash
npm install              # Install dependencies
npm run build            # Compile TS and copy schema.sql to build/
npm run watch            # Watch mode for development
npm run clean && npm run build   # Clean rebuild
npm test                 # Run tests (uses --experimental-vm-modules for ESM)
```

**After code changes:** Run `npm run build`, then restart Claude Code for the MCP server to pick up changes.

**Debug MCP server:** Check stderr output - MCP uses stdin/stdout for protocol, all logging goes to stderr.

## MCP Server Registration

Registered in `~/.claude/settings.json`:
```json
"codegraph": {
  "command": "node",
  "args": ["Q:/develop/Tools/CodeGraph/build/index.js"]
}
```

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `codegraph_init` | Initialize/index a project |
| `codegraph_query` | Search terms (exact/contains/starts_with) |
| `codegraph_status` | Get project statistics |
| `codegraph_signature` | Get signature of a single file |
| `codegraph_signatures` | Get signatures for multiple files (glob pattern) |
| `codegraph_update` | Re-index a single file after editing |
| `codegraph_remove` | Remove file from index |
| `codegraph_summary` | Get project summary (auto-detected + manual) |
| `codegraph_tree` | Get indexed file tree with optional stats |
| `codegraph_describe` | Add/update sections in summary.md |
| `codegraph_link` | Link dependency project |
| `codegraph_unlink` | Remove linked dependency |
| `codegraph_links` | List all linked dependencies |
| `codegraph_scan` | Find all .codegraph directories in a path |

## CLI Commands

```bash
node build/index.js              # Start MCP server (default)
node build/index.js scan <path>  # Find indexed projects
node build/index.js init <path>  # Index a project
```

**Batch files:**
- `codegraph-scan.bat <path>` - Find all indexed projects
- `codegraph-init-all.bat <path>` - Index all subdirectories that don't have .codegraph yet

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

## Architecture

```
src/
├── index.ts              # MCP Server entry point
├── server/
│   ├── mcp-server.ts     # MCP Protocol handler
│   └── tools.ts          # Tool definitions + handlers (main logic)
├── db/
│   ├── schema.sql        # SQLite schema (copied to build/ during build)
│   ├── database.ts       # SQLite wrapper (CodeGraphDatabase class)
│   └── queries.ts        # Prepared statements
├── parser/
│   ├── tree-sitter.ts    # Parser initialization (1MB buffer for large files)
│   ├── extractor.ts      # Main extractor (extractIdentifiers, extractSignature)
│   └── languages/        # Keyword filters per language (11 languages)
└── commands/
    ├── init.ts           # codegraph_init
    ├── query.ts          # codegraph_query
    ├── signature.ts      # codegraph_signature(s)
    ├── update.ts         # codegraph_update, codegraph_remove
    ├── summary.ts        # codegraph_summary, codegraph_tree, codegraph_describe
    ├── link.ts           # codegraph_link, codegraph_unlink, codegraph_links
    └── scan.ts           # codegraph_scan
```

## Database Schema

SQLite with WAL mode. Key tables:
- `files` - File tree with path, hash, last_indexed
- `lines` - Line objects with composite key (file_id, id)
- `items` - Indexed terms (case-insensitive)
- `occurrences` - Item locations (item_id, file_id, line_id)
- `signatures` - Header comments per file
- `methods` - Method prototypes
- `types` - Class/struct/interface definitions
- `dependencies` - Links to other CodeGraph instances

## Key Implementation Details

### Tree-sitter Parser
- Uses 1MB buffer (`src/parser/tree-sitter.ts:99`) to handle large files (default 32KB crashes)
- Each language has its own keyword filter in `src/parser/languages/` to exclude language keywords from indexing

### Re-indexing
- Before re-indexing, existing file data is cleared (`src/db/database.ts:144-146`) to avoid UNIQUE constraint errors

### Glob Pattern Matching
- `**/` prefix generates `(.*/)?` regex to match both root and nested paths (`src/commands/query.ts:165-183`)

## Key Documentation

| File | Purpose |
|------|---------|
| `CODEGRAPH-SPEC.md` | Complete specification (~1500 lines) |
| `IMPLEMENTATION-PLAN.md` | Phased implementation roadmap |

## Validated Projects

### Original Languages (C#, TypeScript, Rust, Python)
| Project | Language | Files | Items | Methods | Types |
|---------|----------|-------|-------|---------|-------|
| CodeGraph | TypeScript | 19 | ~1200 | ~90 | ~30 |
| RemoteDebug/Server | C# | 10 | 1911 | 146 | 27 |
| LibPyramid3D/core | Rust | 18 | 3009 | 174 | 79 |
| MeloTTS/melo | Python | 56 | 4122 | 363 | 44 |

### New Languages (C, C++, Java, Go, PHP, Ruby)
Tested with real open-source projects in `SampleLangProjects/`:

| Project | Language | Files | Items | Methods | Types |
|---------|----------|-------|-------|---------|-------|
| cJSON | C | 117 | 4,061 | 1,649 | 60 |
| nlohmann/json | C++ | 488 | 8,525 | 6,776 | 548 |
| minimal-json | Java | 55 | 1,643 | 990 | 63 |
| gjson | Go | 2 | 880 | 190 | 9 |
| php-jwt | PHP | 11 | 984 | 162 | 13 |
| ruby-jwt | Ruby | 81 | 1,174 | 248 | 0 |

### Feature Tests Passed
- **codegraph_scan**: Finds all indexed projects in directory tree
- **codegraph_link**: Links projects, no duplicates on re-link, graceful unlink
- **codegraph_update**: Detects hash match, adds new items, removes deleted items
- **Keyword filtering**: Language keywords excluded from index, identifiers included
