# AiDex - Projekt-Einstieg für Uwe

Stand: 27.01.2026 | Version: 1.3.0

---

## Was ist AiDex?

Ein **MCP-Server** für Claude Code. Er indexiert deinen Quellcode in einer SQLite-Datenbank, damit Claude Funktionen, Klassen und Variablen in Millisekunden findet - statt mit Grep alle Dateien zu durchsuchen.

**Kernnutzen:** Claude arbeitet schneller und präziser, weil er nicht mehr raten muss, wo Code definiert ist.

---

## Wie wird es benutzt?

AiDex läuft als MCP-Server im Hintergrund. Claude Code ruft die Tools automatisch auf.

**Registrierung** in `~/.claude/settings.json`:
```json
"aidex": {
  "command": "node",
  "args": ["Q:/develop/Tools/AiDex/build/index.js"]
}
```

**Nach Code-Änderungen:** `npm run build`, dann Claude Code neu starten.

---

## Die 5 wichtigsten Konzepte

### 1. Index

Eine SQLite-Datenbank (`.aidex/index.db`) speichert:
- Alle Dateien mit ihrem Hash
- Alle Identifier (Funktionsnamen, Variablen, Klassen)
- Methoden-Signaturen und Typen
- Zeilennummern

**Erstellen:** `aidex_init` scannt das Projekt und baut den Index.

### 2. Hash-basiertes Update

Jede Datei hat einen Hash. Bei `aidex_update`:
- Hash unverändert → nichts tun
- Hash geändert → Datei neu parsen, Index aktualisieren

**Wichtig:** Claude ruft `aidex_update` nach jedem Edit auf. Das steht in der Tool-Beschreibung (`tools.ts` Zeile 141), und Claude befolgt es.

### 3. Session-Tracking

`aidex_session` speichert den Startzeitpunkt. Damit kann man später fragen: "Was wurde in dieser Session geändert?"

- `last_indexed > session_start` = Datei wurde in dieser Session bearbeitet
- Bei Session-Start werden externe Änderungen erkannt und automatisch re-indexiert

### 4. Session-Notizen

`aidex_note` speichert Text in der Datenbank. Persistiert zwischen Sessions. Für Erinnerungen wie "Morgen X testen".

### 5. Viewer

Ein HTTP-Server mit WebSocket (`localhost:3333`). Zeigt den Projektbaum im Browser. Dateien, die in der aktuellen Session geändert wurden, sind markiert.

---

## Projektstruktur

```
Q:\develop\Tools\AiDex\
├── src/
│   ├── index.ts                 # Entry Point (MCP-Server oder CLI)
│   │
│   ├── server/
│   │   ├── mcp-server.ts        # MCP-Protokoll-Handler
│   │   └── tools.ts             # Tool-Definitionen + Handler
│   │                            # (DIE BESCHREIBUNGEN STEUERN CLAUDE!)
│   │
│   ├── commands/                # Implementierung der Tools
│   │   ├── init.ts              # Projekt indexieren
│   │   ├── query.ts             # Suchen im Index
│   │   ├── update.ts            # Einzelne Datei updaten
│   │   ├── remove.ts            # Datei aus Index entfernen
│   │   ├── signature.ts         # Datei-Signatur abrufen
│   │   ├── signatures.ts        # Mehrere Signaturen (Glob)
│   │   ├── summary.ts           # Projekt-Übersicht
│   │   ├── tree.ts              # Dateibaum
│   │   ├── describe.ts          # Doku in summary.md schreiben
│   │   ├── files.ts             # Dateien auflisten
│   │   ├── link.ts              # Dependency-Projekte verlinken
│   │   ├── scan.ts              # Indexierte Projekte finden
│   │   ├── session.ts           # Session starten/prüfen
│   │   └── note.ts              # Session-Notizen
│   │
│   ├── db/
│   │   ├── database.ts          # SQLite-Wrapper (better-sqlite3)
│   │   ├── queries.ts           # Prepared Statements
│   │   └── schema.sql           # Tabellenstruktur
│   │
│   ├── parser/
│   │   ├── tree-sitter.ts       # Code parsen (1MB Buffer)
│   │   ├── extractor.ts         # Identifier + Signaturen extrahieren
│   │   └── languages/           # Keyword-Filter pro Sprache
│   │
│   └── viewer/
│       ├── index.ts             # Export
│       └── server.ts            # HTTP + WebSocket Server
│
├── build/                       # Kompilierter Code (npm run build)
├── .aidex/                  # Index dieses Projekts selbst
└── .claude/
    ├── CLAUDE.md                # Technische Doku für Claude
    └── PROJEKT-EINSTIEG.md      # Diese Datei
```

