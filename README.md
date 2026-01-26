# CodeGraph

**Persistente Code-Indizierung für Claude Code**

## Das Problem

Wenn Claude Code (der KI-Assistent von Anthropic) mit einem Softwareprojekt arbeitet, muss er bei jeder Suche:

1. **Grep** durch tausende Dateien ausführen
2. **Hunderte Zeilen lesen** um Kontext zu verstehen
3. Den **Kontext vollmüllen** mit Suchläufen
4. Bei einer neuen Session **alles vergessen** und von vorn beginnen

Bei einem unbekannten Projekt muss Claude erst die komplette Struktur erkunden, Einstiegspunkte suchen, massenhaft Dateien lesen - das frisst Zeit und Kontext-Token.

## Die Lösung

CodeGraph ist ein **lokaler Index-Service**, der einmal pro Projekt alle relevanten Informationen extrahiert und in einer SQLite-Datenbank speichert:

- **Items:** Alle Identifier (Variablen, Funktionen, Klassen) - aber keine Sprach-Keywords wie `if`, `class`, `public`
- **Signaturen:** Schnell-Profile jeder Datei (Klassen, Methoden-Prototypen, Header-Kommentare)
- **Projekt-Summary:** Automatisch erkannte Entry Points, Haupt-Klassen, verwendete Sprachen
- **Dependencies:** Verknüpfungen zu anderen Projekten für projektübergreifende Suchen

## Vorher vs. Nachher

**Vorher:**
```
Claude: "Ich suche nach PlayerHealth..."
→ grep "PlayerHealth" → 200 Treffer in 40 Dateien
→ read Datei1.cs → read Datei2.cs → read Datei3.cs...
→ 5+ Minuten, viel Kontext verbraucht
```

**Nachher:**
```
Claude: codegraph_query({ term: "PlayerHealth" })
→ Engine.cs:45 (code)
→ Engine.cs:892 (comment)
→ Player.cs:23 (code)
→ Fertig. Drei gezielte Stellen in Millisekunden.
```

**Unbekanntes Projekt verstehen - Vorher:**
```
ls → tree → grep "main" → read Program.cs → read Engine.cs...
→ 5+ Minuten, viel Kontext verbraucht
```

**Nachher:**
```
codegraph_summary() → Sofortiger Überblick
codegraph_signatures({ pattern: "src/Core/**" }) → Alle Klassen und Methoden
→ 10 Sekunden, minimaler Kontext
```

## Wie funktioniert es?

### 1. Indexierung (einmalig pro Projekt)

```
codegraph_init({ path: "C:/MeinProjekt" })
```

CodeGraph scannt alle Quelldateien und extrahiert mit **Tree-sitter** (einem Parser-Framework):
- Alle Identifier und wo sie vorkommen
- Methoden-Signaturen (nur die Prototypen, keine Implementierung)
- Klassen, Structs, Interfaces
- Header-Kommentare

Das Ergebnis wird in `.codegraph/index.db` gespeichert (SQLite).

### 2. Suchen

```
codegraph_query({ term: "Calculate", mode: "starts_with" })
```

Findet alle Identifier die mit "Calculate" beginnen - in Millisekunden statt Sekunden.

### 3. Datei-Signaturen

```
codegraph_signature({ file: "src/Core/Engine.cs" })
```

Liefert sofort:
- Header-Kommentare der Datei
- Alle Klassen/Structs
- Alle Methoden-Prototypen mit Zeilennummern

Ohne die gesamte Datei lesen zu müssen.

### 4. Update nach Änderungen

```
codegraph_update({ file: "src/Core/Engine.cs" })
```

Aktualisiert nur die geänderte Datei - nicht das ganze Projekt neu indexieren.

## Unterstützte Sprachen

| Sprache | Dateitypen |
|---------|------------|
| C# | `.cs` |
| TypeScript | `.ts`, `.tsx` |
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| Rust | `.rs` |
| Python | `.py`, `.pyw` |

## Technologie

- **Runtime:** Node.js / TypeScript
- **Parser:** Tree-sitter (versteht 100+ Sprachen, unterscheidet Identifier von Keywords)
- **Datenbank:** SQLite mit WAL-Mode (schnell, eine Datei, keine Abhängigkeiten)
- **Integration:** MCP (Model Context Protocol) - der Standard für Claude Code Tools

## Installation

CodeGraph läuft als MCP-Server und wird in Claude Code registriert.

1. Repository klonen
2. `npm install && npm run build`
3. In `~/.claude/settings.json` eintragen:

```json
{
  "mcpServers": {
    "codegraph": {
      "command": "node",
      "args": ["/pfad/zu/CodeGraph/build/index.js"]
    }
  }
}
```

4. Claude Code neu starten

## Verfügbare Tools

| Tool | Beschreibung |
|------|--------------|
| `codegraph_init` | Projekt indexieren |
| `codegraph_query` | Begriffe suchen (exact/contains/starts_with) |
| `codegraph_signature` | Signatur einer Datei abrufen |
| `codegraph_signatures` | Signaturen mehrerer Dateien (Glob-Pattern) |
| `codegraph_update` | Einzelne Datei neu indexieren |
| `codegraph_remove` | Datei aus Index entfernen |
| `codegraph_summary` | Projekt-Übersicht abrufen |
| `codegraph_tree` | Dateibaum mit Statistiken |
| `codegraph_describe` | Projekt-Dokumentation ergänzen |
| `codegraph_link` | Dependency-Projekt verknüpfen |
| `codegraph_links` | Verknüpfte Projekte auflisten |
| `codegraph_status` | Index-Statistiken |

## Beispiel-Workflow

```typescript
// 1. Neues Projekt indexieren
codegraph_init({ path: "Q:/develop/MeinProjekt" })
// → 150 Dateien indexiert, 5000 Items gefunden

// 2. Projekt verstehen
codegraph_summary({ path: "..." })
// → Entry Points: Program.cs, Haupt-Klassen: GameEngine, Player, Enemy

// 3. Gezielt suchen
codegraph_query({ term: "Damage", mode: "contains" })
// → CalculateDamage in Engine.cs:156, TakeDamage in Player.cs:89, ...

// 4. Signatur anschauen
codegraph_signature({ file: "src/Core/Engine.cs" })
// → class GameEngine, void Initialize(), void Update(float dt), ...

// 5. Nach Änderung aktualisieren
codegraph_update({ file: "src/Core/Engine.cs" })
// → 3 neue Items, 1 entfernt
```

## Performance

| Projekt | Sprache | Dateien | Items | Indexierung |
|---------|---------|---------|-------|-------------|
| CodeGraph | TypeScript | 19 | ~1200 | <1s |
| RemoteDebug | C# | 10 | 1900 | <1s |
| LibPyramid3D | Rust | 18 | 3000 | <1s |
| MeloTTS | Python | 56 | 4100 | ~2s |

Suchen dauern typischerweise 1-10ms.

## Projektstruktur

```
.codegraph/           ← Wird im Projekt erstellt
├── index.db          ← SQLite Datenbank
└── summary.md        ← Optionale Projekt-Dokumentation

CodeGraph/            ← Dieses Repository
├── src/
│   ├── commands/     ← Tool-Implementierungen
│   ├── db/           ← SQLite-Wrapper
│   ├── parser/       ← Tree-sitter Integration
│   └── server/       ← MCP-Server
└── build/            ← Kompilierter Output
```

## Lizenz

MIT

## Autoren

Uwe Chalas & Claude (Rudi)
