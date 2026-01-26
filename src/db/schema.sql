-- ============================================================
-- CodeGraph SQLite Schema
-- Version: 1.0
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
-- Dateibaum
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    hash TEXT NOT NULL,
    last_indexed INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);

-- ------------------------------------------------------------
-- Zeilenobjekte
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lines (
    id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    line_number INTEGER NOT NULL,
    line_type TEXT NOT NULL CHECK(line_type IN ('code', 'comment', 'struct', 'method', 'property', 'string')),
    PRIMARY KEY (file_id, id),
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_lines_file ON lines(file_id);
CREATE INDEX IF NOT EXISTS idx_lines_type ON lines(line_type);

-- ------------------------------------------------------------
-- Items (Terme)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE INDEX IF NOT EXISTS idx_items_term ON items(term);

-- ------------------------------------------------------------
-- Item-Vorkommen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS occurrences (
    item_id INTEGER NOT NULL,
    file_id INTEGER NOT NULL,
    line_id INTEGER NOT NULL,
    PRIMARY KEY (item_id, file_id, line_id),
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY (file_id, line_id) REFERENCES lines(file_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_occurrences_item ON occurrences(item_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_file ON occurrences(file_id);

-- ------------------------------------------------------------
-- Datei-Signaturen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS signatures (
    file_id INTEGER PRIMARY KEY,
    header_comments TEXT,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- Methoden/Funktionen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    prototype TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    visibility TEXT,
    is_static INTEGER DEFAULT 0,
    is_async INTEGER DEFAULT 0,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_methods_file ON methods(file_id);
CREATE INDEX IF NOT EXISTS idx_methods_name ON methods(name);

-- ------------------------------------------------------------
-- Klassen/Structs/Interfaces
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('class', 'struct', 'interface', 'enum', 'type')),
    line_number INTEGER NOT NULL,
    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_types_file ON types(file_id);
CREATE INDEX IF NOT EXISTS idx_types_name ON types(name);

-- ------------------------------------------------------------
-- Abhängigkeiten zu anderen CodeGraph-Instanzen
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    name TEXT,
    last_checked INTEGER
);

-- ------------------------------------------------------------
-- Metadaten
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);
