# Changelog

All notable changes to CodeGraph will be documented in this file.

## [1.3.0] - 2026-01-27

### Added
- **Interactive Viewer**: New `codegraph_viewer` tool opens a browser-based project explorer
  - Interactive file tree (click to expand directories)
  - Click files to view signatures (types, methods)
  - Tabs: Code files / All files, Overview / Source code
  - **Live reload** with chokidar file watcher
  - WebSocket for real-time updates
  - Syntax highlighting with highlight.js
  - Runs on `http://localhost:3333`
- **Recent Files Filter**: New `modified_since` parameter for `codegraph_files`
  - Find files changed in current session: `modified_since: "30m"`
  - Supports relative time (`2h`, `1d`, `1w`) and ISO dates

### Changed
- Viewer auto-reindexes changed files before refreshing tree

### Fixed
- Server version now correctly reports 1.3.0

## [1.2.0] - 2026-01-27

### Added
- **Session Notes**: New `codegraph_note` tool to persist reminders between sessions
  - Write, append, read, and clear notes
  - Stored in SQLite database (survives restarts)
  - Use cases: handover notes, test reminders, context for next session
- **Session Tracking**: New `codegraph_session` tool for automatic session management
  - Detects new sessions (>5 min since last activity)
  - Records session start/end times
  - Detects files modified externally (outside sessions)
  - Auto-reindexes changed files on session start
  - Returns session note if one exists

### Changed
- Database schema: Added `metadata` table for key-value storage (session times, notes)

## [1.1.0] - 2026-01-27

### Added
- **Time-based Filtering**: New `modified_since` and `modified_before` parameters for `codegraph_query`
  - Relative time: `30m`, `2h`, `1d`, `1w`
  - ISO dates: `2026-01-27` or `2026-01-27T14:30:00`
  - Track line-level changes across updates
- **Project Structure**: New `codegraph_files` tool to query all project files
  - File types: `code`, `config`, `doc`, `asset`, `test`, `other`, `dir`
  - Glob pattern filtering
  - Statistics by file type

### Changed
- `codegraph_init` now indexes complete project structure (all files, not just code)
- `codegraph_update` preserves modification timestamps for unchanged lines (hash-based diff)
- Path normalization to forward slashes across all commands

### Technical
- New `project_files` table in database schema
- New `line_hash` and `modified` columns in `lines` table
- Hash-based change detection for accurate timestamps

## [1.0.0] - 2026-01-27

### Added
- **11 Language Support**: C#, TypeScript, JavaScript, Rust, Python, C, C++, Java, Go, PHP, Ruby
- **Core Tools**:
  - `codegraph_init` - Index a project
  - `codegraph_query` - Search terms (exact/contains/starts_with)
  - `codegraph_signature` - Get file signatures (methods, types)
  - `codegraph_signatures` - Batch signatures with glob patterns
  - `codegraph_update` - Re-index single files
  - `codegraph_remove` - Remove files from index
  - `codegraph_summary` - Project overview with auto-detected entry points
  - `codegraph_tree` - File tree with statistics
  - `codegraph_describe` - Add documentation to summary
  - `codegraph_status` - Index statistics
- **Cross-Project Support**:
  - `codegraph_link` - Link dependency projects
  - `codegraph_unlink` - Remove linked projects
  - `codegraph_links` - List all linked projects
- **Discovery**:
  - `codegraph_scan` - Find all indexed projects in directory tree
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
