# AiDex - Future Ideas

Ideensammlung für zukünftige Features und Erweiterungen.

---

## A. Projekt-Ebene (Erweiterungen für einzelne Projekte)

### Datei-Abhängigkeiten (File Dependencies)
- Import/Require-Analyse: Welche Datei importiert welche?
- Impact-Analyse: "Wenn ich diese Datei ändere, welche anderen sind betroffen?"
- Visualisierung als Graph im Viewer

### Update-Benachrichtigung
- Beim MCP-Server-Start prüfen ob eine neuere Version auf npm verfügbar ist
- Dem User (bzw. der KI) einen Hinweis anzeigen: "AiDex v1.8.0 verfügbar, installiert: v1.7.0"
- Nicht blockierend, nur Info - z.B. im `aidex_session` oder `aidex_status` Output

---

## B. AiDex Global / Hub (v2.0) - Neue Meta-Ebene

Meta-Ebene über allen AiDex-Projekten. Eine zentrale Datenbank (`~/.aidex/global.db`) die alle Projekt-Datenbanken kennt und somit das gesamte Ökosystem auf dem Rechner versteht.

### 1. Projekt-Registry
- Automatische Registrierung bei jedem `aidex_init`
- Kennt Pfad, Name, Sprachen, Größe, letzter Zugriff
- Weiß welche Projekte aktiv/archiviert/veraltet sind

### 2. Cross-Project Suche
- "Hab ich das schon mal gebaut?" → Sucht einen Term in ALLEN Projekten gleichzeitig
- "Wo benutze ich WebSockets?" → Findet alle Projekte mit WebSocket-Code
- "Hab ich mich damit schon mal beschäftigt?" → Durchsucht gesamtes Ökosystem

### 3. Dependency-Graph zwischen Projekten ⭐
- LibPyramid3D wird von DebugViewer verwendet
- LibWebAppGpu wird von 6 Projekten referenziert
- "Was bricht wenn ich LibX ändere?"
- Automatische Erkennung über package.json, .csproj, Cargo.toml etc.

### 4. Duplikat-Erkennung
- Identische oder ähnliche Methoden-Signaturen über Projekte hinweg
- "Du hast diese Utility-Funktion in 3 Projekten kopiert"
- Vorschläge zum Zusammenführen in eine Shared-Library

### 5. Technologie-Profil
- "Du hast 12 TypeScript-Projekte, 8 C#, 3 Rust"
- Welche Frameworks/Libraries werden wo eingesetzt?
- Versions-Überblick: "5 Projekte nutzen React 18, 2 noch React 17"

### 6. Pattern-Bibliothek
- Häufig wiederverwendete Code-Patterns automatisch erkennen
- "Deine typische HTTP-Client-Konfiguration sieht so aus..."
- Best-Practices aus eigenen Projekten ableiten

### 7. Skill / Wissens-Map
- Aus Code ableiten: "Erfahrung mit: WebGL, Tree-sitter, SQLite, MCP Protocol, ..."
- Tiefe vs. Breite: Wo viel Code, wo nur mal reingeschnuppert?
- Nützlich für: "Kann ich das mit meinem Wissen umsetzen?"

### 8. Projekt-Empfehlungen
- "Projekt A und B haben ähnliche Lösungen - zusammenführen?"
- "Projekt X wurde seit 8 Monaten nicht angefasst - archivieren?"
- "Du hast 3 verschiedene Logger-Implementierungen - konsolidieren?"

### Technische Skizze

```
~/.aidex/
├── global.db          ← Zentrale Meta-DB
└── (config, cache)

Tabellen:
- projects (path, name, languages, last_session, file_count, method_count)
- global_index (term, project_id, file, line) ← aggregiert aus Projekt-DBs
- dependencies (project_id, depends_on, type)
- tags (project_id, tag)
```

Die globale DB zapft die Projekt-DBs periodisch an und baut einen aggregierten Index auf - nicht alles kopieren, aber genug für Cross-Project Queries.
