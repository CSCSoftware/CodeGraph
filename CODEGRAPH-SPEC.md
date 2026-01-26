# CodeGraph Spezifikation

> **Version:** 1.0 (Draft)
> **Erstellt:** 25. Januar 2026
> **Autoren:** Uwe Chalas, Claude (Rudi)

---

## Inhaltsverzeichnis

1. [Übersicht & Motivation](#1-übersicht--motivation)
2. [Kernkonzepte](#2-kernkonzepte)
3. [Architektur](#3-architektur)
4. [Datenmodell](#4-datenmodell)
5. [SQLite Schema](#5-sqlite-schema)
6. [Parser-System](#6-parser-system)
7. [Update-Mechanismus](#7-update-mechanismus)
8. [MCP Server Interface](#8-mcp-server-interface)
9. [Workflow-Beispiele](#9-workflow-beispiele)
10. [Projektstruktur](#10-projektstruktur)
11. [Zukünftige Erweiterungen](#11-zukünftige-erweiterungen)

---

## 1. Übersicht & Motivation

### 1.1 Das Problem

Wenn Claude Code mit einem Projekt arbeitet, muss er bei jeder Suche:

1. **Grep** durch tausende Dateien ausführen
2. **Read** von hunderten Zeilen um Kontext zu verstehen
3. Den **Kontext vollmüllen** mit Suchläufen
4. Bei neuer Session **alles vergessen** und von vorn beginnen

Bei einem unbekannten Projekt muss Claude:

1. Die komplette Dateistruktur erkunden
2. Einstiegspunkte suchen (main, Program, App...)
3. Massenhaft Dateien lesen um Zusammenhänge zu verstehen
4. All das frisst Kontext und Zeit

### 1.2 Die Lösung: CodeGraph

CodeGraph ist ein **lokales, persistentes Index-System** pro Projekt, das:

- Alle **bedeutungstragenden Terme** (Identifier, nicht Keywords) indiziert
- **Datei-Signaturen** speichert (Prototypen, Header-Kommentare)
- **Projekt-Summaries** verwaltet
- **Abhängigkeiten** zwischen Projekten verknüpft
- Über ein **MCP-Interface** direkt in Claude Code nutzbar ist

### 1.3 Der Nutzen

**Vorher:**
```
Grep "PlayerHealth" → 200 Treffer in 40 Dateien → Read → Read → Read...
```

**Nachher:**
```
codegraph_query "PlayerHealth"
→ Engine.cs:45 (code)
→ Engine.cs:892 (comment)
→ Player.cs:23 (code)
→ Fertig. Drei gezielte Stellen.
```

**Vorher (unbekanntes Projekt):**
```
ls → tree → grep "main" → read Program.cs → read Engine.cs → read...
(5+ Minuten, viel Kontext verbraucht)
```

**Nachher:**
```
codegraph_summary → codegraph_signatures "src/Core/"
→ Sofortiger Überblick über Zweck und Struktur
(10 Sekunden, minimaler Kontext)
```

---

## 2. Kernkonzepte

### 2.1 ProjectBase

Jedes Projekt hat seine eigene **ProjectBase** - eine Datenbasis im Projektverzeichnis:

```
MeinProjekt/
├── src/
│   └── ...
└── .codegraph/              ← Die ProjectBase
    ├── index.db             ← SQLite Datenbank
    └── summary.md           ← Projekt-Beschreibung
```

### 2.2 Der Dateibaum (Files)

Ein indizierter Baum aller Quelltextdateien:

| ID | Pfad | Hash |
|----|------|------|
| 1 | /src/Core/Engine.cs | a3f8c2... |
| 2 | /src/Core/Player.cs | b7d1e9... |
| 3 | /src/Utils/MathHelper.cs | c2a4f1... |

- **ID:** Eindeutige Integer-ID pro Datei
- **Pfad:** Relativer Pfad vom Projektwurzel
- **Hash:** Zur Erkennung von Änderungen

### 2.3 Zeilenobjekte (Lines)

Jede relevante Zeile einer Datei wird erfasst:

| ID | DateiID | Nummer | Typ |
|----|---------|--------|-----|
| 1 | 1 | 1 | comment |
| 2 | 1 | 5 | code |
| 3 | 1 | 12 | struct |

- **ID:** Eindeutig **pro Datei** (nicht global!)
- **DateiID:** Referenz auf die Datei im Baum
- **Nummer:** Aktuelle Zeilennummer (kann sich ändern)
- **Typ:** Klassifikation der Zeile

#### Composite Key

Die echte Identität einer Zeile ist: **(DateiID + ZeilenID)**

Dies ermöglicht:
- Pro Datei reicht ein 16-bit Integer (65.535 Zeilen pro Datei)
- IDs fangen pro Datei bei 1 an
- Kein globaler Counter nötig
- Kompakte Speicherung möglich: High 16 bit = DateiID, Low 16 bit = ZeilenID

#### Zeilentypen

| Typ | Beschreibung |
|-----|--------------|
| `code` | Regulärer Code |
| `comment` | Kommentarzeile |
| `struct` | Struct/Class/Interface Definition |
| `method` | Methodensignatur |
| `property` | Property Definition |
| `string` | String-Literal (ggf. für spätere Suche) |

### 2.4 Items (Terme)

Der Vektorraum aller **bedeutungstragenden Begriffe**:

| Item | Vorkommen (DateiID:ZeilenID) |
|------|------------------------------|
| "PlayerHealth" | [(1:45), (1:892), (2:23)] |
| "CalculateDamage" | [(1:156), (1:890)] |
| "velocity" | [(2:23), (2:24), (2:89)] |

#### Was NICHT indiziert wird

Sprachspezifische Keywords werden **ausgefiltert**:

**C#:** `public`, `private`, `class`, `struct`, `interface`, `void`, `int`, `string`, `if`, `else`, `for`, `while`, `return`, `using`, `namespace`, `static`, `readonly`, `async`, `await`, `var`, `new`, `null`, `true`, `false`, ...

**TypeScript:** `function`, `const`, `let`, `var`, `interface`, `type`, `class`, `export`, `import`, `if`, `else`, `for`, `while`, `return`, `async`, `await`, `null`, `undefined`, `true`, `false`, ...

#### Was indiziert wird

- Variablennamen: `playerHealth`, `currentVelocity`
- Funktionsnamen: `CalculateDamage`, `Initialize`
- Klassennamen: `TornadoEngine`, `VortexField`
- Kommentar-Inhalte: Nur die Wörter, nicht `//` oder `/* */`

#### Suchoptionen

Items können gesucht werden mit:
- **exact:** Exakte Übereinstimmung (`PlayerHealth`)
- **contains:** Enthält den Term (`Player` findet `PlayerHealth`)
- **starts_with:** Beginnt mit (`Calc` findet `CalculateDamage`)

### 2.5 Datei-Signaturen (Signatures)

Ein **Schnell-Profil** pro Quelltextdatei für sofortiges Verständnis:

```
┌─────────────────────────────────────────────────────────┐
│ SIGNATUR: TornadoEngine.cs                              │
├─────────────────────────────────────────────────────────┤
│ HEADER-KOMMENTARE:                                      │
│   "Hauptklasse für die Tornado-Simulation.              │
│    Steuert den Lebenszyklus und die Berechnung          │
│    der Vortex-Felder."                                  │
├─────────────────────────────────────────────────────────┤
│ KLASSEN/STRUCTS:                                        │
│   class TornadoEngine                                   │
│   struct VortexConfig                                   │
├─────────────────────────────────────────────────────────┤
│ METHODEN:                                               │
│   void Initialize(VortexConfig config)                  │
│   void Update(float deltaTime)                          │
│   void Shutdown()                                       │
│   VortexField CalculateField(Vector3 center, float r)   │
│   void ApplyForces(ParticleSystem particles)            │
│   bool IsActive { get; }                                │
└─────────────────────────────────────────────────────────┘
```

#### Was eine Signatur enthält

1. **Header-Kommentare:** Alle Kommentare am Anfang der Datei (vor dem ersten Code) und Klassen-/Namespace-Ebene Kommentare
2. **Klassen/Structs:** Alle Typ-Definitionen
3. **Methoden-Prototypen:** Nur die Signaturen, keine Implementierung

#### Was eine Signatur NICHT enthält

- Implementierungen (Methodenbodies)
- Kommentare innerhalb von Methoden
- Private Felder
- Lokale Variablen

### 2.6 Projekt-Summary

Eine übergeordnete Beschreibung des gesamten Projekts:

```markdown
# UCTornado

## Zweck
3D-Tornado-Simulation für Wetterdaten-Visualisierung

## Architektur
- Entry Point: src/Program.cs
- Hauptklasse: src/Core/TornadoEngine.cs
- Rendering: src/Rendering/VortexRenderer.cs

## Wichtige Konzepte
- VortexField: Das Vektorfeld der Windströmung
- ParticleSystem: Visualisiert Debris im Tornado
- DataSource: Interface für Wetterdaten-Input

## Dependencies
- LibPyramid3D (3D-Rendering)
- LibWeatherData (Datenformate)

## Patterns
- MVVM für UI
- ECS für Partikel-Simulation
```

#### Automatisch generierte Teile

Beim `init` werden automatisch erkannt:
- Entry Points (Program.cs, main.ts, index.js...)
- Hauptklassen (meistgenutzte/referenzierte Terme)
- Dependencies aus csproj/package.json
- Verzeichnisstruktur

#### Manuell ergänzbare Teile

- Zweck/Purpose
- Wichtige Konzepte
- Architektur-Entscheidungen
- Patterns

Diese werden **nie überschrieben**, nur ergänzt.

### 2.7 Projektdokumentation (Claude.md Integration)

Die Inhalte der CLAUDE.md-Dateien werden direkt in CodeGraph integriert:

```
.codegraph/
├── index.db
├── summary.md           ← Projekt-Summary (auto + manuell)
└── docs.md              ← CLAUDE.md Inhalte (importiert)
```

#### Was importiert wird

- **Projekt-CLAUDE.md:** `.claude/CLAUDE.md` oder `CLAUDE.md` im Root
- **Library-CLAUDE.md:** Alle `CLAUDE.md` in Unterverzeichnissen
- **Struktur bleibt erhalten:** Überschriften werden zu Abschnitten

#### Beispiel

```markdown
# docs.md (generiert aus CLAUDE.md-Dateien)

## Projekt: UCTornado
> Quelle: .claude/CLAUDE.md

[Inhalt der Haupt-CLAUDE.md]

---

## Library: src/Physics
> Quelle: src/Physics/CLAUDE.md

[Inhalt der Physics-CLAUDE.md]

---

## Library: src/Rendering
> Quelle: src/Rendering/CLAUDE.md

[Inhalt der Rendering-CLAUDE.md]
```

#### Synchronisation

- Bei `codegraph_init`: Alle CLAUDE.md-Dateien werden importiert
- Bei `codegraph_update_docs`: Manueller Re-Import
- Die Original-CLAUDE.md-Dateien bleiben unverändert (read-only Import)

#### Neues Tool

```typescript
codegraph_docs({
    section?: string;  // Optional: Nur bestimmten Abschnitt
})
// → Gibt die komplette docs.md zurück

codegraph_update_docs()
// → Re-importiert alle CLAUDE.md-Dateien
```

### 2.8 Dependencies (Verknüpfungen)

Wenn Projekt A eine Library B nutzt, wird deren CodeGraph verknüpft:

```
UCTornado/.codegraph/
    → verlinkt auf → LibPyramid3D/.codegraph/
    → verlinkt auf → LibWeatherData/.codegraph/
```

Eine Suche kann dann **über alle verknüpften Projekte** gehen:

```
codegraph_query "PyramidMesh" --include-dependencies
→ Findet Treffer in UCTornado UND LibPyramid3D
```

---

## 3. Architektur

### 3.1 Komponenten-Übersicht

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
│                    .codegraph/ Verzeichnis                   │
│  ┌─────────────────────────┐  ┌───────────────────────────┐ │
│  │      index.db           │  │      summary.md           │ │
│  │  ───────────────────    │  │  ─────────────────────    │ │
│  │  files                  │  │  Projekt-Beschreibung     │ │
│  │  lines                  │  │  (auto + manuell)         │ │
│  │  items                  │  │                           │ │
│  │  occurrences            │  │                           │ │
│  │  signatures             │  │                           │ │
│  │  methods                │  │                           │ │
│  │  dependencies           │  │                           │ │
│  └─────────────────────────┘  └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Technologie-Stack

| Komponente | Technologie | Begründung |
|------------|-------------|------------|
| Runtime | Node.js / TypeScript | Native MCP-Unterstützung, plattformunabhängig |
| Datenbank | SQLite | Eingebettet, schnell, eine Datei, bewährt |
| Parser | Tree-sitter | Kennt 100+ Sprachen, unterscheidet Identifier/Keyword/Comment |
| Protocol | MCP (Model Context Protocol) | Standard für Claude Code Tools |

---

## 4. Datenmodell

### 4.1 Entity Relationship Diagramm

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
                 └─────────────┘   (zeigt auf andere .codegraph)
```

### 4.2 Datentypen

#### File

```typescript
interface File {
    id: number;              // Auto-increment
    path: string;            // Relativer Pfad: "src/Core/Engine.cs"
    hash: string;            // SHA-256 oder ähnlich
    last_indexed: number;    // Unix Timestamp
}
```

#### Line

```typescript
interface Line {
    id: number;              // Eindeutig pro Datei, startet bei 1
    file_id: number;         // Referenz auf File
    line_number: number;     // Aktuelle Zeilennummer (1-basiert)
    line_type: LineType;     // 'code' | 'comment' | 'struct' | 'method' | 'property' | 'string'
}

// Composite Key: (file_id, id)
```

#### Item

```typescript
interface Item {
    id: number;              // Auto-increment
    term: string;            // Der indizierte Begriff: "PlayerHealth"
}
```

#### Occurrence

```typescript
interface Occurrence {
    item_id: number;         // Referenz auf Item
    file_id: number;         // Referenz auf File
    line_id: number;         // Referenz auf Line (innerhalb der Datei)
}
```

#### Signature

```typescript
interface Signature {
    file_id: number;         // Referenz auf File (1:1)
    header_comments: string; // Alle Header-Kommentare, zusammengefasst
}
```

#### Method

```typescript
interface Method {
    id: number;              // Auto-increment
    file_id: number;         // Referenz auf File
    name: string;            // "CalculateField"
    prototype: string;       // "VortexField CalculateField(Vector3 center, float radius)"
    line_number: number;     // Wo die Methode beginnt
}
```

#### Dependency

```typescript
interface Dependency {
    id: number;              // Auto-increment
    path: string;            // Absoluter Pfad zur anderen .codegraph
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
PRAGMA journal_mode = WAL;  -- Write-Ahead Logging für Performance

-- ------------------------------------------------------------
-- Dateibaum
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
-- Zeilenobjekte
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
-- Items (Terme)
-- ------------------------------------------------------------
CREATE TABLE items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE INDEX idx_items_term ON items(term);

-- Für contains/starts_with Suchen
CREATE INDEX idx_items_term_pattern ON items(term COLLATE NOCASE);

-- ------------------------------------------------------------
-- Item-Vorkommen
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
-- Datei-Signaturen
-- ------------------------------------------------------------
CREATE TABLE signatures (
    file_id INTEGER PRIMARY KEY,
    header_comments TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Methoden/Funktionen
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
-- Klassen/Structs/Interfaces
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
-- Abhängigkeiten zu anderen CodeGraph-Instanzen
-- ------------------------------------------------------------
CREATE TABLE dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    name TEXT,  -- Optionaler Anzeigename: "LibPyramid3D"
    last_checked INTEGER  -- Wann zuletzt verfügbar
);

-- ------------------------------------------------------------
-- Metadaten
-- ------------------------------------------------------------
CREATE TABLE metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- Initial-Metadaten
INSERT INTO metadata (key, value) VALUES
    ('schema_version', '1.0'),
    ('created_at', strftime('%s', 'now')),
    ('project_name', NULL),
    ('project_root', NULL);
```

---

## 6. Parser-System

### 6.1 Tree-sitter Integration

Tree-sitter ist ein inkrementeller Parser, der:
- Die Grammatik von 100+ Sprachen kennt
- Zuverlässig zwischen Identifier, Keyword, Comment, String unterscheidet
- Inkrementelles Parsing unterstützt (nur geänderte Teile)

#### Unterstützte Sprachen (Initial)

| Sprache | Tree-sitter Package | Keywords-Filter |
|---------|---------------------|-----------------|
| C# | tree-sitter-c-sharp | csharp.ts |
| TypeScript | tree-sitter-typescript | typescript.ts |
| JavaScript | tree-sitter-javascript | javascript.ts |
| Python | tree-sitter-python | python.ts |
| Go | tree-sitter-go | go.ts |
| Rust | tree-sitter-rust | rust.ts |

### 6.2 Extraktion-Pipeline

```
Quelldatei
    │
    ▼
┌─────────────────────────────────────────┐
│           Tree-sitter Parser            │
│  ─────────────────────────────────────  │
│  Erzeugt Abstract Syntax Tree (AST)     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│           Node Visitor                  │
│  ─────────────────────────────────────  │
│  Traversiert den AST                    │
│  Klassifiziert jeden Node               │
└─────────────────────────────────────────┘
    │
    ├──► Identifier → Keyword-Filter → Items
    │
    ├──► Comment → Text extrahieren → Items + Zeile als 'comment'
    │
    ├──► Method/Function → Prototype → Methods-Tabelle
    │
    ├──► Class/Struct/Interface → Types-Tabelle
    │
    └──► String Literal → Optional für spätere Suche
```

### 6.3 Keyword-Filter Beispiel (C#)

```typescript
// src/parser/languages/csharp.ts

export const CSHARP_KEYWORDS = new Set([
    // Zugriffsmodifikatoren
    'public', 'private', 'protected', 'internal',

    // Typ-Keywords
    'class', 'struct', 'interface', 'enum', 'record',
    'namespace', 'using',

    // Modifikatoren
    'static', 'readonly', 'const', 'volatile',
    'virtual', 'override', 'abstract', 'sealed',
    'async', 'await', 'partial',

    // Primitive Typen
    'void', 'int', 'uint', 'long', 'ulong', 'short', 'ushort',
    'byte', 'sbyte', 'float', 'double', 'decimal',
    'bool', 'char', 'string', 'object', 'dynamic', 'var',

    // Kontrollfluss
    'if', 'else', 'switch', 'case', 'default',
    'for', 'foreach', 'while', 'do',
    'break', 'continue', 'return', 'yield',
    'try', 'catch', 'finally', 'throw',
    'goto',

    // Operatoren/Literale
    'new', 'typeof', 'sizeof', 'nameof',
    'is', 'as', 'in', 'out', 'ref',
    'true', 'false', 'null',
    'this', 'base',

    // Andere
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

### 6.4 Signatur-Extraktion

```typescript
// Pseudocode für Signatur-Extraktion

function extractSignature(ast: AST, filePath: string): Signature {
    const headerComments: string[] = [];
    const methods: Method[] = [];
    const types: Type[] = [];

    // 1. Header-Kommentare sammeln (vor erstem Code)
    for (const node of ast.rootNode.children) {
        if (node.type === 'comment') {
            headerComments.push(extractCommentText(node));
        } else if (!isUsingOrNamespace(node)) {
            break;  // Erster echter Code erreicht
        }
    }

    // 2. Klassen-Level Kommentare sammeln
    for (const classNode of findNodes(ast, 'class_declaration')) {
        const docComment = findPrecedingComment(classNode);
        if (docComment) {
            headerComments.push(extractCommentText(docComment));
        }

        // Typ erfassen
        types.push({
            name: getClassName(classNode),
            kind: 'class',
            line_number: classNode.startPosition.row + 1
        });
    }

    // 3. Methoden-Prototypen sammeln (keine Bodies)
    for (const methodNode of findNodes(ast, 'method_declaration')) {
        methods.push({
            name: getMethodName(methodNode),
            prototype: getMethodPrototype(methodNode),  // Nur Signatur!
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

## 7. Update-Mechanismus

### 7.1 Inkrementelles Update

Das Kernprinzip: **Nur ändern, was sich geändert hat.**

#### Szenario: Zeilen 45-52 in Engine.cs geändert

```typescript
codegraph_update({
    file: "src/Core/Engine.cs",
    from_line: 45,
    to_line: 52
});
```

**Was passiert:**

1. **Datei laden** und mit Tree-sitter parsen
2. **Betroffene Zeilen identifizieren:**
   - Alle Lines mit `line_number` zwischen 45 und 52
3. **Alte Daten entfernen:**
   - Occurrences die auf diese Lines zeigen
   - Items die nur hier vorkamen (Referenzcount = 0)
4. **Neue Daten extrahieren:**
   - Zeilen 45-52 parsen
   - Neue Items/Occurrences anlegen
5. **Offset berechnen:**
   - Alte Zeilenanzahl vs. neue Zeilenanzahl
   - Alle Lines ab Zeile 53 um Offset verschieben
6. **Hash aktualisieren**

#### Offset-Berechnung

```typescript
// Beispiel: 5 Zeilen wurden eingefügt bei Zeile 50

const oldLineCount = getLineCountFromDB(fileId);  // 100
const newLineCount = countLinesInFile(filePath);  // 105
const offset = newLineCount - oldLineCount;       // +5

// Alle Zeilen ab der Änderung verschieben
UPDATE lines
SET line_number = line_number + 5
WHERE file_id = ? AND line_number >= 50;
```

### 7.2 Vollständiges Update

Wenn keine Zeilenangaben gemacht werden:

```typescript
codegraph_update({
    file: "src/Core/Engine.cs"
    // keine from_line/to_line
});
```

**Was passiert:**

1. Alle Daten für diese Datei löschen (CASCADE)
2. Datei komplett neu parsen
3. Alle Daten neu anlegen
4. Hash aktualisieren

### 7.3 Datei hinzugefügt

```typescript
// Automatisch bei update, wenn Datei noch nicht existiert
codegraph_update({
    file: "src/NewFeature/NewClass.cs"
});
```

**Was passiert:**

1. Neuer Eintrag in `files`
2. Komplettes Parsing
3. Alle Tabellen befüllen

### 7.4 Datei gelöscht

```typescript
codegraph_remove({
    file: "src/OldStuff/Deprecated.cs"
});
```

**Was passiert:**

1. `DELETE FROM files WHERE path = ?`
2. Alle abhängigen Daten werden durch CASCADE gelöscht

### 7.5 Batch-Update

Für viele Dateien gleichzeitig:

```typescript
codegraph_update_batch({
    files: [
        { file: "src/A.cs" },
        { file: "src/B.cs", from_line: 10, to_line: 20 },
        { file: "src/C.cs" }
    ]
});
```

Wird in einer Transaktion ausgeführt für Konsistenz und Performance.

---

## 8. MCP Server Interface

### 8.1 Tool-Übersicht

| Tool | Beschreibung |
|------|--------------|
| `codegraph_init` | Neues Projekt initialisieren |
| `codegraph_update` | Datei(bereich) neu indexieren |
| `codegraph_remove` | Datei aus Index entfernen |
| `codegraph_query` | Items/Terme suchen |
| `codegraph_signature` | Datei-Signatur abrufen |
| `codegraph_signatures` | Mehrere Signaturen abrufen |
| `codegraph_summary` | Projekt-Summary abrufen |
| `codegraph_describe` | Projekt-Summary ergänzen |
| `codegraph_tree` | Dateibaum abrufen |
| `codegraph_link` | Dependency verknüpfen |
| `codegraph_status` | Status/Statistiken abrufen |

### 8.2 Tool-Definitionen

#### codegraph_init

Initialisiert CodeGraph für ein Projekt.

```typescript
interface InitParams {
    path: string;           // Projektverzeichnis
    name?: string;          // Optionaler Projektname
    languages?: string[];   // Zu indizieren: ['csharp', 'typescript']
    exclude?: string[];     // Auszuschließende Patterns: ['**/bin/**', '**/node_modules/**']
}

interface InitResult {
    success: boolean;
    codegraph_path: string;  // Pfad zur .codegraph
    files_indexed: number;
    items_found: number;
    duration_ms: number;
}
```

**Beispiel:**
```typescript
codegraph_init({
    path: "Q:/develop/Repos/UCTornado",
    name: "UCTornado",
    languages: ["csharp"],
    exclude: ["**/bin/**", "**/obj/**"]
});
```

#### codegraph_update

Aktualisiert den Index für eine oder mehrere Dateien.

```typescript
interface UpdateParams {
    file: string;           // Relativer Pfad zur Datei
    from_line?: number;     // Optional: Start der Änderung
    to_line?: number;       // Optional: Ende der Änderung
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

**Beispiele:**
```typescript
// Ganze Datei neu indexieren
codegraph_update({
    file: "src/Core/Engine.cs"
});

// Nur Zeilen 45-52 aktualisieren
codegraph_update({
    file: "src/Core/Engine.cs",
    from_line: 45,
    to_line: 52
});
```

#### codegraph_query

Sucht nach Items/Termen im Index.

```typescript
interface QueryParams {
    term: string;                    // Suchbegriff
    mode?: 'exact' | 'contains' | 'starts_with' | 'regex';  // Default: 'exact'
    include_dependencies?: boolean;  // Auch in verlinkten Projekten suchen
    file_filter?: string;            // Glob-Pattern: "src/Core/**"
    type_filter?: string[];          // Nur bestimmte Zeilentypen: ['code', 'comment']
    limit?: number;                  // Max. Ergebnisse
}

interface QueryResult {
    term: string;
    matches: Array<{
        file: string;
        line_number: number;
        line_type: string;
        project?: string;   // Bei Dependencies: Name des Projekts
    }>;
    total_matches: number;
}
```

**Beispiele:**
```typescript
// Exakte Suche
codegraph_query({
    term: "PlayerHealth"
});
// → [{ file: "Engine.cs", line_number: 45, line_type: "code" }, ...]

// Enthält-Suche
codegraph_query({
    term: "Player",
    mode: "contains"
});
// → Findet PlayerHealth, PlayerManager, UpdatePlayer, ...

// Mit Dependencies
codegraph_query({
    term: "PyramidMesh",
    include_dependencies: true
});
// → Findet auch in LibPyramid3D
```

#### codegraph_signature

Ruft die Signatur einer Datei ab.

```typescript
interface SignatureParams {
    file: string;           // Relativer Pfad
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

**Beispiel:**
```typescript
codegraph_signature({
    file: "src/Core/TornadoEngine.cs"
});
// → {
//     header_comments: "Hauptklasse für die Tornado-Simulation...",
//     types: [{ name: "TornadoEngine", kind: "class", line_number: 15 }],
//     methods: [
//         { name: "Initialize", prototype: "void Initialize(VortexConfig config)", ... },
//         { name: "Update", prototype: "void Update(float deltaTime)", ... },
//         ...
//     ]
// }
```

#### codegraph_signatures

Ruft Signaturen für mehrere Dateien ab.

```typescript
interface SignaturesParams {
    path?: string;          // Verzeichnis (Glob-Pattern)
    files?: string[];       // Oder explizite Dateiliste
}

interface SignaturesResult {
    signatures: SignatureResult[];
}
```

**Beispiel:**
```typescript
codegraph_signatures({
    path: "src/Core/**/*.cs"
});
```

#### codegraph_summary

Ruft die Projekt-Summary ab.

```typescript
interface SummaryParams {
    // keine Parameter
}

interface SummaryResult {
    name: string;
    content: string;        // Markdown-Inhalt der summary.md
    auto_generated: {
        entry_points: string[];
        main_classes: string[];
        dependencies: string[];
    };
}
```

#### codegraph_describe

Ergänzt die Projekt-Summary.

```typescript
interface DescribeParams {
    section: 'purpose' | 'architecture' | 'concepts' | 'patterns' | 'custom';
    content: string;
    replace?: boolean;      // Existierenden Abschnitt ersetzen? Default: false (append)
}

interface DescribeResult {
    success: boolean;
    section: string;
}
```

**Beispiel:**
```typescript
codegraph_describe({
    section: "purpose",
    content: "3D-Tornado-Simulation für Wetterdaten-Visualisierung"
});
```

#### codegraph_tree

Ruft den Dateibaum ab.

```typescript
interface TreeParams {
    path?: string;          // Unterverzeichnis, default: root
    depth?: number;         // Max. Tiefe
    include_stats?: boolean; // Item-Counts pro Datei
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

Verknüpft eine Dependency.

```typescript
interface LinkParams {
    path: string;           // Pfad zur anderen .codegraph oder zum Projekt
    name?: string;          // Optionaler Anzeigename
}

interface LinkResult {
    success: boolean;
    dependency_id: number;
    name: string;
    files_available: number;
}
```

**Beispiel:**
```typescript
codegraph_link({
    path: "Q:/develop/Repos/LibPyramid3D",
    name: "LibPyramid3D"
});
```

#### codegraph_status

Ruft Status und Statistiken ab.

```typescript
interface StatusParams {
    // keine Parameter
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

## 9. Workflow-Beispiele

### 9.1 Neues Projekt aufsetzen

```typescript
// 1. Projekt initialisieren
codegraph_init({
    path: "Q:/develop/Repos/UCTornado",
    name: "UCTornado",
    languages: ["csharp"]
});
// → Scannt alle .cs Dateien, erstellt Index

// 2. Zweck dokumentieren
codegraph_describe({
    section: "purpose",
    content: "3D-Tornado-Simulation für Wetterdaten-Visualisierung"
});

// 3. Library verknüpfen
codegraph_link({
    path: "Q:/develop/Repos/LibPyramid3D"
});
```

### 9.2 Unbekanntes Projekt verstehen

```typescript
// 1. Summary lesen
codegraph_summary();
// → Gibt Überblick über Zweck, Entry Points, Dependencies

// 2. Kern-Signaturen anschauen
codegraph_signatures({ path: "src/Core/**" });
// → Alle Methoden und Klassen im Core-Verzeichnis

// 3. Spezifischen Begriff suchen
codegraph_query({ term: "Vortex", mode: "contains" });
// → Wo wird "Vortex" überall verwendet?
```

### 9.3 Code ändern und Index aktuell halten

```typescript
// 1. Ich ändere Engine.cs, Zeilen 120-135
// (Claude macht Edit)

// 2. Index aktualisieren
codegraph_update({
    file: "src/Core/Engine.cs",
    from_line: 120,
    to_line: 135
});

// 3. Weiterarbeiten mit aktuellem Index
```

### 9.4 Refactoring: Methode finden und umbenennen

```typescript
// 1. Wo wird "CalculateDamage" verwendet?
codegraph_query({ term: "CalculateDamage" });
// → Engine.cs:156, Player.cs:89, Enemy.cs:234

// 2. Signatur anschauen
codegraph_signature({ file: "src/Core/Engine.cs" });
// → void CalculateDamage(Entity target, int baseDamage)

// 3. Alle Stellen bearbeiten...
// 4. Nach Refactoring: Betroffene Dateien updaten
codegraph_update({ file: "src/Core/Engine.cs" });
codegraph_update({ file: "src/Entities/Player.cs" });
codegraph_update({ file: "src/Entities/Enemy.cs" });
```

### 9.5 Cross-Project Suche

```typescript
// Ich arbeite in UCTornado und suche eine Methode aus LibPyramid3D
codegraph_query({
    term: "RenderMesh",
    include_dependencies: true
});
// → UCTornado: src/Rendering/VortexRenderer.cs:45 (Aufruf)
// → LibPyramid3D: src/Core/MeshRenderer.cs:123 (Definition)
```

---

## 10. Projektstruktur

```
Q:\develop\Tools\CodeGraph\
├── package.json
├── tsconfig.json
├── README.md
├── CODEGRAPH-SPEC.md          ← Diese Datei
│
├── src/
│   ├── index.ts               ← MCP Server Entry Point
│   │
│   ├── server/
│   │   ├── mcp-server.ts      ← MCP Protocol Handler
│   │   └── tools.ts           ← Tool-Registrierungen
│   │
│   ├── db/
│   │   ├── database.ts        ← SQLite Wrapper
│   │   ├── schema.ts          ← Tabellendefinitionen
│   │   ├── queries.ts         ← Prepared Statements
│   │   └── migrations/        ← Schema-Migrationen
│   │       └── 001-initial.sql
│   │
│   ├── parser/
│   │   ├── extractor.ts       ← Haupt-Extraktor
│   │   ├── tree-sitter.ts     ← Tree-sitter Integration
│   │   ├── signature.ts       ← Signatur-Extraktion
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
│       ├── hash.ts            ← Datei-Hashing
│       ├── glob.ts            ← Glob-Pattern Matching
│       └── logger.ts          ← Logging
│
├── test/
│   ├── fixtures/              ← Test-Quelldateien
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
    └── install-languages.ts   ← Tree-sitter Sprachen installieren
```

---

## 11. Zukünftige Erweiterungen

### 11.1 Vektor-Embeddings (Semantische Suche)

Später könnte der Item-Vektorraum zu echten Vektor-Embeddings erweitert werden:

```typescript
// Statt nur exakter/contains Suche:
codegraph_query({
    term: "Spieler Gesundheit",  // Natürliche Sprache!
    mode: "semantic"
});
// → Findet "PlayerHealth", "CharacterHP", "HealthPoints", ...
```

Technologie: SQLite mit vec0-Extension oder separate Vector-DB.

### 11.2 Änderungs-Tracking (Git Integration)

```typescript
// Automatisch nach git commit:
codegraph_sync_git({
    from_commit: "abc123",
    to_commit: "HEAD"
});
// → Findet geänderte Dateien, updated nur diese
```

### 11.3 Call Graph

Zusätzlich zu Items: Wer ruft wen auf?

```typescript
codegraph_callers({ method: "CalculateDamage" });
// → [{ file: "Player.cs", method: "TakeDamage", line: 89 }, ...]

codegraph_callees({ method: "Update" });
// → Welche Methoden ruft Update auf?
```

### 11.4 IDE Integration

- VS Code Extension: Automatisches Update bei Speichern
- Visual Studio Extension: Dasselbe
- JetBrains Plugin: Dasselbe

### 11.5 Web Dashboard

Lokales Web-UI zur Visualisierung:
- Dateibaum mit Statistiken
- Item-Wolke
- Dependency-Graph
- Suche mit Preview

---

## Anhang A: Glossar

| Begriff | Bedeutung |
|---------|-----------|
| **CodeGraph** | Das gesamte Tool/System |
| **ProjectBase** | Die .codegraph-Instanz eines Projekts |
| **Item** | Ein indizierter Begriff/Term (kein Sprach-Keyword) |
| **Occurrence** | Ein Vorkommen eines Items an einer bestimmten Stelle |
| **Signature** | Schnell-Profil einer Datei (Header-Kommentare + Prototypen) |
| **Dependency** | Verknüpfung zu einer anderen ProjectBase |
| **Tree-sitter** | Parser-Bibliothek für Syntax-Analyse |

---

## Anhang B: Konfiguration

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

### Projekt-spezifische Konfiguration (.codegraph/config.json)

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

*Ende der Spezifikation*
