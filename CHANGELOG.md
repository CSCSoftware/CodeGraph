# Changelog

All notable changes to AiDex will be documented in this file.

## [1.4.0] - 2026-01-31

### Breaking Changes
- **Renamed from CodeGraph to AiDex**: Package name, MCP server name, and all internal references updated
  - MCP prefix changes from `mcp__codegraph__` to `mcp__aidex__` (requires config update)
  - Index directory changed from `.codegraph/` to `.aidex/`
  - Batch scripts renamed: `codegraph-scan.bat` → `aidex-scan.bat`, `codegraph-init-all.bat` → `aidex-init-all.bat`
  - Old `.codegraph/` directories can be safely deleted

### Added
- **Automatic Cleanup**: `aidex_init` now removes files that became excluded (e.g., build outputs)
  - Reports `filesRemoved` count in result
  - Uses minimatch for proper glob pattern matching
- **Git Status in Viewer**: File tree now shows git status with cat icons
  - 🟢 Pushed (committed and up-to-date)
  - 🟡 Modified (uncommitted changes)
  - 🔵 Staged (added to index)
  - ⚪ Untracked (new files)
- **aidex-init-all.bat**: New batch script to recursively index all git projects in a directory tree

### Changed
- Added minimatch dependency for exclude pattern handling
- Updated all documentation (README, CLAUDE.md, MCP-API-REFERENCE) with correct MCP prefix info

## [1.3.0] - 2026-01-27

### Added
- **Interactive Viewer**: New `aidex_viewer` tool opens a browser-based project explorer
  - Interactive file tree (click to expand directories)
  - Click files to view signatures (types, methods)
  - Tabs: Code files / All files, Overview / Source code
  - **Live reload** with chokidar file watcher
  - WebSocket for real-time updates
  - Syntax highlighting with highlight.js
  - Runs on `http://localhost:3333`
- **Recent Files Filter**: New `modified_since` parameter for `aidex_files`
  - Find files changed in current session: `modified_since: "30m"`
  - Supports relative time (`2h`, `1d`, `1w`) and ISO dates

### Changed
- Viewer auto-reindexes changed files before refreshing tree

### Fixed
- Server version now correctly reports 1.3.0

## [1.2.0] - 2026-01-27

### Added
- **Session Notes**: New `aidex_note` tool to persist reminders between sessions
  - Write, append, read, and clear notes
  - Stored in SQLite database (survives restarts)
  - Use cases: handover notes, test reminders, context for next session
- **Session Tracking**: New `aidex_session` tool for automatic session management
  - Detects new sessions (>5 min since last activity)
  - Records session start/end times
  - Detects files modified externally (outside sessions)
  - Auto-reindexes changed files on session start
  - Returns session note if one exists

### Changed
- Database schema: Added `metadata` table for key-value storage (session times, notes)

## [1.1.0] - 2026-01-27

### Added
- **Time-based Filtering**: New `modified_since` and `modified_before` parameters for `aidex_query`
  - Relative time: `30m`, `2h`, `1d`, `1w`
  - ISO dates: `2026-01-27` or `2026-01-27T14:30:00`
  - Track line-level changes across updates
- **Project Structure**: New `aidex_files` tool to query all project files
  - File types: `code`, `config`, `doc`, `asset`, `test`, `other`, `dir`
  - Glob pattern filtering
  - Statistics by file type

### Changed
- `aidex_init` now indexes complete project structure (all files, not just code)
- `aidex_update` preserves modification timestamps for unchanged lines (hash-based diff)
- Path normalization to forward slashes across all commands

### Technical
- New `project_files` table in database schema
- New `line_hash` and `modified` columns in `lines` table
- Hash-based change detection for accurate timestamps

## [1.0.0] - 2026-01-27

### Added
- **11 Language Support**: C#, TypeScript, JavaScript, Rust, Python, C, C++, Java, Go, PHP, Ruby
- **Core Tools**:
  - `aidex_init` - Index a project
  - `aidex_query` - Search terms (exact/contains/starts_with)
  - `aidex_signature` - Get file signatures (methods, types)
  - `aidex_signatures` - Batch signatures with glob patterns
  - `aidex_update` - Re-index single files
  - `aidex_remove` - Remove files from index
  - `aidex_summary` - Project overview with auto-detected entry points
  - `aidex_tree` - File tree with statistics
  - `aidex_describe` - Add documentation to summary
  - `aidex_status` - Index statistics
- **Cross-Project Support**:
  - `aidex_link` - Link dependency projects
  - `aidex_unlink` - Remove linked projects
  - `aidex_links` - List all linked projects
- **Discovery**:
  - `aidex_scan` - Find all indexed projects in directory tree
  - CLI commands: `scan`, `init`
- **Technical**:
  - Tree-sitter parsing for accurate identifier extraction
  - SQLite with WAL mode for fast, reliable storage
  - Keyword filtering per language (excludes language keywords from index)
  - 1MB parser buffer for large files

### Infrastructure
- MCP Server protocol implementation
- MIT License
- Comprehensive documentation
