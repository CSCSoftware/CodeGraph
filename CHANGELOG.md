# Changelog

All notable changes to CodeGraph will be documented in this file.

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
