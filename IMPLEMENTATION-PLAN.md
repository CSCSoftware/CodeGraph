# CodeGraph - Implementation Plan

> **Created:** January 25, 2026
> **Updated:** January 26, 2026
> **Status:** Phase 1-10 Complete, Extensions Partially Done
> **Goal:** Functional MCP Server for Claude Code

---

## Phase 1: Project Setup ✅

### 1.1 Initialize Node.js Project
- [x] Create `package.json`
- [x] Configure TypeScript (`tsconfig.json`)
- [x] Set up ESLint + Prettier
- [x] Define build scripts

### 1.2 Install Dependencies
```
@modelcontextprotocol/sdk    # MCP Server SDK
better-sqlite3               # SQLite (synchronous, fast)
tree-sitter                  # Parser engine
tree-sitter-c-sharp          # C# grammar
tree-sitter-typescript       # TypeScript grammar
glob                         # File pattern matching
```

### 1.3 Create Directory Structure
```
src/
├── index.ts
├── server/
├── db/
├── parser/
├── commands/
└── utils/
```

**Phase 1 Result:** ✅ Project compiles, empty MCP server starts.

---

## Phase 2: Database Layer ✅

### 2.1 Implement SQLite Schema
- [x] Copy `src/db/schema.sql` from spec
- [x] Create `src/db/database.ts` wrapper class
- [x] Migration system (for future schema updates)

### 2.2 Prepared Statements
- [x] `src/db/queries.ts` - All SQL queries as prepared statements
- [x] CRUD for: files, lines, items, occurrences, signatures, methods, types

### 2.3 Testing
- [x] Unit tests for database operations
- [x] Test fixture: Small SQLite DB with sample data

**Phase 2 Result:** ✅ Database can be created, populated, and queried.

---

## Phase 3: Parser System ✅

