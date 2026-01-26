# CodeGraph

**Persistent Code Indexing for Claude Code**

## The Problem

When Claude Code (Anthropic's AI assistant) works with a software project, it must:

1. **Grep** through thousands of files for every search
2. **Read hundreds of lines** to understand context
3. **Fill up the context window** with search results
4. **Forget everything** when starting a new session

For an unfamiliar project, Claude must explore the entire structure, find entry points, read countless files - consuming time and context tokens.

## The Solution

CodeGraph is a **local index service** that extracts all relevant information from a project once and stores it in a SQLite database:

- **Items:** All identifiers (variables, functions, classes) - but no language keywords like `if`, `class`, `public`
- **Signatures:** Quick profiles of each file (classes, method prototypes, header comments)
- **Project Summary:** Automatically detected entry points, main classes, languages used
- **Dependencies:** Links to other projects for cross-project queries

## Before vs. After

**Before:**
```
Claude: "I'm looking for PlayerHealth..."
→ grep "PlayerHealth" → 200 hits in 40 files
→ read File1.cs → read File2.cs → read File3.cs...
→ 5+ minutes, lots of context consumed
```

**After:**
```
Claude: codegraph_query({ term: "PlayerHealth" })
→ Engine.cs:45 (code)
→ Engine.cs:892 (comment)
→ Player.cs:23 (code)
→ Done. Three precise locations in milliseconds.
```

**Understanding an unfamiliar project - Before:**
```
ls → tree → grep "main" → read Program.cs → read Engine.cs...
→ 5+ minutes, lots of context consumed
```

**After:**
```
codegraph_summary() → Instant overview
codegraph_signatures({ pattern: "src/Core/**" }) → All classes and methods
→ 10 seconds, minimal context
```

## How It Works

### 1. Indexing (once per project)

```
codegraph_init({ path: "/path/to/MyProject" })
```

CodeGraph scans all source files and extracts using **Tree-sitter** (a parser framework):
- All identifiers and where they occur
- Method signatures (prototypes only, not implementation)
- Classes, structs, interfaces
- Header comments

The result is stored in `.codegraph/index.db` (SQLite).

### 2. Searching

```
codegraph_query({ term: "Calculate", mode: "starts_with" })
```

Finds all identifiers starting with "Calculate" - in milliseconds instead of seconds.

### 3. File Signatures

```
codegraph_signature({ file: "src/Core/Engine.cs" })
```

Instantly returns:
- Header comments of the file
- All classes/structs
- All method prototypes with line numbers

Without reading the entire file.

### 4. Update After Changes

```
codegraph_update({ file: "src/Core/Engine.cs" })
```

Updates only the changed file - no need to re-index the whole project.

## Supported Languages

| Language | File Types |
|----------|------------|
| C# | `.cs` |
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Rust | `.rs` |
| Python | `.py`, `.pyw` |

## Technology

- **Runtime:** Node.js / TypeScript
- **Parser:** Tree-sitter (understands 100+ languages, distinguishes identifiers from keywords)
- **Database:** SQLite with WAL mode (fast, single file, no dependencies)
- **Integration:** MCP (Model Context Protocol) - the standard for Claude Code tools

## Installation

CodeGraph runs as an MCP server and is registered with Claude Code.

1. Clone the repository
2. `npm install && npm run build`
3. Add to your `~/.claude.json` (for Claude Code CLI):

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

4. Restart Claude Code

## Making Claude Actually Use CodeGraph

**Important:** Just installing the MCP server isn't enough - you need to tell Claude when to use it!

Add this to your global `~/.claude/CLAUDE.md`:

```markdown
### CodeGraph (MCP Server) - ALWAYS USE FIRST!
**Persistent code index for fast searches.** Registered as MCP server `codegraph`.

**CRITICAL - FOR EVERY CODE SEARCH:**
1. **FIRST check:** Does `.codegraph/` exist in the project?
2. **If yes:** Use `codegraph_query` INSTEAD of Grep/Glob!
3. **If no:** Offer to run `codegraph_init` once, then use it

**NEVER use Grep/Glob for code searches when .codegraph/ exists!**

**CodeGraph knows all functions/methods with signatures!**
- `codegraph_query` finds function names: term="Calculate", mode="starts_with" → all Calculate* methods
- `codegraph_signature` shows ALL methods of a file with parameters and line numbers
- `codegraph_signatures` with pattern="src/*.cs" → methods from multiple files

**Example questions → CodeGraph tool:**
- "Where is X calculated?" → `codegraph_query` with term="X" or mode="contains"
- "What methods does class Y have?" → `codegraph_signature` for the file
- "Show me all Update functions" → `codegraph_query` term="Update" mode="starts_with"
- "What does this file do?" → `codegraph_signature`
- "Project overview" → `codegraph_summary` + `codegraph_tree`
```

## Available Tools

| Tool | Description |
|------|-------------|
| `codegraph_init` | Index a project |
| `codegraph_query` | Search terms (exact/contains/starts_with) |
| `codegraph_signature` | Get signature of a single file |
| `codegraph_signatures` | Get signatures of multiple files (glob pattern) |
| `codegraph_update` | Re-index a single file |
| `codegraph_remove` | Remove file from index |
| `codegraph_summary` | Get project overview |
| `codegraph_tree` | Get file tree with statistics |
| `codegraph_describe` | Add project documentation |
| `codegraph_link` | Link dependency project |
| `codegraph_unlink` | Remove linked dependency |
| `codegraph_links` | List linked projects |
| `codegraph_status` | Get index statistics |

## Example Workflow

```typescript
// 1. Index a new project
codegraph_init({ path: "/home/user/MyProject" })
// → 150 files indexed, 5000 items found

// 2. Understand the project
codegraph_summary({ path: "..." })
// → Entry Points: Program.cs, Main classes: GameEngine, Player, Enemy

// 3. Search precisely
codegraph_query({ term: "Damage", mode: "contains" })
// → CalculateDamage in Engine.cs:156, TakeDamage in Player.cs:89, ...

// 4. View signature
codegraph_signature({ file: "src/Core/Engine.cs" })
// → class GameEngine, void Initialize(), void Update(float dt), ...

// 5. Update after changes
codegraph_update({ file: "src/Core/Engine.cs" })
// → 3 new items, 1 removed
```

## Performance

| Project | Language | Files | Items | Indexing Time |
|---------|----------|-------|-------|---------------|
| CodeGraph | TypeScript | 19 | ~1200 | <1s |
| RemoteDebug | C# | 10 | 1900 | <1s |
| LibPyramid3D | Rust | 18 | 3000 | <1s |
| MeloTTS | Python | 56 | 4100 | ~2s |

Searches typically take 1-10ms.

## Project Structure

```
.codegraph/           ← Created in your project
├── index.db          ← SQLite database
└── summary.md        ← Optional project documentation

CodeGraph/            ← This repository
├── src/
│   ├── commands/     ← Tool implementations
│   ├── db/           ← SQLite wrapper
│   ├── parser/       ← Tree-sitter integration
│   └── server/       ← MCP server
└── build/            ← Compiled output
```

## License

MIT

## Authors

Uwe Chalas & Claude (Rudi)
