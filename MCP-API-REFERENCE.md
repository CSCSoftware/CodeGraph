# CodeGraph MCP API Reference

Complete reference for all CodeGraph MCP tools.

---

## Table of Contents

- [Indexing](#indexing)
  - [codegraph_init](#codegraph_init)
  - [codegraph_update](#codegraph_update)
  - [codegraph_remove](#codegraph_remove)
- [Querying](#querying)
  - [codegraph_query](#codegraph_query)
  - [codegraph_signature](#codegraph_signature)
  - [codegraph_signatures](#codegraph_signatures)
- [Project Info](#project-info)
  - [codegraph_status](#codegraph_status)
  - [codegraph_summary](#codegraph_summary)
  - [codegraph_tree](#codegraph_tree)
  - [codegraph_files](#codegraph_files)
  - [codegraph_describe](#codegraph_describe)
- [Cross-Project](#cross-project)
  - [codegraph_link](#codegraph_link)
  - [codegraph_unlink](#codegraph_unlink)
  - [codegraph_links](#codegraph_links)
  - [codegraph_scan](#codegraph_scan)
- [Session Management](#session-management)
  - [codegraph_session](#codegraph_session)
  - [codegraph_note](#codegraph_note)

---

## Indexing

### codegraph_init

Initialize or re-index a project. Creates `.codegraph/` directory with SQLite database.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Absolute path to the project directory |
| `name` | string | - | Custom project name (default: directory name) |
| `exclude` | string[] | - | Additional glob patterns to exclude (e.g., `["**/test/**"]`) |

**Returns:**
- Files indexed count
- Items/methods/types found
- Duration in ms
- Warnings (if any)

**Example:**
```json
{
  "path": "/home/user/myproject",
  "exclude": ["**/vendor/**", "**/dist/**"]
}
```

---

### codegraph_update

Re-index a single file after editing. Detects unchanged files via hash comparison.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `file` | string | ✅ | Relative path to file within project |

**Returns:**
- Items added/removed
- Methods/types updated
- Duration in ms
- "File unchanged" if hash matches

**Example:**
```json
{
  "path": "/home/user/myproject",
  "file": "src/Engine.cs"
}
```

---

### codegraph_remove

Remove a deleted file from the index.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `file` | string | ✅ | Relative path to file to remove |

**Returns:**
- Success/failure status
- Items removed count

**Example:**
```json
{
  "path": "/home/user/myproject",
  "file": "src/OldFile.cs"
}
```

---

## Querying

### codegraph_query

Search for terms/identifiers in the index. **Primary search tool** - use instead of grep/glob.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `term` | string | ✅ | The term to search for |
| `mode` | string | - | Search mode: `exact` (default), `contains`, `starts_with` |
| `file_filter` | string | - | Glob pattern to filter files (e.g., `"src/commands/**"`) |
| `type_filter` | string[] | - | Filter by line type: `code`, `comment`, `method`, `struct`, `property` |
| `modified_since` | string | - | Only matches after this time. Formats: `2h`, `30m`, `1d`, `1w`, or ISO date |
| `modified_before` | string | - | Only matches before this time. Same formats as above |
| `limit` | number | - | Maximum results (default: 100) |

**Returns:**
- Matches grouped by file with line numbers and types
- Total match count
- Truncation indicator if limit reached

**Examples:**

```json
// Find exact term
{ "path": ".", "term": "PlayerHealth" }

// Find anything containing "Update"
{ "path": ".", "term": "Update", "mode": "contains" }

// Find recent changes
{ "path": ".", "term": "render", "modified_since": "2h" }

// Filter by file location
{ "path": ".", "term": "API", "file_filter": "src/server/**" }

// Filter by code type
{ "path": ".", "term": "Calculate", "type_filter": ["method"] }
```

---

### codegraph_signature

Get the signature of a single file: types, methods, header comments. **Use instead of reading entire files** when you only need structure.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `file` | string | ✅ | Relative path to file (e.g., `"src/Core/Engine.cs"`) |

**Returns:**
- Header comments (if any)
- Types: classes, structs, interfaces, enums with line numbers
- Methods: prototypes with visibility, static/async modifiers, line numbers

**Example:**
```json
{
  "path": "/home/user/myproject",
  "file": "src/Core/Engine.cs"
}
```

**Output example:**
```
# Signature: src/Core/Engine.cs

## Header Comments
Game engine core implementation

## Types (2)
- class Engine (line 15)
- struct Config (line 8)

## Methods (5)
- [public] void Initialize() :20
- [public async] Task LoadAsync(string path) :45
- [private] void Update(float delta) :78
```

---

### codegraph_signatures

Get signatures for multiple files at once using glob pattern. Efficient for exploring codebase structure.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `pattern` | string | - | Glob pattern (e.g., `"src/**/*.cs"`, `"**/*.ts"`) |
| `files` | string[] | - | Explicit list of file paths (alternative to pattern) |

*Note: Provide either `pattern` OR `files`, not both.*

**Returns:**
- Compact summary per file: types and method counts
- Method list with modifiers and line numbers

**Examples:**
```json
// All TypeScript files
{ "path": ".", "pattern": "**/*.ts" }

// Specific directory
{ "path": ".", "pattern": "src/commands/**/*.ts" }

// Explicit file list
{ "path": ".", "files": ["src/index.ts", "src/server/tools.ts"] }
```

---

## Project Info

### codegraph_status

Get index statistics for a project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | - | Path to project (optional - shows server status if omitted) |

**Returns:**
- Schema version
- Counts: files, lines, items, occurrences, methods, types, dependencies
- Database size in bytes
- Database path

**Example:**
```json
{ "path": "/home/user/myproject" }
```

---

### codegraph_summary

Get project overview including auto-detected entry points and main types.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |

**Returns:**
- Project name
- Language breakdown
- Entry points (main files, index files)
- Main types (most referenced classes)
- Custom summary content (from `summary.md`)

**Example:**
```json
{ "path": "/home/user/myproject" }
```

---

### codegraph_tree

Get file tree with optional statistics per file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `subpath` | string | - | Subdirectory to list (default: project root) |
| `depth` | number | - | Maximum depth to traverse (default: unlimited) |
| `include_stats` | boolean | - | Include item/method/type counts per file |

**Returns:**
- Hierarchical file tree
- Optional: counts per file

**Examples:**
```json
// Full tree
{ "path": "." }

// Specific directory with stats
{ "path": ".", "subpath": "src/commands", "include_stats": true }

// Shallow tree
{ "path": ".", "depth": 2 }
```

---

### codegraph_files

List all project files by type. Includes non-code files (config, docs, assets).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `type` | string | - | Filter by type: `dir`, `code`, `config`, `doc`, `asset`, `test`, `other` |
| `pattern` | string | - | Glob pattern filter (e.g., `"**/*.md"`, `"src/**/*.ts"`) |

**Returns:**
- Files grouped by directory
- Type statistics
- Indexed indicator (✓) for code files

**Examples:**
```json
// All config files
{ "path": ".", "type": "config" }

// All markdown files
{ "path": ".", "pattern": "**/*.md" }

// All test files
{ "path": ".", "type": "test" }
```

**File type detection:**

| Type | Extensions/Patterns |
|------|---------------------|
| `code` | `.cs`, `.ts`, `.js`, `.py`, `.rs`, `.go`, `.java`, `.c`, `.cpp`, `.php`, `.rb` |
| `config` | `.json`, `.yaml`, `.yml`, `.toml`, `.xml`, `.ini`, `.env` |
| `doc` | `.md`, `.txt`, `.rst`, `.adoc` |
| `asset` | `.png`, `.jpg`, `.svg`, `.ico`, `.woff`, `.ttf` |
| `test` | Files in `test/`, `tests/`, `__tests__/` or with `.test.`, `.spec.` |
| `other` | Everything else |

---

### codegraph_describe

Add or update sections in the project summary (`summary.md`).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `section` | string | ✅ | Section to update: `purpose`, `architecture`, `concepts`, `patterns`, `notes` |
| `content` | string | ✅ | Content to add |
| `replace` | boolean | - | Replace existing content (default: append) |

**Example:**
```json
{
  "path": ".",
  "section": "architecture",
  "content": "This project uses a layered architecture with commands, services, and repositories.",
  "replace": true
}
```

---

## Cross-Project

### codegraph_link

Link another indexed project as a dependency. Enables cross-project queries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to current project |
| `dependency` | string | ✅ | Path to dependency project (must have `.codegraph`) |
| `name` | string | - | Display name for the dependency |

**Returns:**
- Link status
- Files available in dependency

**Example:**
```json
{
  "path": "/home/user/myapp",
  "dependency": "/home/user/shared-lib",
  "name": "SharedLib"
}
```

---

### codegraph_unlink

Remove a linked dependency.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to current project |
| `dependency` | string | ✅ | Path to dependency to unlink |

**Example:**
```json
{
  "path": "/home/user/myapp",
  "dependency": "/home/user/shared-lib"
}
```

---

### codegraph_links

List all linked dependencies.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |

**Returns:**
- List of linked projects with:
  - Name
  - Path
  - File count
  - Availability status

**Example:**
```json
{ "path": "/home/user/myapp" }
```

---

### codegraph_scan

Find all projects with CodeGraph indexes in a directory tree.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Root path to scan |
| `max_depth` | number | - | Maximum depth to scan (default: 10) |

**Returns:**
- List of indexed projects with:
  - Name
  - Path
  - Statistics (files, items, methods, types)
  - Last indexed timestamp

**Example:**
```json
{
  "path": "/home/user/projects",
  "max_depth": 5
}
```

---

## Session Management

### codegraph_session

Start or continue a session. **Call at the start of every new chat session!**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |

**What it does:**

1. **Detects new session** - If >5 minutes since last activity
2. **Records session times** - Stores `last_session_start` and `last_session_end`
3. **Detects external changes** - Files modified outside sessions (hash comparison)
4. **Auto-reindexes** - Modified files are automatically updated
5. **Returns session note** - If one exists

**Returns:**
- `isNewSession`: boolean
- `sessionInfo`: last session start/end times, current session start
- `externalChanges`: list of modified/deleted files
- `reindexed`: list of auto-reindexed files
- `note`: session note (if set)

**Example:**
```json
{ "path": "." }
```

**Output example:**
```
🆕 **New Session Started**

## Last Session
- **Start:** 2026-01-27T10:00:00.000Z
- **End:** 2026-01-27T12:30:00.000Z
- **Duration:** 2h 30m

💡 Query last session changes with:
`codegraph_query({ term: "...", modified_since: "1706349600000", modified_before: "1706358600000" })`

## External Changes Detected
Found 3 file(s) changed outside of session:

- ✏️ src/index.ts (modified)
- ✏️ src/utils.ts (modified)
- 🗑️ src/old-file.ts (deleted)

✅ Auto-reindexed 2 file(s)

## 📝 Session Note
Test the new feature after restart
```

---

### codegraph_note

Read or write session notes. Persists in the database between sessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.codegraph` directory |
| `note` | string | - | Note to save. If omitted, reads current note |
| `append` | boolean | - | Append to existing note instead of replacing (default: false) |
| `clear` | boolean | - | Clear the note (default: false) |

**Operations:**

| Parameters | Action |
|------------|--------|
| `{ path }` | Read current note |
| `{ path, note: "..." }` | Write/replace note |
| `{ path, note: "...", append: true }` | Append to note |
| `{ path, clear: true }` | Delete note |

**Examples:**
```json
// Read note
{ "path": "." }

// Write note
{ "path": ".", "note": "Test glob fix after restart" }

// Append to note
{ "path": ".", "note": "Also check edge cases", "append": true }

// Clear note
{ "path": ".", "clear": true }
```

---

## Time Format Reference

Used by `codegraph_query` parameters `modified_since` and `modified_before`:

| Format | Example | Meaning |
|--------|---------|---------|
| Minutes | `30m` | 30 minutes ago |
| Hours | `2h` | 2 hours ago |
| Days | `1d` | 1 day ago |
| Weeks | `1w` | 1 week ago |
| ISO Date | `2026-01-27` | Specific date (midnight) |
| ISO DateTime | `2026-01-27T14:30:00` | Specific date and time |
| Unix timestamp | `1706349600000` | Milliseconds since epoch |

---

## Supported Languages

| Language | Extensions | Parser |
|----------|------------|--------|
| C# | `.cs` | tree-sitter-c-sharp |
| TypeScript | `.ts`, `.tsx` | tree-sitter-typescript |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` | tree-sitter-javascript |
| Rust | `.rs` | tree-sitter-rust |
| Python | `.py`, `.pyw` | tree-sitter-python |
| C | `.c`, `.h` | tree-sitter-c |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx` | tree-sitter-cpp |
| Java | `.java` | tree-sitter-java |
| Go | `.go` | tree-sitter-go |
| PHP | `.php` | tree-sitter-php |
| Ruby | `.rb`, `.rake` | tree-sitter-ruby |

---

## Database Schema

SQLite database at `.codegraph/index.db`:

| Table | Purpose |
|-------|---------|
| `files` | Indexed files with path, hash, last_indexed timestamp |
| `lines` | Line objects with type (code/comment/method/struct) and hash |
| `items` | Unique terms/identifiers (case-insensitive) |
| `occurrences` | Term locations (item_id, file_id, line_id) |
| `signatures` | Header comments per file |
| `methods` | Method prototypes with visibility, static/async flags |
| `types` | Classes, structs, interfaces, enums |
| `dependencies` | Linked projects |
| `project_files` | All files with type classification |
| `metadata` | Key-value store (session times, notes, etc.) |

---

## Best Practices

1. **Start sessions with `codegraph_session`** - Detects external changes automatically
2. **Use `codegraph_query` instead of grep** - 50x less tokens, precise results
3. **Use `codegraph_signature` instead of reading files** - Get structure without implementation
4. **Leave session notes** - Context persists between chat sessions
5. **Re-index after edits** - Call `codegraph_update` for modified files
6. **Link related projects** - Query across multiple codebases
