# CodeGraph - Implementation Plan

> **Created:** January 25, 2026
> **Goal:** Functional MCP Server for Claude Code

---

## Phase 1: Project Setup

### 1.1 Initialize Node.js Project
- [ ] Create `package.json`
- [ ] Configure TypeScript (`tsconfig.json`)
- [ ] Set up ESLint + Prettier
- [ ] Define build scripts

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

**Phase 1 Result:** Project compiles, empty MCP server starts.

---

## Phase 2: Database Layer

### 2.1 Implement SQLite Schema
- [ ] Copy `src/db/schema.sql` from spec
- [ ] Create `src/db/database.ts` wrapper class
- [ ] Migration system (for future schema updates)

### 2.2 Prepared Statements
- [ ] `src/db/queries.ts` - All SQL queries as prepared statements
- [ ] CRUD for: files, lines, items, occurrences, signatures, methods, types

### 2.3 Testing
- [ ] Unit tests for database operations
- [ ] Test fixture: Small SQLite DB with sample data

**Phase 2 Result:** Database can be created, populated, and queried.

---

## Phase 3: Parser System

### 3.1 Tree-sitter Integration
- [ ] `src/parser/tree-sitter.ts` - Initialize tree-sitter
- [ ] Load languages (C#, TypeScript initially)

### 3.2 Keyword Filters
- [ ] `src/parser/languages/csharp.ts` - C# keywords
- [ ] `src/parser/languages/typescript.ts` - TypeScript keywords
- [ ] `src/parser/languages/index.ts` - Language registry

### 3.3 Extractor
- [ ] `src/parser/extractor.ts` - Main extractor
  - Traverse AST
  - Extract identifiers (excluding keywords)
  - Classify line types
  - Collect items + occurrences

### 3.4 Signature Extraction
- [ ] `src/parser/signature.ts`
  - Collect header comments
  - Extract method prototypes
  - Capture classes/structs

### 3.5 Testing
- [ ] Unit tests with sample source files
- [ ] Test: Parse C# file → Are items correct?
- [ ] Test: Is signature extraction correct?

**Phase 3 Result:** Source files can be parsed, items/signatures are extracted.

---

## Phase 4: First MCP Tool - `codegraph_init`

### 4.1 MCP Server Foundation
- [ ] `src/server/mcp-server.ts` - Server class
- [ ] `src/server/tools.ts` - Tool registration
- [ ] `src/index.ts` - Entry point

### 4.2 Implement Init Command
- [ ] `src/commands/init.ts`
  - Validate project directory
  - Create `.codegraph/` directory
  - Initialize `index.db`
  - Find all source files (glob)
  - Parse and index each file
  - Create `summary.md` (auto-generated)
  - Import CLAUDE.md files → `docs.md`

### 4.3 Testing
- [ ] Integration test: `codegraph_init` on test project
- [ ] Check: All files indexed?
- [ ] Check: Items correct?
- [ ] Check: Signatures correct?

**Phase 4 Result:** `codegraph_init` works, project can be indexed.

---

## Phase 5: Query Tool

### 5.1 Implement Query Command
- [ ] `src/commands/query.ts`
  - Exact match
  - Contains match
  - Starts-with match
  - Optional: Regex match

### 5.2 Result Formatting
- [ ] Return filename + line number + type
- [ ] Limit parameter
- [ ] File filter (glob pattern)

### 5.3 Testing
- [ ] Query "PlayerHealth" → finds matches
- [ ] Query "Player" mode=contains → finds PlayerHealth, PlayerManager, etc.

**Phase 5 Result:** Terms can be searched.

---

## Phase 6: Signature Tools

### 6.1 Signature Command
- [ ] `src/commands/signature.ts`
  - Retrieve single file signature
  - Formatted output

### 6.2 Signatures Command (Batch)
- [ ] Retrieve multiple signatures at once (glob pattern)

### 6.3 Testing
- [ ] Retrieve signature for known file
- [ ] Retrieve all signatures in `src/Core/`

**Phase 6 Result:** File signatures are retrievable.

---

## Phase 7: Update Mechanism

### 7.1 Update Command
- [ ] `src/commands/update.ts`
  - Re-index entire file
  - Or: Only line range (from_line, to_line)

### 7.2 Incremental Update
- [ ] Remove old data for affected lines
- [ ] Insert new data
- [ ] Calculate offset and adjust line numbers

### 7.3 Remove Command
- [ ] `src/commands/remove.ts`
  - Remove file from index (CASCADE)

### 7.4 Testing
- [ ] Modify file → Update → Query finds new terms
- [ ] Insert lines → Offset correct?

**Phase 7 Result:** Index can be updated.

---

## Phase 8: Additional Tools

### 8.1 Summary Tools
- [ ] `src/commands/summary.ts` - Retrieve summary
- [ ] `src/commands/describe.ts` - Add to summary

### 8.2 Tree Tool
- [ ] `src/commands/tree.ts` - Retrieve file tree

### 8.3 Link Tool
- [ ] `src/commands/link.ts` - Link dependencies
- [ ] Implement cross-project query

### 8.4 Status Tool
- [ ] `src/commands/status.ts` - Retrieve statistics

### 8.5 Docs Tool
- [ ] `src/commands/docs.ts` - Retrieve CLAUDE.md contents
- [ ] `codegraph_update_docs` - Re-import

**Phase 8 Result:** All planned tools are functional.

---

## Phase 9: Integration & Polish

### 9.1 MCP Server Registration
- [ ] Instructions for `~/.claude/settings.json`
- [ ] Test: Server starts in Claude Code

### 9.2 Error Handling
- [ ] Catch all edge cases
- [ ] Helpful error messages

### 9.3 Performance Optimization
- [ ] Test with large projects (1000+ files)
- [ ] Batch insert for initial indexing
- [ ] Check query performance

### 9.4 Documentation
- [ ] Create README.md
- [ ] Document example workflows

**Phase 9 Result:** Production-ready MCP server.

---

## Phase 10: First Real-World Usage

### 10.1 Test with Real Project
- [ ] Index LibPyramid3D
- [ ] Index DebugViewer
- [ ] Link dependencies

### 10.2 Incorporate Feedback
- [ ] What works well?
- [ ] What's missing?
- [ ] What's too slow?

---

## Optional Extensions (Later)

- [ ] **Additional Languages:** Python, Go, Rust, JavaScript
- [ ] **Git Integration:** Auto-update after commits
- [ ] **Call Graph:** Who calls whom?
- [ ] **Vector Embeddings:** Semantic search
- [ ] **VS Code Extension:** Auto-update on save
- [ ] **Web Dashboard:** Visualization

---

## Time Estimates

| Phase | Effort |
|-------|--------|
| Phase 1: Setup | Small |
| Phase 2: Database | Medium |
| Phase 3: Parser | Large (tree-sitter learning curve) |
| Phase 4: Init | Medium |
| Phase 5: Query | Small |
| Phase 6: Signatures | Small |
| Phase 7: Update | Medium |
| Phase 8: Additional Tools | Medium |
| Phase 9: Polish | Medium |
| Phase 10: Testing | Small |

---

## Recommended Order for First Session

1. **Phase 1 complete** - Project must compile
2. **Phase 2 complete** - Database must work
3. **Phase 3.1-3.3** - Parser foundation (without signatures)
4. **Phase 4** - Init tool (simplified, without signatures)
5. **Phase 5** - Query tool

→ Then you have a **minimally functional CodeGraph** that you can already use!

Signatures, update, and additional tools can be added iteratively afterwards.

---

*End of implementation plan*
