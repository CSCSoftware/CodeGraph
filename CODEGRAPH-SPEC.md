# CodeGraph Specification

> **Version:** 1.0 (Draft)
> **Created:** January 25, 2026
> **Authors:** Uwe Chalas, Claude (Rudi)

---

## Table of Contents

1. [Overview & Motivation](#1-overview--motivation)
2. [Core Concepts](#2-core-concepts)
3. [Architecture](#3-architecture)
4. [Data Model](#4-data-model)
5. [SQLite Schema](#5-sqlite-schema)
6. [Parser System](#6-parser-system)
7. [Update Mechanism](#7-update-mechanism)
8. [MCP Server Interface](#8-mcp-server-interface)
9. [Workflow Examples](#9-workflow-examples)
10. [Project Structure](#10-project-structure)
11. [Future Extensions](#11-future-extensions)

---

## 1. Overview & Motivation

### 1.1 The Problem

When Claude Code works with a project, it must perform on every search:

1. **Grep** through thousands of files
2. **Read** hundreds of lines to understand context
3. **Clutter the context** with search runs
4. **Forget everything** on new sessions and start from scratch

When working with an unfamiliar project, Claude must:

1. Explore the complete file structure
2. Search for entry points (main, Program, App...)
3. Read massive amounts of files to understand relationships
4. All of this consumes context and time

### 1.2 The Solution: CodeGraph

CodeGraph is a **local, persistent index system** per project that:

- Indexes all **meaningful terms** (identifiers, not keywords)
- Stores **file signatures** (prototypes, header comments)
- Manages **project summaries**
- Links **dependencies** between projects
- Is directly usable in Claude Code via an **MCP interface**

### 1.3 The Benefits

**Before:**
```
Grep "PlayerHealth" → 200 hits in 40 files → Read → Read → Read...
```

**After:**
```
codegraph_query "PlayerHealth"
→ Engine.cs:45 (code)
→ Engine.cs:892 (comment)
→ Player.cs:23 (code)
→ Done. Three targeted locations.
```

**Before (unfamiliar project):**
```
ls → tree → grep "main" → read Program.cs → read Engine.cs → read...
(5+ minutes, lots of context consumed)
```

**After:**
```
codegraph_summary → codegraph_signatures "src/Core/"
→ Instant overview of purpose and structure
(10 seconds, minimal context)
```

---

## 2. Core Concepts

### 2.1 ProjectBase

Each project has its own **ProjectBase** - a data store in the project directory:

```
MyProject/
├── src/
│   └── ...
└── .codegraph/              ← The ProjectBase
    ├── index.db             ← SQLite database
    └── summary.md           ← Project description
```

### 2.2 The File Tree (Files)

An indexed tree of all source files:

| ID | Path | Hash |
|----|------|------|
| 1 | /src/Core/Engine.cs | a3f8c2... |
| 2 | /src/Core/Player.cs | b7d1e9... |
| 3 | /src/Utils/MathHelper.cs | c2a4f1... |

- **ID:** Unique integer ID per file
- **Path:** Relative path from project root
- **Hash:** For detecting changes

### 2.3 Line Objects (Lines)

Each relevant line of a file is captured:

| ID | FileID | Number | Type |
|----|--------|--------|------|
| 1 | 1 | 1 | comment |
| 2 | 1 | 5 | code |
| 3 | 1 | 12 | struct |

- **ID:** Unique **per file** (not global!)
- **FileID:** Reference to the file in the tree
- **Number:** Current line number (can change)
- **Type:** Classification of the line

#### Composite Key

The true identity of a line is: **(FileID + LineID)**

This enables:
- A 16-bit integer is sufficient per file (65,535 lines per file)
- IDs start at 1 per file
- No global counter needed
- Compact storage possible: High 16 bits = FileID, Low 16 bits = LineID

#### Line Types

| Type | Description |
|------|-------------|
| `code` | Regular code |
| `comment` | Comment line |
| `struct` | Struct/Class/Interface definition |
| `method` | Method signature |
| `property` | Property definition |
| `string` | String literal (possibly for later search) |

### 2.4 Items (Terms)

The vector space of all **meaningful terms**:

| Item | Occurrences (FileID:LineID) |
|------|------------------------------|
| "PlayerHealth" | [(1:45), (1:892), (2:23)] |
| "CalculateDamage" | [(1:156), (1:890)] |
| "velocity" | [(2:23), (2:24), (2:89)] |

#### What is NOT Indexed

Language-specific keywords are **filtered out**:

**C#:** `public`, `private`, `class`, `struct`, `interface`, `void`, `int`, `string`, `if`, `else`, `for`, `while`, `return`, `using`, `namespace`, `static`, `readonly`, `async`, `await`, `var`, `new`, `null`, `true`, `false`, ...

**TypeScript:** `function`, `const`, `let`, `var`, `interface`, `type`, `class`, `export`, `import`, `if`, `else`, `for`, `while`, `return`, `async`, `await`, `null`, `undefined`, `true`, `false`, ...

#### What IS Indexed

- Variable names: `playerHealth`, `currentVelocity`
- Function names: `CalculateDamage`, `Initialize`
- Class names: `TornadoEngine`, `VortexField`
- Comment content: Only the words, not `//` or `/* */`

#### Search Options

Items can be searched with:
- **exact:** Exact match (`PlayerHealth`)
- **contains:** Contains the term (`Player` finds `PlayerHealth`)
- **starts_with:** Starts with (`Calc` finds `CalculateDamage`)

### 2.5 File Signatures (Signatures)

A **quick profile** per source file for instant understanding:

```
┌─────────────────────────────────────────────────────────┐
│ SIGNATURE: TornadoEngine.cs                             │
├─────────────────────────────────────────────────────────┤
│ HEADER COMMENTS:                                        │
│   "Main class for the tornado simulation.               │
│    Controls the lifecycle and calculation               │
│    of vortex fields."                                   │
├─────────────────────────────────────────────────────────┤
│ CLASSES/STRUCTS:                                        │
│   class TornadoEngine                                   │
│   struct VortexConfig                                   │
├─────────────────────────────────────────────────────────┤
│ METHODS:                                                │
│   void Initialize(VortexConfig config)                  │
│   void Update(float deltaTime)                          │
│   void Shutdown()                                       │
│   VortexField CalculateField(Vector3 center, float r)   │
│   void ApplyForces(ParticleSystem particles)            │
│   bool IsActive { get; }                                │
└─────────────────────────────────────────────────────────┘
```

#### What a Signature Contains

1. **Header comments:** All comments at the beginning of the file (before the first code) and class/namespace level comments
2. **Classes/Structs:** All type definitions
3. **Method prototypes:** Only the signatures, no implementation

#### What a Signature Does NOT Contain

- Implementations (method bodies)
- Comments inside methods
- Private fields
- Local variables

### 2.6 Project Summary

A high-level description of the entire project:

```markdown
# UCTornado

## Purpose
3D tornado simulation for weather data visualization

## Architecture
- Entry Point: src/Program.cs
- Main class: src/Core/TornadoEngine.cs
- Rendering: src/Rendering/VortexRenderer.cs

## Key Concepts
- VortexField: The vector field of wind flow
- ParticleSystem: Visualizes debris in the tornado
- DataSource: Interface for weather data input

## Dependencies
- LibPyramid3D (3D rendering)
- LibWeatherData (data formats)

## Patterns
- MVVM for UI
- ECS for particle simulation
```

#### Automatically Generated Parts

During `init`, the following are automatically detected:
- Entry points (Program.cs, main.ts, index.js...)
- Main classes (most used/referenced terms)
- Dependencies from csproj/package.json
- Directory structure

#### Manually Extendable Parts

- Purpose
- Key concepts
- Architecture decisions
- Patterns

These are **never overwritten**, only extended.

### 2.7 Project Documentation (Claude.md Integration)

The contents of CLAUDE.md files are integrated directly into CodeGraph:

```
.codegraph/
├── index.db
├── summary.md           ← Project summary (auto + manual)
└── docs.md              ← CLAUDE.md contents (imported)
```

#### What is Imported

- **Project CLAUDE.md:** `.claude/CLAUDE.md` or `CLAUDE.md` in root
- **Library CLAUDE.md:** All `CLAUDE.md` in subdirectories
- **Structure is preserved:** Headings become sections

#### Example

```markdown
# docs.md (generated from CLAUDE.md files)

## Project: UCTornado
> Source: .claude/CLAUDE.md

[Content of main CLAUDE.md]

---

## Library: src/Physics
> Source: src/Physics/CLAUDE.md

[Content of Physics CLAUDE.md]

---

## Library: src/Rendering
> Source: src/Rendering/CLAUDE.md

[Content of Rendering CLAUDE.md]
```

#### Synchronization

- On `codegraph_init`: All CLAUDE.md files are imported
- On `codegraph_update_docs`: Manual re-import
- The original CLAUDE.md files remain unchanged (read-only import)

#### New Tool

```typescript
codegraph_docs({
    section?: string;  // Optional: Only specific section
})
// → Returns the complete docs.md

codegraph_update_docs()
// → Re-imports all CLAUDE.md files
```

### 2.8 Dependencies (Links)

When Project A uses Library B, its CodeGraph is linked:

```
UCTornado/.codegraph/
    → linked to → LibPyramid3D/.codegraph/
    → linked to → LibWeatherData/.codegraph/
```

A search can then span **all linked projects**:

```
codegraph_query "PyramidMesh" --include-dependencies
→ Finds matches in UCTornado AND LibPyramid3D
```

---

## 3. Architecture

### 3.1 Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code (Host)                       │
└─────────────────────────────┬───────────────────────────────┘
                              │ MCP Protocol
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    CodeGraph MCP Server                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Commands   │  │   Parser    │  │   Database Layer    │  │
│  │  ─────────  │  │  ─────────  │  │   ──────────────    │  │
│  │  init       │  │  Tree-sitter│  │   SQLite            │  │
│  │  update     │  │  Extractor  │  │   Queries           │  │
│  │  query      │  │  Languages  │  │   Migrations        │  │
│  │  signature  │  │             │  │                     │  │
│  │  summary    │  │             │  │                     │  │
│  │  link       │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    .codegraph/ Directory                     │
│  ┌─────────────────────────┐  ┌───────────────────────────┐ │
│  │      index.db           │  │      summary.md           │ │
│  │  ───────────────────    │  │  ─────────────────────    │ │
│  │  files                  │  │  Project description      │ │
│  │  lines                  │  │  (auto + manual)          │ │
│  │  items                  │  │                           │ │
│  │  occurrences            │  │                           │ │
│  │  signatures             │  │                           │ │
│  │  methods                │  │                           │ │
│  │  dependencies           │  │                           │ │
│  └─────────────────────────┘  └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Node.js / TypeScript | Native MCP support, cross-platform |
| Database | SQLite | Embedded, fast, single file, proven |
| Parser | Tree-sitter | Knows 100+ languages, distinguishes Identifier/Keyword/Comment |
| Protocol | MCP (Model Context Protocol) | Standard for Claude Code Tools |

---

## 4. Data Model

### 4.1 Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   files     │       │    lines    │       │    items    │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │──┐    │ id          │   ┌──│ id (PK)     │
│ path        │  │    │ file_id (FK)│◄──┤  │ term        │
│ hash        │  │    │ line_number │   │  └─────────────┘
│ last_indexed│  │    │ line_type   │   │         │
└─────────────┘  │    └─────────────┘   │         │
       │         │           ▲          │         │
       │         │           │          │         ▼
       │         └───────────┼──────────┘  ┌─────────────┐
       │                     │             │ occurrences │
       │                     │             ├─────────────┤
       │                     └─────────────│ item_id(FK) │
       │                                   │ file_id(FK) │
       │                                   │ line_id(FK) │
       │                                   └─────────────┘
       │
       │         ┌─────────────┐       ┌─────────────┐
       │         │ signatures  │       │   methods   │
       │         ├─────────────┤       ├─────────────┤
       └────────►│ file_id(FK) │       │ id (PK)     │
                 │ header_comm │       │ file_id(FK) │◄──┐
                 └─────────────┘       │ name        │   │
                                       │ prototype   │   │
                                       │ line_number │   │
                                       └─────────────┘   │
                                                         │
                 ┌─────────────┐                         │
                 │dependencies │                         │
                 ├─────────────┤                         │
                 │ id (PK)     │                         │
                 │ path        │─────────────────────────┘
                 └─────────────┘   (points to other .codegraph)
```

### 4.2 Data Types

#### File

```typescript
interface File {
    id: number;              // Auto-increment
    path: string;            // Relative path: "src/Core/Engine.cs"
    hash: string;            // SHA-256 or similar
    last_indexed: number;    // Unix timestamp
}
```

#### Line

```typescript
interface Line {
    id: number;              // Unique per file, starts at 1
    file_id: number;         // Reference to File
    line_number: number;     // Current line number (1-based)
    line_type: LineType;     // 'code' | 'comment' | 'struct' | 'method' | 'property' | 'string'
}

// Composite Key: (file_id, id)
```

#### Item

```typescript
interface Item {
    id: number;              // Auto-increment
    term: string;            // The indexed term: "PlayerHealth"
}
```

#### Occurrence

```typescript
interface Occurrence {
    item_id: number;         // Reference to Item
    file_id: number;         // Reference to File
    line_id: number;         // Reference to Line (within the file)
}
```

#### Signature

```typescript
interface Signature {
    file_id: number;         // Reference to File (1:1)
    header_comments: string; // All header comments, combined
}
```

#### Method

```typescript
interface Method {
    id: number;              // Auto-increment
    file_id: number;         // Reference to File
    name: string;            // "CalculateField"
    prototype: string;       // "VortexField CalculateField(Vector3 center, float radius)"
    line_number: number;     // Where the method begins
}
```

#### Dependency

```typescript
interface Dependency {
    id: number;              // Auto-increment
    path: string;            // Absolute path to the other .codegraph
}
```

---

## 5. SQLite Schema

```sql
-- ============================================================
-- CodeGraph SQLite Schema
-- Version: 1.0
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;  -- Write-Ahead Logging for performance

-- ------------------------------------------------------------
-- File Tree
-- ------------------------------------------------------------
CREATE TABLE files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    last_indexed INTEGER NOT NULL
);

CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_files_hash ON files(hash);

-- ------------------------------------------------------------
-- Line Objects
-- ------------------------------------------------------------
CREATE TABLE lines (
    id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    line_number INTEGER NOT NULL,
    line_type TEXT NOT NULL CHECK(line_type IN ('code', 'comment', 'struct', 'method', 'property', 'string')),
    PRIMARY KEY (file_id, id),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_lines_file ON lines(file_id);
CREATE INDEX idx_lines_type ON lines(line_type);

-- ------------------------------------------------------------
-- Items (Terms)
-- ------------------------------------------------------------
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE INDEX idx_items_term ON items(term);

-- For contains/starts_with searches
CREATE INDEX idx_items_term_pattern ON items(term COLLATE NOCASE);

-- ------------------------------------------------------------
-- Item Occurrences
-- ------------------------------------------------------------
CREATE TABLE occurrences (
    item_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    line_id INTEGER NOT NULL,
    PRIMARY KEY (item_id, file_id, line_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id, line_id) REFERENCES lines(file_id, id) ON DELETE CASCADE
);

CREATE INDEX idx_occurrences_item ON occurrences(item_id);
CREATE INDEX idx_occurrences_file ON occurrences(file_id);

-- ------------------------------------------------------------
-- File Signatures
-- ------------------------------------------------------------
CREATE TABLE signatures (
    file_id INTEGER PRIMARY KEY,
    header_comments TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Methods/Functions
-- ------------------------------------------------------------
CREATE TABLE methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prototype TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    visibility TEXT,  -- 'public', 'private', 'protected', 'internal', NULL
    is_static INTEGER DEFAULT 0,
    is_async INTEGER DEFAULT 0,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_methods_file ON methods(file_id);
CREATE INDEX idx_methods_name ON methods(name);

-- ------------------------------------------------------------
-- Classes/Structs/Interfaces
-- ------------------------------------------------------------
CREATE TABLE types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('class', 'struct', 'interface', 'enum', 'type')),
    line_number INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX idx_types_file ON types(file_id);
CREATE INDEX idx_types_name ON types(name);

-- ------------------------------------------------------------
-- Dependencies to Other CodeGraph Instances
-- ------------------------------------------------------------
CREATE TABLE dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    name TEXT,  -- Optional display name: "LibPyramid3D"
    last_checked INTEGER  -- When last verified available
);

-- ------------------------------------------------------------
-- Metadata
-- ------------------------------------------------------------
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Initial metadata
INSERT INTO metadata (key, value) VALUES
    ('schema_version', '1.0'),
    ('created_at', strftime('%s', 'now')),
    ('project_name', NULL),
    ('project_root', NULL);
```

---

## 6. Parser System

### 6.1 Tree-sitter Integration

Tree-sitter is an incremental parser that:
- Knows the grammar of 100+ languages
- Reliably distinguishes between Identifier, Keyword, Comment, String
- Supports incremental parsing (only changed parts)

#### Supported Languages

| Language | Tree-sitter Package | Keywords Filter | Extensions |
|----------|---------------------|-----------------|------------|
| C# | tree-sitter-c-sharp | csharp.ts | `.cs` |
| TypeScript | tree-sitter-typescript | typescript.ts | `.ts`, `.tsx` |
| JavaScript | tree-sitter-typescript | typescript.ts | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Python | tree-sitter-python | python.ts | `.py`, `.pyw` |
| Rust | tree-sitter-rust | rust.ts | `.rs` |
| C | tree-sitter-c | c.ts | `.c`, `.h` |
| C++ | tree-sitter-cpp | cpp.ts | `.cpp`, `.cc`, `.cxx`, `.hpp`, `.hxx` |
| Java | tree-sitter-java | java.ts | `.java` |
| Go | tree-sitter-go | go.ts | `.go` |
| PHP | tree-sitter-php | php.ts | `.php` |
| Ruby | tree-sitter-ruby | ruby.ts | `.rb`, `.rake` |

### 6.2 Extraction Pipeline

```
Source File
    │
    ▼
┌─────────────────────────────────────────┐
│           Tree-sitter Parser            │
│  ─────────────────────────────────────  │
│  Generates Abstract Syntax Tree (AST)   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│           Node Visitor                  │
│  ─────────────────────────────────────  │
│  Traverses the AST                      │
│  Classifies each node                   │
└─────────────────────────────────────────┘
    │
    ├──► Identifier → Keyword Filter → Items
    │
    ├──► Comment → Extract text → Items + Line as 'comment'
    │
    ├──► Method/Function → Prototype → Methods table
    │
    ├──► Class/Struct/Interface → Types table
    │
    └──► String Literal → Optional for later search
```

### 6.3 Keyword Filter Example (C#)

```typescript
// src/parser/languages/csharp.ts

export const CSHARP_KEYWORDS = new Set([
    // Access modifiers
    'public', 'private', 'protected', 'internal',

    // Type keywords
    'class', 'struct', 'interface', 'enum', 'record',
    'namespace', 'using',

    // Modifiers
    'static', 'readonly', 'const', 'volatile',
    'virtual', 'override', 'abstract', 'sealed',
    'async', 'await', 'partial',

    // Primitive types
    'void', 'int', 'uint', 'long', 'ulong', 'short', 'ushort',
    'byte', 'sbyte', 'float', 'double', 'decimal',
    'bool', 'char', 'string', 'object', 'dynamic', 'var',

    // Control flow
    'if', 'else', 'switch', 'case', 'default',
    'for', 'foreach', 'while', 'do',
    'break', 'continue', 'return', 'yield',
    'try', 'catch', 'finally', 'throw',
    'goto',

    // Operators/Literals
    'new', 'typeof', 'sizeof', 'nameof',
    'is', 'as', 'in', 'out', 'ref',
    'true', 'false', 'null',
    'this', 'base',

    // Other
    'get', 'set', 'init', 'value',
    'where', 'select', 'from', 'orderby', 'groupby',  // LINQ
    'delegate', 'event', 'operator',
    'implicit', 'explicit',
    'checked', 'unchecked',
    'fixed', 'lock', 'stackalloc',
]);

export function isKeyword(term: string): boolean {
    return CSHARP_KEYWORDS.has(term.toLowerCase());
}
```

### 6.4 Signature Extraction

```typescript
// Pseudocode for signature extraction

function extractSignature(ast: AST, filePath: string): Signature {
    const headerComments: string[] = [];
    const methods: Method[] = [];
    const types: Type[] = [];

    // 1. Collect header comments (before first code)
    for (const node of ast.rootNode.children) {
        if (node.type === 'comment') {
            headerComments.push(extractCommentText(node));
        } else if (!isUsingOrNamespace(node)) {
            break;  // First real code reached
        }
    }

    // 2. Collect class-level comments
    for (const classNode of findNodes(ast, 'class_declaration')) {
        const docComment = findPrecedingComment(classNode);
        if (docComment) {
            headerComments.push(extractCommentText(docComment));
        }

        // Capture type
        types.push({
            name: getClassName(classNode),
            kind: 'class',
            line_number: classNode.startPosition.row + 1
        });
    }

    // 3. Collect method prototypes (no bodies)
    for (const methodNode of findNodes(ast, 'method_declaration')) {
        methods.push({
            name: getMethodName(methodNode),
            prototype: getMethodPrototype(methodNode),  // Signature only!
            line_number: methodNode.startPosition.row + 1,
            visibility: getVisibility(methodNode),
            is_static: isStatic(methodNode),
            is_async: isAsync(methodNode)
        });
    }

    return {
        header_comments: headerComments.join('\n'),
        methods,
        types
    };
}
```

---

## 7. Update Mechanism

### 7.1 Incremental Update

The core principle: **Only change what has changed.**

#### Scenario: Lines 45-52 in Engine.cs Changed

```typescript
codegraph_update({
    file: "src/Core/Engine.cs",
    from_line: 45,
    to_line: 52
});
```

**What happens:**

1. **Load file** and parse with Tree-sitter
2. **Identify affected lines:**
   - All Lines with `line_number` between 45 and 52
3. **Remove old data:**
   - Occurrences pointing to these Lines
   - Items that only occurred here (reference count = 0)
4. **Extract new data:**
   - Parse lines 45-52
   - Create new Items/Occurrences
5. **Calculate offset:**
   - Old line count vs. new line count
   - Shift all Lines from line 53 onwards by offset
6. **Update hash**

#### Offset Calculation

```typescript
// Example: 5 lines were inserted at line 50

const oldLineCount = getLineCountFromDB(fileId);  // 100
const newLineCount = countLinesInFile(filePath);  // 105
const offset = newLineCount - oldLineCount;       // +5

// Shift all lines from the change point
UPDATE lines
SET line_number = line_number + 5
WHERE file_id = ? AND line_number >= 50;
```

### 7.2 Full Update

When no line ranges are specified:

```typescript
codegraph_update({
    file: "src/Core/Engine.cs"
    // no from_line/to_line
});
```

**What happens:**

1. Delete all data for this file (CASCADE)
2. Completely re-parse the file
3. Create all data anew
4. Update hash

### 7.3 File Added

```typescript
// Automatic on update if file doesn't exist yet
codegraph_update({
    file: "src/NewFeature/NewClass.cs"
});
```

**What happens:**

1. New entry in `files`
2. Complete parsing
3. Populate all tables

### 7.4 File Deleted

```typescript
codegraph_remove({
    file: "src/OldStuff/Deprecated.cs"
});
```

**What happens:**

1. `DELETE FROM files WHERE path = ?`
2. All dependent data is deleted through CASCADE

### 7.5 Batch Update

For many files at once:

```typescript
codegraph_update_batch({
    files: [
        { file: "src/A.cs" },
        { file: "src/B.cs", from_line: 10, to_line: 20 },
        { file: "src/C.cs" }
    ]
});
```

Executed in a single transaction for consistency and performance.

---

## 8. MCP Server Interface

### 8.1 Tool Overview

| Tool | Description |
|------|-------------|
| `codegraph_init` | Initialize a new project |
| `codegraph_update` | Re-index file (range) |
| `codegraph_remove` | Remove file from index |
| `codegraph_query` | Search items/terms |
| `codegraph_signature` | Get file signature |
| `codegraph_signatures` | Get multiple signatures |
| `codegraph_summary` | Get project summary |
| `codegraph_describe` | Extend project summary |
| `codegraph_tree` | Get file tree |
| `codegraph_link` | Link dependency |
| `codegraph_unlink` | Remove linked dependency |
| `codegraph_links` | List linked dependencies |
| `codegraph_status` | Get status/statistics |
| `codegraph_scan` | Find all indexed projects in a directory tree |

### 8.2 Tool Definitions

#### codegraph_init

Initializes CodeGraph for a project.

```typescript
interface InitParams {
    path: string;           // Project directory
    name?: string;          // Optional project name
    languages?: string[];   // To index: ['csharp', 'typescript']
    exclude?: string[];     // Patterns to exclude: ['**/bin/**', '**/node_modules/**']
}

interface InitResult {
    success: boolean;
    codegraph_path: string;  // Path to .codegraph
    files_indexed: number;
    items_found: number;
    duration_ms: number;
}
```

**Example:**
```typescript
codegraph_init({
    path: "Q:/develop/Repos/UCTornado",
    name: "UCTornado",
    languages: ["csharp"],
    exclude: ["**/bin/**", "**/obj/**"]
});
```

#### codegraph_update

Updates the index for one or more files.

```typescript
interface UpdateParams {
    file: string;           // Relative path to file
    from_line?: number;     // Optional: Start of change
    to_line?: number;       // Optional: End of change
}

interface UpdateResult {
    success: boolean;
    file: string;
    items_added: number;
    items_removed: number;
    lines_updated: number;
    duration_ms: number;
}
```

**Examples:**
```typescript
// Re-index entire file
codegraph_update({
    file: "src/Core/Engine.cs"
});

// Update only lines 45-52
codegraph_update({
    file: "src/Core/Engine.cs",
    from_line: 45,
    to_line: 52
});
```

#### codegraph_query

Searches for items/terms in the index.

```typescript
interface QueryParams {
    term: string;                    // Search term
    mode?: 'exact' | 'contains' | 'starts_with' | 'regex';  // Default: 'exact'
    include_dependencies?: boolean;  // Also search in linked projects
    file_filter?: string;            // Glob pattern: "src/Core/**"
    type_filter?: string[];          // Only certain line types: ['code', 'comment']
    limit?: number;                  // Max. results
}

interface QueryResult {
    term: string;
    matches: Array<{
        file: string;
        line_number: number;
        line_type: string;
        project?: string;   // For dependencies: Project name
    }>;
    total_matches: number;
}
```

**Examples:**
```typescript
// Exact search
codegraph_query({
    term: "PlayerHealth"
});
// → [{ file: "Engine.cs", line_number: 45, line_type: "code" }, ...]

// Contains search
codegraph_query({
    term: "Player",
    mode: "contains"
});
// → Finds PlayerHealth, PlayerManager, UpdatePlayer, ...

// With dependencies
codegraph_query({
    term: "PyramidMesh",
    include_dependencies: true
});
// → Also finds in LibPyramid3D
```

#### codegraph_signature

Gets the signature of a file.

```typescript
interface SignatureParams {
    file: string;           // Relative path
}

interface SignatureResult {
    file: string;
    header_comments: string;
    types: Array<{
        name: string;
        kind: string;       // 'class', 'struct', 'interface', ...
        line_number: number;
    }>;
    methods: Array<{
        name: string;
        prototype: string;
        line_number: number;
        visibility?: string;
        is_static: boolean;
        is_async: boolean;
    }>;
}
```

**Example:**
```typescript
codegraph_signature({
    file: "src/Core/TornadoEngine.cs"
});
// → {
//     header_comments: "Main class for the tornado simulation...",
//     types: [{ name: "TornadoEngine", kind: "class", line_number: 15 }],
//     methods: [
//         { name: "Initialize", prototype: "void Initialize(VortexConfig config)", ... },
//         { name: "Update", prototype: "void Update(float deltaTime)", ... },
//         ...
//     ]
// }
```

#### codegraph_signatures

Gets signatures for multiple files.

```typescript
interface SignaturesParams {
    path?: string;          // Directory (glob pattern)
    files?: string[];       // Or explicit file list
}

interface SignaturesResult {
    signatures: SignatureResult[];
}
```

**Example:**
```typescript
codegraph_signatures({
    path: "src/Core/**/*.cs"
});
```

#### codegraph_summary

Gets the project summary.

```typescript
interface SummaryParams {
    // no parameters
}

interface SummaryResult {
    name: string;
    content: string;        // Markdown content of summary.md
    auto_generated: {
        entry_points: string[];
        main_classes: string[];
        dependencies: string[];
    };
}
```

#### codegraph_describe

Extends the project summary.

```typescript
interface DescribeParams {
    section: 'purpose' | 'architecture' | 'concepts' | 'patterns' | 'custom';
    content: string;
    replace?: boolean;      // Replace existing section? Default: false (append)
}

interface DescribeResult {
    success: boolean;
    section: string;
}
```

**Example:**
```typescript
codegraph_describe({
    section: "purpose",
    content: "3D tornado simulation for weather data visualization"
});
```

#### codegraph_tree

Gets the file tree.

```typescript
interface TreeParams {
    path?: string;          // Subdirectory, default: root
    depth?: number;         // Max. depth
    include_stats?: boolean; // Item counts per file
}

interface TreeResult {
    root: string;
    entries: Array<{
        path: string;
        type: 'file' | 'directory';
        item_count?: number;
        method_count?: number;
        last_indexed?: number;
    }>;
}
```

#### codegraph_link

Links a dependency.

```typescript
interface LinkParams {
    path: string;           // Path to the other .codegraph or project
    name?: string;          // Optional display name
}

interface LinkResult {
    success: boolean;
    dependency_id: number;
    name: string;
    files_available: number;
}
```

**Example:**
```typescript
codegraph_link({
    path: "Q:/develop/Repos/LibPyramid3D",
    name: "LibPyramid3D"
});
```

#### codegraph_status

Gets status and statistics.

```typescript
interface StatusParams {
    // no parameters
}

interface StatusResult {
    project_name: string;
    codegraph_path: string;
    schema_version: string;
    statistics: {
        files: number;
        lines: number;
        items: number;
        occurrences: number;
        methods: number;
        types: number;
        dependencies: number;
    };
    last_update: number;
    database_size_bytes: number;
}
```

---

## 9. Workflow Examples

### 9.1 Setting Up a New Project

```typescript
// 1. Initialize project
codegraph_init({
    path: "Q:/develop/Repos/UCTornado",
    name: "UCTornado",
    languages: ["csharp"]
});
// → Scans all .cs files, creates index

// 2. Document purpose
codegraph_describe({
    section: "purpose",
    content: "3D tornado simulation for weather data visualization"
});

// 3. Link library
codegraph_link({
    path: "Q:/develop/Repos/LibPyramid3D"
});
```

### 9.2 Understanding an Unfamiliar Project

```typescript
// 1. Read summary
codegraph_summary();
// → Gives overview of purpose, entry points, dependencies

// 2. Look at core signatures
codegraph_signatures({ path: "src/Core/**" });
// → All methods and classes in the Core directory

// 3. Search for specific term
codegraph_query({ term: "Vortex", mode: "contains" });
// → Where is "Vortex" used everywhere?
```

### 9.3 Changing Code and Keeping Index Current

```typescript
// 1. I'm changing Engine.cs, lines 120-135
// (Claude makes edit)

// 2. Update index
codegraph_update({
    file: "src/Core/Engine.cs",
    from_line: 120,
    to_line: 135
});

// 3. Continue working with current index
```

### 9.4 Refactoring: Finding and Renaming a Method

```typescript
// 1. Where is "CalculateDamage" used?
codegraph_query({ term: "CalculateDamage" });
// → Engine.cs:156, Player.cs:89, Enemy.cs:234

// 2. Look at signature
codegraph_signature({ file: "src/Core/Engine.cs" });
// → void CalculateDamage(Entity target, int baseDamage)

// 3. Edit all locations...
// 4. After refactoring: Update affected files
codegraph_update({ file: "src/Core/Engine.cs" });
codegraph_update({ file: "src/Entities/Player.cs" });
codegraph_update({ file: "src/Entities/Enemy.cs" });
```

### 9.5 Cross-Project Search

```typescript
// I'm working in UCTornado and looking for a method from LibPyramid3D
codegraph_query({
    term: "RenderMesh",
    include_dependencies: true
});
// → UCTornado: src/Rendering/VortexRenderer.cs:45 (call)
// → LibPyramid3D: src/Core/MeshRenderer.cs:123 (definition)
```

---

## 10. Project Structure

```
Q:\develop\Tools\CodeGraph\
├── package.json
├── tsconfig.json
├── README.md
├── CODEGRAPH-SPEC.md          ← This file
│
├── src/
│   ├── index.ts               ← MCP Server Entry Point
│   │
│   ├── server/
│   │   ├── mcp-server.ts      ← MCP Protocol Handler
│   │   └── tools.ts           ← Tool registrations
│   │
│   ├── db/
│   │   ├── database.ts        ← SQLite Wrapper
│   │   ├── schema.ts          ← Table definitions
│   │   ├── queries.ts         ← Prepared Statements
│   │   └── migrations/        ← Schema migrations
│   │       └── 001-initial.sql
│   │
│   ├── parser/
│   │   ├── extractor.ts       ← Main extractor
│   │   ├── tree-sitter.ts     ← Tree-sitter integration
│   │   ├── signature.ts       ← Signature extraction
│   │   └── languages/
│   │       ├── index.ts       ← Language Registry
│   │       ├── csharp.ts      ← C# Keywords + Patterns
│   │       ├── typescript.ts
│   │       ├── javascript.ts
│   │       ├── python.ts
│   │       ├── go.ts
│   │       └── rust.ts
│   │
│   ├── commands/
│   │   ├── init.ts            ← codegraph_init
│   │   ├── update.ts          ← codegraph_update
│   │   ├── remove.ts          ← codegraph_remove
│   │   ├── query.ts           ← codegraph_query
│   │   ├── signature.ts       ← codegraph_signature(s)
│   │   ├── summary.ts         ← codegraph_summary, codegraph_describe
│   │   ├── tree.ts            ← codegraph_tree
│   │   ├── link.ts            ← codegraph_link
│   │   └── status.ts          ← codegraph_status
│   │
│   └── utils/
│       ├── hash.ts            ← File hashing
│       ├── glob.ts            ← Glob pattern matching
│       └── logger.ts          ← Logging
│
├── test/
│   ├── fixtures/              ← Test source files
│   │   ├── sample.cs
│   │   ├── sample.ts
│   │   └── ...
│   │
│   ├── unit/
│   │   ├── parser.test.ts
│   │   ├── database.test.ts
│   │   └── ...
│   │
│   └── integration/
│       ├── init.test.ts
│       ├── query.test.ts
│       └── ...
│
└── scripts/
    ├── build.ts
    └── install-languages.ts   ← Install Tree-sitter languages
```

---

## 11. Future Extensions

### 11.1 Vector Embeddings (Semantic Search)

Later, the Item vector space could be extended to real vector embeddings:

```typescript
// Instead of just exact/contains search:
codegraph_query({
    term: "player health",  // Natural language!
    mode: "semantic"
});
// → Finds "PlayerHealth", "CharacterHP", "HealthPoints", ...
```

Technology: SQLite with vec0 extension or separate vector DB.

### 11.2 Change Tracking (Git Integration)

```typescript
// Automatically after git commit:
codegraph_sync_git({
    from_commit: "abc123",
    to_commit: "HEAD"
});
// → Finds changed files, updates only those
```

### 11.3 Call Graph

In addition to Items: Who calls whom?

```typescript
codegraph_callers({ method: "CalculateDamage" });
// → [{ file: "Player.cs", method: "TakeDamage", line: 89 }, ...]

codegraph_callees({ method: "Update" });
// → Which methods does Update call?
```

### 11.4 IDE Integration

- VS Code Extension: Automatic update on save
- Visual Studio Extension: Same
- JetBrains Plugin: Same

### 11.5 Web Dashboard

Local web UI for visualization:
- File tree with statistics
- Item cloud
- Dependency graph
- Search with preview

---

## Appendix A: Glossary

| Term | Meaning |
|------|---------|
| **CodeGraph** | The entire tool/system |
| **ProjectBase** | The .codegraph instance of a project |
| **Item** | An indexed term (not a language keyword) |
| **Occurrence** | An occurrence of an Item at a specific location |
| **Signature** | Quick profile of a file (header comments + prototypes) |
| **Dependency** | Link to another ProjectBase |
| **Tree-sitter** | Parser library for syntax analysis |

---

## Appendix B: Configuration

### MCP Server Registration (~/.claude/settings.json)

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["Q:/develop/Tools/CodeGraph/build/index.js"],
      "env": {
        "CODEGRAPH_LOG_LEVEL": "info"
      }
    }
  }
}
```

### Project-Specific Configuration (.codegraph/config.json)

```json
{
  "languages": ["csharp", "typescript"],
  "exclude": [
    "**/bin/**",
    "**/obj/**",
    "**/node_modules/**",
    "**/*.generated.cs"
  ],
  "include": [
    "src/**",
    "libs/**"
  ],
  "auto_update": false
}
```

---

*End of Specification*