### 3.1 Tree-sitter Integration
- [x] `src/parser/tree-sitter.ts` - Initialize tree-sitter
- [x] Load languages (C#, TypeScript initially)

### 3.2 Keyword Filters
- [x] `src/parser/languages/csharp.ts` - C# keywords
- [x] `src/parser/languages/typescript.ts` - TypeScript keywords
- [x] `src/parser/languages/index.ts` - Language registry

### 3.3 Extractor
- [x] `src/parser/extractor.ts` - Main extractor
  - Traverse AST
  - Extract identifiers (excluding keywords)
  - Classify line types
  - Collect items + occurrences

### 3.4 Signature Extraction
- [x] `src/parser/signature.ts`
  - Collect header comments
  - Extract method prototypes
  - Capture classes/structs

### 3.5 Testing
- [x] Unit tests with sample source files
- [x] Test: Parse C# file → Are items correct?
- [x] Test: Is signature extraction correct?

**Phase 3 Result:** ✅ Source files can be parsed, items/signatures are extracted.

---

## Phase 4: First MCP Tool - `codegraph_init` ✅

### 4.1 MCP Server Foundation
- [x] `src/server/mcp-server.ts` - Server class
- [x] `src/server/tools.ts` - Tool registration
- [x] `src/index.ts` - Entry point

### 4.2 Implement Init Command
- [x] `src/commands/init.ts`
  - Validate project directory
  - Create `.codegraph/` directory
  - Initialize `index.db`
  - Find all source files (glob)
  - Parse and index each file
  - Create `summary.md` (auto-generated)
  - Import CLAUDE.md files → `docs.md`

### 4.3 Testing
- [x] Integration test: `codegraph_init` on test project
- [x] Check: All files indexed?
- [x] Check: Items correct?
- [x] Check: Signatures correct?

**Phase 4 Result:** ✅ `codegraph_init` works, project can be indexed.

---

## Phase 5: Query Tool ✅

### 5.1 Implement Query Command
- [x] `src/commands/query.ts`
  - Exact match
  - Contains match
  - Starts-with match
  - Optional: Regex match

### 5.2 Result Formatting
- [x] Return filename + line number + type
- [x] Limit parameter
- [x] File filter (glob pattern)

### 5.3 Testing
- [x] Query "PlayerHealth" → finds matches
- [x] Query "Player" mode=contains → finds PlayerHealth, PlayerManager, etc.

**Phase 5 Result:** ✅ Terms can be searched.

---

## Phase 6: Signature Tools ✅

### 6.1 Signature Command
- [x] `src/commands/signature.ts`
  - Retrieve single file signature
  - Formatted output

### 6.2 Signatures Command (Batch)
- [x] Retrieve multiple signatures at once (glob pattern)

### 6.3 Testing
- [x] Retrieve signature for known file
- [x] Retrieve all signatures in `src/Core/`

**Phase 6 Result:** ✅ File signatures are retrievable.

---

## Phase 7: Update Mechanism ✅

### 7.1 Update Command
- [x] `src/commands/update.ts`
  - Re-index entire file
  - Or: Only line range (from_line, to_line)

### 7.2 Incremental Update
- [x] Remove old data for affected lines
- [x] Insert new data
- [x] Calculate offset and adjust line numbers

### 7.3 Remove Command
- [x] `src/commands/remove.ts`
  - Remove file from index (CASCADE)

### 7.4 Testing
- [x] Modify file → Update → Query finds new terms
- [x] Insert lines → Offset correct?

**Phase 7 Result:** ✅ Index can be updated.

---

## Phase 8: Additional Tools ✅

### 8.1 Summary Tools
- [x] `src/commands/summary.ts` - Retrieve summary
- [x] `src/commands/describe.ts` - Add to summary

### 8.2 Tree Tool
- [x] `src/commands/tree.ts` - Retrieve file tree

### 8.3 Link Tool
- [x] `src/commands/link.ts` - Link dependencies
- [x] Implement cross-project query

### 8.4 Status Tool
- [x] `src/commands/status.ts` - Retrieve statistics

### 8.5 Scan Tool (Added)
- [x] `src/commands/scan.ts` - Find all .codegraph directories
- [x] CLI command: `node build/index.js scan <path>`

### 8.6 Docs Tool
- [ ] `src/commands/docs.ts` - Retrieve CLAUDE.md contents
- [ ] `codegraph_update_docs` - Re-import

**Phase 8 Result:** ✅ All planned tools are functional (except docs tool).

---

## Phase 9: Integration & Polish ✅

### 9.1 MCP Server Registration
- [x] Instructions for `~/.claude.json`
- [x] Test: Server starts in Claude Code

### 9.2 Error Handling
- [x] Catch all edge cases
- [x] Helpful error messages

### 9.3 Performance Optimization
- [x] Test with large projects (1000+ files)
- [x] Batch insert for initial indexing
- [x] Check query performance

### 9.4 Documentation
- [x] Create README.md
- [x] Document example workflows
- [x] Translate to English for public release

**Phase 9 Result:** ✅ Production-ready MCP server.

---

## Phase 10: First Real-World Usage ✅

### 10.1 Test with Real Project
- [x] Index LibPyramid3D (Rust)
- [x] Index BreakoutDX12 (C#)
- [x] Index AiFramework projects (10 projects)
- [x] Link dependencies (BreakoutDX12 → AiLog)

### 10.2 Incorporate Feedback
- [x] What works well? → All core features
- [x] What's missing? → More languages (done!)
- [x] What's too slow? → Nothing significant

**Phase 10 Result:** ✅ Tested with real projects, all features working.

---

## Optional Extensions

- [x] **Additional Languages:** C, C++, Java, Go, PHP, Ruby (6 new languages!)
- [ ] **Git Integration:** Auto-update after commits
- [ ] **Call Graph:** Who calls whom?
- [ ] **Vector Embeddings:** Semantic search
- [ ] **VS Code Extension:** Auto-update on save
- [ ] **Web Dashboard:** Visualization

---

## Completed Summary

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Setup | ✅ Complete | |
| Phase 2: Database | ✅ Complete | |
| Phase 3: Parser | ✅ Complete | 11 languages supported |
| Phase 4: Init | ✅ Complete | CLI + MCP |
| Phase 5: Query | ✅ Complete | |
| Phase 6: Signatures | ✅ Complete | |
| Phase 7: Update | ✅ Complete | Tested with file changes |
| Phase 8: Additional Tools | ✅ Complete | scan tool added |
| Phase 9: Polish | ✅ Complete | English docs, README |
| Phase 10: Testing | ✅ Complete | 10+ real projects |

---

## Test Results (January 26, 2026)

### Languages Tested
| Language | Project | Files | Items | Status |
|----------|---------|-------|-------|--------|
| C | cJSON | 117 | 4,061 | ✅ |
| C++ | nlohmann/json | 488 | 8,525 | ✅ |
| Java | minimal-json | 55 | 1,643 | ✅ |
| Go | gjson | 2 | 880 | ✅ |
| PHP | php-jwt | 11 | 984 | ✅ |
| Ruby | ruby-jwt | 81 | 1,174 | ✅ |

### Features Tested
- ✅ `codegraph_scan` - Finds all indexed projects
- ✅ `codegraph_link` - Links/unlinks projects correctly
- ✅ `codegraph_update` - Detects changes, updates index
- ✅ Keyword filtering - Works for all 11 languages

---

*End of implementation plan*
