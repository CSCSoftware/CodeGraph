# AiDex - CLAUDE.md

MCP Server für persistentes Code-Indexing. Ermöglicht Claude Code schnelle, präzise Suchen statt Grep/Glob.

**Version:** 1.8.0 | **Sprachen:** 11 | **Repo:** https://github.com/CSCSoftware/AiDex

## Build & Run

```bash
npm install && npm run build    # Einmalig
npm run build                   # Nach Code-Änderungen
```

Registriert als MCP Server `aidex` (Prefix: `mcp__aidex__aidex_*`).

**Claude Code** (`~/.claude/settings.json`):
```json
"mcpServers": {
  "aidex": {
    "command": "node",
    "args": ["Q:/develop/Tools/CodeGraph/build/index.js"]
  }
}
```

**Claude Desktop** (`%APPDATA%/Claude/claude_desktop_config.json`):
```json
"mcpServers": {
  "aidex": {
    "command": "C:\\Program Files\\nodejs\\node.exe",
    "args": ["Q:\\develop\\Tools\\CodeGraph\\build\\index.js"]
  }
}
```

**Nach Änderungen:** Build ausführen, dann Claude Code neu starten.
**MCP-Name:** Server muss als `"aidex"` registriert sein → Prefix wird `mcp__aidex__aidex_*`.

## Tools (20)

### Suche & Index
| Tool | Beschreibung |
|------|--------------|
| `aidex_init` | Projekt indexieren |
| `aidex_query` | Terme suchen (exact/contains/starts_with), Zeit-Filter |
| `aidex_status` | Index-Statistiken |
| `aidex_update` | Einzelne Datei neu indexieren |
| `aidex_remove` | Datei aus Index entfernen |

### Signaturen (statt Read!)
| Tool | Beschreibung |
|------|--------------|
| `aidex_signature` | Datei-Signatur (Types + Methods) |
| `aidex_signatures` | Mehrere Dateien (Glob-Pattern) |

### Projekt-Übersicht
| Tool | Beschreibung |
|------|--------------|
| `aidex_summary` | Projekt-Übersicht mit Entry Points |
| `aidex_tree` | Dateibaum mit Stats |
| `aidex_describe` | Dokumentation zu summary.md |
| `aidex_files` | Projektdateien nach Typ, `modified_since` |

### Cross-Project
| Tool | Beschreibung |
|------|--------------|
| `aidex_link/unlink/links` | Dependencies verlinken |
| `aidex_scan` | Indexierte Projekte finden |

### Session (v1.2+)
| Tool | Beschreibung |
|------|--------------|
| `aidex_session` | Session starten, externe Änderungen erkennen |
| `aidex_note` | Session-Notizen (persistiert in DB) |
| `aidex_viewer` | Browser-Explorer mit Live-Reload (v1.3) |

### Task Backlog (v1.8+)
| Tool | Beschreibung |
|------|--------------|
| `aidex_task` | Task CRUD + Log (create/read/update/delete/log) |
| `aidex_tasks` | Tasks auflisten, filtern nach Status/Priority/Tag |

Status: `backlog → active → done | cancelled`

## Sprachen

C# · TypeScript · JavaScript · Rust · Python · C · C++ · Java · Go · PHP · Ruby

## Architektur

```
src/
├── index.ts              # Entry Point (MCP + CLI)
├── server/
│   ├── mcp-server.ts     # MCP Protocol
│   └── tools.ts          # Tool-Handler
├── commands/             # Tool-Implementierungen
│   ├── init.ts, query.ts, signature.ts, update.ts
│   ├── summary.ts, link.ts, scan.ts, files.ts
│   ├── session.ts, note.ts, task.ts
│   └── viewer/server.ts
├── db/
│   ├── database.ts       # SQLite (WAL)
│   ├── queries.ts        # Prepared Statements
│   └── schema.sql
└── parser/
    ├── tree-sitter.ts    # Parser (1MB Buffer)
    ├── extractor.ts      # Identifier + Signaturen
    └── languages/        # Keyword-Filter (11 Sprachen)
```

## Datenbank-Tabellen

| Tabelle | Inhalt |
|---------|--------|
| `files` | Dateibaum (path, hash, last_indexed) |
| `lines` | Zeilen mit line_hash, modified Timestamp |
| `items` | Indexierte Terme (case-insensitive) |
| `occurrences` | Term-Vorkommen |
| `methods` | Methoden-Prototypen |
| `types` | Klassen/Structs/Interfaces |
| `signatures` | Header-Kommentare |
| `project_files` | Alle Dateien mit Typ |
| `metadata` | Key-Value (Sessions, Notizen) |
| `tasks` | Backlog-Tasks (Priority, Status, Tags) |
| `task_log` | Task-Historie (Auto-Log bei Änderungen) |

## Wichtige Features

### Zeit-Filter (v1.1)
```
aidex_query({ term: "render", modified_since: "2h" })
aidex_files({ path: ".", modified_since: "30m" })
```
Formate: `30m`, `2h`, `1d`, `1w`, ISO-Datum

### Session-Notizen (v1.2)
```
aidex_note({ path: ".", note: "Fix testen" })     # Schreiben
aidex_note({ path: ".", append: true, note: "+" }) # Anhängen
aidex_note({ path: "." })                          # Lesen
aidex_note({ path: ".", clear: true })             # Löschen
```

### Interactive Viewer (v1.3)
```
aidex_viewer({ path: "." })                        # http://localhost:3333
aidex_viewer({ path: ".", action: "close" })
```
- Dateibaum mit Klick-Navigation
- Signaturen anzeigen
- Live-Reload (chokidar)
- Syntax-Highlighting
- Git-Status mit Katzen-Icons (v1.3.1)

### Task Backlog (v1.8)
```
aidex_task({ path: ".", action: "create", title: "Bug fixen", priority: 1, tags: "bug" })
aidex_task({ path: ".", action: "read", id: 1 })           # Task + Log lesen
aidex_task({ path: ".", action: "update", id: 1, status: "done" })
aidex_task({ path: ".", action: "log", id: 1, note: "Root cause gefunden" })
aidex_task({ path: ".", action: "delete", id: 1 })
aidex_tasks({ path: "." })                                  # Alle Tasks
aidex_tasks({ path: ".", status: "active", tag: "bug" })    # Gefiltert
```
- Priority: 1=high, 2=medium (default), 3=low
- Status: backlog → active → done | cancelled
- Auto-Log bei Status-Änderungen und Task-Erstellung
- Viewer: Tasks-Tab mit Priority-Farben, Done-Toggle, Cancelled-Sektion (durchgestrichen)

### Auto-Cleanup (v1.3.1)
`aidex_init` entfernt automatisch Dateien die jetzt excluded sind (z.B. build/).
Zeigt "Files removed: N" im Ergebnis.

## CLI

```bash
node build/index.js              # MCP Server
node build/index.js scan <path>  # Projekte finden
node build/index.js init <path>  # Indexieren
```

## Implementierungsdetails

- **Tree-sitter:** 1MB Buffer für große Dateien
- **Hash-Diff:** Zeilen-Timestamps bleiben bei unverändertem Hash
- **Arrow Functions:** Werden als Methods erkannt (gewollt, etwas Noise)
- **Keyword-Filter:** Pro Sprache in `src/parser/languages/`

## Dokumentation

| Datei | Inhalt |
|-------|--------|
| `README.md` | Öffentliche Doku |
| `MCP-API-REFERENCE.md` | Vollständige API |
| `CHANGELOG.md` | Versionshistorie |
