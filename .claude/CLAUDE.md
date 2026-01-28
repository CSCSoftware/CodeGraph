# CodeGraph - CLAUDE.md

MCP Server für persistentes Code-Indexing. Ermöglicht Claude Code schnelle, präzise Suchen statt Grep/Glob.

**Version:** 1.3.1 | **Sprachen:** 11 | **Repo:** https://github.com/CSCSoftware/CodeGraph

## Build & Run

```bash
npm install && npm run build    # Einmalig
npm run build                   # Nach Code-Änderungen
```

Registriert in `~/.claude/settings.json`:
```json
"codegraph": {
  "command": "node",
  "args": ["Q:/develop/Tools/CodeGraph/build/index.js"]
}
```

**Nach Änderungen:** Build ausführen, dann Claude Code neu starten.

## Tools (18)

### Suche & Index
| Tool | Beschreibung |
|------|--------------|
| `codegraph_init` | Projekt indexieren |
| `codegraph_query` | Terme suchen (exact/contains/starts_with), Zeit-Filter |
| `codegraph_status` | Index-Statistiken |
| `codegraph_update` | Einzelne Datei neu indexieren |
| `codegraph_remove` | Datei aus Index entfernen |

### Signaturen (statt Read!)
| Tool | Beschreibung |
|------|--------------|
| `codegraph_signature` | Datei-Signatur (Types + Methods) |
| `codegraph_signatures` | Mehrere Dateien (Glob-Pattern) |

### Projekt-Übersicht
| Tool | Beschreibung |
|------|--------------|
| `codegraph_summary` | Projekt-Übersicht mit Entry Points |
| `codegraph_tree` | Dateibaum mit Stats |
| `codegraph_describe` | Dokumentation zu summary.md |
| `codegraph_files` | Projektdateien nach Typ, `modified_since` |

### Cross-Project
| Tool | Beschreibung |
|------|--------------|
| `codegraph_link/unlink/links` | Dependencies verlinken |
| `codegraph_scan` | Indexierte Projekte finden |

### Session (v1.2+)
| Tool | Beschreibung |
|------|--------------|
| `codegraph_session` | Session starten, externe Änderungen erkennen |
| `codegraph_note` | Session-Notizen (persistiert in DB) |
| `codegraph_viewer` | Browser-Explorer mit Live-Reload (v1.3) |

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
│   ├── session.ts, note.ts
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

## Wichtige Features

### Zeit-Filter (v1.1)
```
codegraph_query({ term: "render", modified_since: "2h" })
codegraph_files({ path: ".", modified_since: "30m" })
```
Formate: `30m`, `2h`, `1d`, `1w`, ISO-Datum

### Session-Notizen (v1.2)
```
codegraph_note({ path: ".", note: "Fix testen" })     # Schreiben
codegraph_note({ path: ".", append: true, note: "+" }) # Anhängen
codegraph_note({ path: "." })                          # Lesen
codegraph_note({ path: ".", clear: true })             # Löschen
```

### Interactive Viewer (v1.3)
```
codegraph_viewer({ path: "." })                        # http://localhost:3333
codegraph_viewer({ path: ".", action: "close" })
```
- Dateibaum mit Klick-Navigation
- Signaturen anzeigen
- Live-Reload (chokidar)
- Syntax-Highlighting
- Git-Status mit Katzen-Icons (v1.3.1)

### Auto-Cleanup (v1.3.1)
`codegraph_init` entfernt automatisch Dateien die jetzt excluded sind (z.B. build/).
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