---

## Datenbank-Tabellen

| Tabelle | Inhalt |
|---------|--------|
| `files` | Pfad, Hash, last_indexed Timestamp |
| `lines` | Zeilen mit Hash und modified Timestamp |
| `items` | Identifier (case-insensitive gespeichert) |
| `occurrences` | Wo jeder Identifier vorkommt (Datei + Zeile) |
| `methods` | Methoden-Prototypen mit Visibility, async, static |
| `types` | Klassen, Interfaces, Structs |
| `signatures` | Header-Kommentare von Dateien |
| `project_files` | Alle Dateien mit Typ (code, config, doc, etc.) |
| `metadata` | Key-Value Store (Session-Zeiten, Notizen) |

---

## Tools (18 Stück)

### Suche & Index
- `aidex_init` - Projekt indexieren
- `aidex_query` - Identifier suchen (exact/contains/starts_with)
- `aidex_update` - Eine Datei neu indexieren
- `aidex_remove` - Datei aus Index entfernen
- `aidex_status` - Server-/Projekt-Status

### Signaturen (statt Dateien lesen)
- `aidex_signature` - Signatur einer Datei
- `aidex_signatures` - Signaturen mehrerer Dateien (Glob)

### Projekt-Übersicht
- `aidex_summary` - Entry Points, Sprachen, Haupttypen
- `aidex_tree` - Dateibaum mit Stats
- `aidex_describe` - Doku zu summary.md hinzufügen
- `aidex_files` - Alle Dateien auflisten, mit Typ-Filter

### Cross-Project
- `aidex_link` - Dependency verlinken
- `aidex_unlink` - Dependency entfernen
- `aidex_links` - Verlinkte Dependencies auflisten
- `aidex_scan` - Indexierte Projekte finden

### Session
- `aidex_session` - Session starten, externe Änderungen erkennen
- `aidex_note` - Session-Notiz lesen/schreiben
- `aidex_viewer` - Browser-Explorer öffnen

---

## Unterstützte Sprachen

C#, TypeScript, JavaScript, Rust, Python, C, C++, Java, Go, PHP, Ruby

Jede Sprache hat einen Keyword-Filter in `src/parser/languages/`, damit Sprachkeywords nicht als Identifier indexiert werden.

---

## Entwickler-Workflow

1. **Code ändern** in `src/`
2. **Build:** `npm run build`
3. **Claude Code neu starten** (MCP-Server wird neu geladen)
4. **Testen** mit Claude oder CLI: `node build/index.js init .`

---

## Wichtige Design-Entscheidungen

### Warum kein automatisches Re-Indexing bei Dateiänderungen?

Der MCP-Server beobachtet das Dateisystem nicht aktiv. Stattdessen:
- Claude ruft `aidex_update` auf (weil die Tool-Beschreibung es sagt)
- Bei Session-Start werden externe Änderungen erkannt

Das ist einfacher, zuverlässiger und braucht keine Hintergrundprozesse.

### Warum SQLite?

- Kein Server nötig
- Datei kann mit dem Projekt verschoben werden
- WAL-Modus für Performance
- Prepared Statements für schnelle Abfragen

### Warum Tool-Beschreibungen so wichtig sind?

Claude liest die Beschreibungen und entscheidet, wann er ein Tool aufruft. Die Beschreibung von `aidex_update` sagt:
> "Use after editing a file to update the AiDex index."

Das ist die einzige "Konfiguration", die Claude braucht.

---

## Typische Probleme und Lösungen

| Problem | Ursache | Lösung |
|---------|---------|--------|
| Suche findet falsche Zeilennummern | Index veraltet | `aidex_init` oder `aidex_update` |
| "No AiDex index found" | Projekt nicht indexiert | `aidex_init` ausführen |
| Viewer zeigt nichts | Server nicht gestartet | `aidex_viewer` aufrufen |
| Neue Sprache wird nicht erkannt | Kein Parser | Prüfen ob Sprache in der Liste ist |

---

## Nächste Schritte (Stand 27.01.2026)

Siehe Session-Notiz (`aidex_note`):

> Viewer prüfen: Zeigt er Session-Änderungen (last_indexed > session_start) oder Disk-vs-DB-Hash-Unterschiede?

---

## Schnellstart nach Pause

1. `npm run build` (falls Code geändert)
2. Claude Code starten
3. `aidex_session` aufrufen - zeigt Notizen und externe Änderungen
4. Loslegen

---

*Bei Fragen: Rudi fragen. Er vergisst nichts.*
