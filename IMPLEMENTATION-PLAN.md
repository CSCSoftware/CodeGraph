# CodeGraph - Implementierungsplan

> **Erstellt:** 25. Januar 2026
> **Ziel:** Funktionsfähiger MCP Server für Claude Code

---

## Phase 1: Projekt-Setup

### 1.1 Node.js Projekt initialisieren
- [ ] `package.json` erstellen
- [ ] TypeScript konfigurieren (`tsconfig.json`)
- [ ] ESLint + Prettier einrichten
- [ ] Build-Scripts definieren

### 1.2 Dependencies installieren
```
@modelcontextprotocol/sdk    # MCP Server SDK
better-sqlite3               # SQLite (synchron, schnell)
tree-sitter                  # Parser-Engine
tree-sitter-c-sharp          # C# Grammatik
tree-sitter-typescript       # TypeScript Grammatik
glob                         # Datei-Pattern-Matching
```

### 1.3 Verzeichnisstruktur anlegen
```
src/
├── index.ts
├── server/
├── db/
├── parser/
├── commands/
└── utils/
```

**Ergebnis Phase 1:** Projekt kompiliert, leerer MCP Server startet.

---

## Phase 2: Datenbank-Layer

### 2.1 SQLite Schema implementieren
- [ ] `src/db/schema.sql` aus Spec übernehmen
- [ ] `src/db/database.ts` - Wrapper-Klasse erstellen
- [ ] Migrations-System (für spätere Schema-Updates)

### 2.2 Prepared Statements
- [ ] `src/db/queries.ts` - Alle SQL-Queries als Prepared Statements
- [ ] CRUD für: files, lines, items, occurrences, signatures, methods, types

### 2.3 Testen
- [ ] Unit-Tests für Datenbank-Operationen
- [ ] Test-Fixture: Kleine SQLite-DB mit Beispieldaten

**Ergebnis Phase 2:** Datenbank kann erstellt, befüllt, abgefragt werden.

---

## Phase 3: Parser-System

