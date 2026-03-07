-- ============================================================
-- AiDex Global Schema
-- Meta-DB: Referenziert alle Projekt-Datenbanken
-- Location: ~/.aidex/global.db
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
-- Registrierte Projekte
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    languages TEXT,
    files_count INTEGER DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    methods_count INTEGER DEFAULT 0,
    types_count INTEGER DEFAULT 0,
    db_size_bytes INTEGER DEFAULT 0,
    last_indexed INTEGER,
    last_synced INTEGER,
    tags TEXT,
    registered_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);

-- ------------------------------------------------------------
-- Metadaten
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT
);
