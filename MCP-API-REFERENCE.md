# AiDex MCP API Reference

Complete reference for all AiDex MCP tools.

---

## Table of Contents

- [Indexing](#indexing)
  - [aidex_init](#aidex_init)
  - [aidex_update](#aidex_update)
  - [aidex_remove](#aidex_remove)
- [Querying](#querying)
  - [aidex_query](#aidex_query)
  - [aidex_signature](#aidex_signature)
  - [aidex_signatures](#aidex_signatures)
- [Project Info](#project-info)
  - [aidex_status](#aidex_status)
  - [aidex_summary](#aidex_summary)
  - [aidex_tree](#aidex_tree)
  - [aidex_files](#aidex_files)
  - [aidex_describe](#aidex_describe)
- [Cross-Project](#cross-project)
  - [aidex_link](#aidex_link)
  - [aidex_unlink](#aidex_unlink)
  - [aidex_links](#aidex_links)
  - [aidex_scan](#aidex_scan)
- [Session Management](#session-management)
  - [aidex_session](#aidex_session)
  - [aidex_note](#aidex_note)
  - [aidex_viewer](#aidex_viewer)
- [Task Management](#task-management)
  - [aidex_task](#aidex_task)
  - [aidex_tasks](#aidex_tasks)
- [Screenshots](#screenshots)
  - [aidex_screenshot](#aidex_screenshot)
  - [aidex_windows](#aidex_windows)

---

## Indexing

### aidex_init

Initialize or re-index a project. Creates `.aidex/` directory with SQLite database.

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

### aidex_update

Re-index a single file after editing. Detects unchanged files via hash comparison.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_remove

Remove a deleted file from the index.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_query

Search for terms/identifiers in the index. **Primary search tool** - use instead of grep/glob.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_signature

Get the signature of a single file: types, methods, header comments. **Use instead of reading entire files** when you only need structure.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_signatures

Get signatures for multiple files at once using glob pattern. Efficient for exploring codebase structure.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_status

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

### aidex_summary

Get project overview including auto-detected entry points and main types.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |

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

### aidex_tree

Get file tree with optional statistics per file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_files

List all project files by type. Includes non-code files (config, docs, assets). Supports time-based filtering to find recently changed files.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
| `type` | string | - | Filter by type: `dir`, `code`, `config`, `doc`, `asset`, `test`, `other` |
| `pattern` | string | - | Glob pattern filter (e.g., `"**/*.md"`, `"src/**/*.ts"`) |
| `modified_since` | string | - | Only files indexed after this time. Formats: `30m`, `2h`, `1d`, `1w`, or ISO date |

**Returns:**
- Files grouped by directory
- Type statistics
- Indexed indicator (✓) for code files
- `lastIndexed` timestamp (when `modified_since` is used)

**Examples:**
```json
// All config files
{ "path": ".", "type": "config" }

// All markdown files
{ "path": ".", "pattern": "**/*.md" }

// All test files
{ "path": ".", "type": "test" }

// Files changed in the last 30 minutes (this session)
{ "path": ".", "modified_since": "30m" }

// Files changed in the last 2 hours
{ "path": ".", "modified_since": "2h" }
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

### aidex_describe

Add or update sections in the project summary (`summary.md`).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_link

Link another indexed project as a dependency. Enables cross-project queries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to current project |
| `dependency` | string | ✅ | Path to dependency project (must have `.aidex`) |
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

### aidex_unlink

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

### aidex_links

List all linked dependencies.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |

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

### aidex_scan

Find all projects with AiDex indexes in a directory tree.

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

### aidex_session

Start or continue a session. **Call at the start of every new chat session!**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |

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
`aidex_query({ term: "...", modified_since: "1706349600000", modified_before: "1706358600000" })`

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

### aidex_note

Read or write session notes. Persists in the database between sessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
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

### aidex_viewer

Open an interactive project tree viewer in the browser. Provides visual exploration with live updates.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
| `action` | string | - | `open` (default) or `close` |

**Features:**

- **Interactive file tree** - Click directories to expand, click files to view signatures
- **Live reload** - File changes detected automatically via chokidar file watcher
- **Signature display** - Shows types (classes, interfaces) and methods with line numbers
- **WebSocket updates** - Real-time sync between file changes and browser

**Server:**
- Runs on `http://localhost:3333`
- Persistent until explicitly closed or MCP server restart

**Examples:**
```json
// Open viewer
{ "path": "." }

// Close viewer
{ "path": ".", "action": "close" }
```

**Output example:**
```
🖥️ Viewer opened at http://localhost:3333
```

---

## Task Management

### aidex_task

Manage a single task in the project backlog. Tasks persist in the AiDex database and survive between sessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
| `action` | string | ✅ | `create`, `read`, `update`, `delete`, or `log` |
| `id` | number | for read/update/delete/log | Task ID |
| `title` | string | for create | Task title |
| `description` | string | - | Task description (optional details) |
| `priority` | number | - | `1` = high, `2` = medium (default), `3` = low |
| `status` | string | - | `backlog` (default), `active`, `done`, `cancelled` |
| `tags` | string | - | Comma-separated tags (e.g., `"bug, viewer"`) |
| `source` | string | - | Where the task came from (e.g., `"code review of parser.ts:142"`) |
| `sort_order` | number | - | Sort order within same priority (lower = first, default: 0) |
| `note` | string | for log | Log note text |

**Actions:**

| Action | Required params | Description |
|--------|----------------|-------------|
| `create` | `title` | Create a new task |
| `read` | `id` | Get task details + history log |
| `update` | `id` | Change any field (title, status, priority, etc.) |
| `delete` | `id` | Permanently remove a task |
| `log` | `id`, `note` | Add a note to the task history |

**Auto-logging:** Status changes and task creation are automatically recorded in the task history.

**Examples:**
```json
// Create a high-priority bug task
{
  "path": ".", "action": "create",
  "title": "Fix memory leak in parser",
  "priority": 1, "tags": "bug, parser"
}

// Read task with history
{ "path": ".", "action": "read", "id": 1 }

// Mark as done
{ "path": ".", "action": "update", "id": 1, "status": "done" }

// Cancel a task
{ "path": ".", "action": "update", "id": 2, "status": "cancelled" }

// Add a log note
{ "path": ".", "action": "log", "id": 1, "note": "Root cause found: unbounded buffer" }
```

---

### aidex_tasks

List and filter tasks in the project backlog. Returns tasks grouped by status and sorted by priority.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | string | ✅ | Path to project with `.aidex` directory |
| `status` | string | - | Filter: `backlog`, `active`, `done`, `cancelled` |
| `priority` | number | - | Filter: `1`, `2`, `3` |
| `tag` | string | - | Filter by tag (matches any task containing this tag) |

**Returns:**
- Tasks grouped by status (Active → Backlog → Done → Cancelled)
- Priority icons: 🔴 high, 🟡 medium, ⚪ low
- Tags displayed inline

**Examples:**
```json
// All tasks
{ "path": "." }

// Only active tasks
{ "path": ".", "status": "active" }

// High priority bugs
{ "path": ".", "priority": 1, "tag": "bug" }
```

---

## Screenshots

### aidex_screenshot

Take a screenshot of the screen, a window, or an interactive region selection. Returns the file path so you can immediately `Read` the image. **No project index required.**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mode` | string | - | `fullscreen` (default), `active_window`, `window`, `region` |
| `window_title` | string | for mode=window | Window title substring to match (use `aidex_windows` to find titles) |
| `monitor` | number | - | Monitor index (0-based, default: primary). Only for fullscreen mode |
| `delay` | number | - | Seconds to wait before capturing (e.g., `3` to switch windows first) |
| `filename` | string | - | Custom filename (default: `aidex-screenshot.png`). Overwrites if exists |
| `save_path` | string | - | Custom directory (default: system temp directory) |

**Capture Modes:**

| Mode | Description | Platform tools |
|------|-------------|----------------|
| `fullscreen` | Entire screen (primary monitor or selected) | PowerShell / screencapture / maim |
| `active_window` | Currently focused window | Win32 API / screencapture / xdotool+maim |
| `window` | Specific window by title substring | EnumWindows / osascript / xdotool |
| `region` | User draws a rectangle interactively | WinForms overlay / screencapture -i / maim -s |

**Returns:**
- `file_path`: Absolute path to the saved PNG file
- `mode`: Which capture mode was used
- `monitor`: Which monitor was captured (if specified)

**Examples:**

```json
// Fullscreen (default)
{}

// Active window
{ "mode": "active_window" }

// Specific window by title
{ "mode": "window", "window_title": "Visual Studio Code" }

// Interactive region selection
{ "mode": "region" }

// Fullscreen with delay and custom path
{ "delay": 3, "filename": "bug-report.png", "save_path": "/tmp/screenshots" }

// Second monitor
{ "monitor": 1 }
```

**Platform Requirements:**

| Platform | Required | Optional |
|----------|----------|----------|
| Windows | PowerShell (built-in) | - |
| macOS | screencapture (built-in) | osascript (built-in) |
| Linux | maim OR scrot | xdotool, wmctrl, slop (for region) |

---

### aidex_windows

List all open windows with their titles, PIDs, and process names. Use to find window titles for `aidex_screenshot` with `mode="window"`. **No project index required.**

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filter` | string | - | Substring to filter window titles (case-insensitive) |

**Returns:**
- List of windows with `title`, `pid`, `process_name`
- Platform identifier

**Examples:**

```json
// All windows
{}

// Filter by title
{ "filter": "chrome" }

// Find a specific app
{ "filter": "Visual Studio" }
```

**Output example:**
```
# Open Windows (5)

Platform: win32

- **Visual Studio Code** (Code) [PID: 1234]
- **Chrome - Google** (chrome) [PID: 5678]
- **Windows Terminal** (WindowsTerminal) [PID: 9012]
```

---

## Time Format Reference

Used by `aidex_query` parameters `modified_since` and `modified_before`:

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

SQLite database at `.aidex/index.db`:

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
| `tasks` | Project backlog tasks (priority, status, tags, timestamps) |
| `task_log` | Task history log (auto-logged status changes + manual notes) |

---

## Best Practices

1. **Start sessions with `aidex_session`** - Detects external changes automatically
2. **Use `aidex_query` instead of grep** - 50x less tokens, precise results
3. **Use `aidex_signature` instead of reading files** - Get structure without implementation
4. **Leave session notes** - Context persists between chat sessions
5. **Re-index after edits** - Call `aidex_update` for modified files
6. **Link related projects** - Query across multiple codebases