### 3.1 Tree-sitter Integration
- [ ] `src/parser/tree-sitter.ts` - Tree-sitter initialisieren
- [ ] Sprachen laden (C#, TypeScript initial)

### 3.2 Keyword-Filter
- [ ] `src/parser/languages/csharp.ts` - C# Keywords
- [ ] `src/parser/languages/typescript.ts` - TypeScript Keywords
- [ ] `src/parser/languages/index.ts` - Language Registry

### 3.3 Extraktor
- [ ] `src/parser/extractor.ts` - Haupt-Extraktor
  - AST traversieren
  - Identifier extrahieren (ohne Keywords)
  - Zeilentypen klassifizieren
  - Items + Occurrences sammeln

### 3.4 Signatur-Extraktion
- [ ] `src/parser/signature.ts`
  - Header-Kommentare sammeln
  - Methoden-Prototypen extrahieren
  - Klassen/Structs erfassen

### 3.5 Testen
- [ ] Unit-Tests mit Beispiel-Quelldateien
- [ ] Test: C# Datei parsen → Items korrekt?
- [ ] Test: Signatur-Extraktion korrekt?

**Ergebnis Phase 3:** Quelldateien können geparst werden, Items/Signaturen werden extrahiert.

---

## Phase 4: Erstes MCP Tool - `codegraph_init`

### 4.1 MCP Server Grundgerüst
- [ ] `src/server/mcp-server.ts` - Server-Klasse
- [ ] `src/server/tools.ts` - Tool-Registrierung
- [ ] `src/index.ts` - Entry Point

### 4.2 Init-Command implementieren
- [ ] `src/commands/init.ts`
  - Projektverzeichnis validieren
  - `.codegraph/` Verzeichnis erstellen
  - `index.db` initialisieren
  - Alle Quelldateien finden (Glob)
  - Jede Datei parsen und indexieren
  - `summary.md` erstellen (auto-generiert)
  - CLAUDE.md Dateien importieren → `docs.md`

### 4.3 Testen
- [ ] Integration-Test: `codegraph_init` auf Test-Projekt
- [ ] Prüfen: Alle Dateien indexiert?
- [ ] Prüfen: Items korrekt?
- [ ] Prüfen: Signaturen korrekt?

**Ergebnis Phase 4:** `codegraph_init` funktioniert, Projekt kann indexiert werden.

---

## Phase 5: Query-Tool

### 5.1 Query-Command implementieren
- [ ] `src/commands/query.ts`
  - Exact Match
  - Contains Match
  - Starts-With Match
  - Optional: Regex Match

### 5.2 Ergebnis-Formatierung
- [ ] Dateiname + Zeilennummer + Typ zurückgeben
- [ ] Limit-Parameter
- [ ] File-Filter (Glob-Pattern)

### 5.3 Testen
- [ ] Query "PlayerHealth" → findet Treffer
- [ ] Query "Player" mode=contains → findet PlayerHealth, PlayerManager, etc.

**Ergebnis Phase 5:** Terme können gesucht werden.

---

## Phase 6: Signatur-Tools

### 6.1 Signature-Command
- [ ] `src/commands/signature.ts`
  - Einzelne Datei-Signatur abrufen
  - Formatierte Ausgabe

### 6.2 Signatures-Command (Batch)
- [ ] Mehrere Signaturen auf einmal (Glob-Pattern)

### 6.3 Testen
- [ ] Signatur für bekannte Datei abrufen
- [ ] Alle Signaturen in `src/Core/` abrufen

**Ergebnis Phase 6:** Datei-Signaturen abrufbar.

---

## Phase 7: Update-Mechanismus

### 7.1 Update-Command
- [ ] `src/commands/update.ts`
  - Ganze Datei neu indexieren
  - Oder: Nur Zeilenbereich (from_line, to_line)

### 7.2 Inkrementelles Update
- [ ] Alte Daten für betroffene Zeilen entfernen
- [ ] Neue Daten einfügen
- [ ] Offset berechnen und Zeilennummern anpassen

### 7.3 Remove-Command
- [ ] `src/commands/remove.ts`
  - Datei aus Index entfernen (CASCADE)

### 7.4 Testen
- [ ] Datei ändern → Update → Query findet neue Terme
- [ ] Zeilen einfügen → Offset korrekt?

**Ergebnis Phase 7:** Index kann aktualisiert werden.

---

## Phase 8: Weitere Tools

### 8.1 Summary-Tools
- [ ] `src/commands/summary.ts` - Summary abrufen
- [ ] `src/commands/describe.ts` - Summary ergänzen

### 8.2 Tree-Tool
- [ ] `src/commands/tree.ts` - Dateibaum abrufen

### 8.3 Link-Tool
- [ ] `src/commands/link.ts` - Dependencies verknüpfen
- [ ] Cross-Project Query implementieren

### 8.4 Status-Tool
- [ ] `src/commands/status.ts` - Statistiken abrufen

### 8.5 Docs-Tool
- [ ] `src/commands/docs.ts` - CLAUDE.md Inhalte abrufen
- [ ] `codegraph_update_docs` - Re-Import

**Ergebnis Phase 8:** Alle geplanten Tools funktionieren.

---

## Phase 9: Integration & Polish

### 9.1 MCP Server Registration
- [ ] Anleitung für `~/.claude/settings.json`
- [ ] Test: Server startet in Claude Code

### 9.2 Fehlerbehandlung
- [ ] Alle Edge Cases abfangen
- [ ] Hilfreiche Fehlermeldungen

### 9.3 Performance-Optimierung
- [ ] Große Projekte testen (1000+ Dateien)
- [ ] Batch-Insert für initiales Indexieren
- [ ] Query-Performance prüfen

### 9.4 Dokumentation
- [ ] README.md erstellen
- [ ] Beispiel-Workflows dokumentieren

**Ergebnis Phase 9:** Production-ready MCP Server.

---

## Phase 10: Erste echte Nutzung

### 10.1 Test mit echtem Projekt
- [ ] LibPyramid3D indexieren
- [ ] DebugViewer indexieren
- [ ] Dependencies verknüpfen

### 10.2 Feedback einarbeiten
- [ ] Was funktioniert gut?
- [ ] Was fehlt?
- [ ] Was ist zu langsam?

---

## Optionale Erweiterungen (später)

- [ ] **Weitere Sprachen:** Python, Go, Rust, JavaScript
- [ ] **Git Integration:** Auto-Update nach Commits
- [ ] **Call Graph:** Wer ruft wen auf?
- [ ] **Vektor-Embeddings:** Semantische Suche
- [ ] **VS Code Extension:** Auto-Update beim Speichern
- [ ] **Web Dashboard:** Visualisierung

---

## Zeitschätzung

| Phase | Aufwand |
|-------|---------|
| Phase 1: Setup | Klein |
| Phase 2: Datenbank | Mittel |
| Phase 3: Parser | Groß (Tree-sitter Lernkurve) |
| Phase 4: Init | Mittel |
| Phase 5: Query | Klein |
| Phase 6: Signatures | Klein |
| Phase 7: Update | Mittel |
| Phase 8: Weitere Tools | Mittel |
| Phase 9: Polish | Mittel |
| Phase 10: Test | Klein |

---

## Empfohlene Reihenfolge für erste Session

1. **Phase 1 komplett** - Projekt muss kompilieren
2. **Phase 2 komplett** - Datenbank muss funktionieren
3. **Phase 3.1-3.3** - Parser Grundgerüst (ohne Signaturen)
4. **Phase 4** - Init-Tool (vereinfacht, ohne Signaturen)
5. **Phase 5** - Query-Tool

→ Dann hast du ein **minimal funktionsfähiges CodeGraph** das du bereits nutzen kannst!

Signaturen, Update, und weitere Tools können danach iterativ ergänzt werden.

---

*Ende des Implementierungsplans*
