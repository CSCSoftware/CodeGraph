/**
 * SQLite Database wrapper for CodeGraph
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface DatabaseConfig {
    dbPath: string;
    readonly?: boolean;
}

export class CodeGraphDatabase {
    private db: Database.Database;
    private dbPath: string;

    constructor(config: DatabaseConfig) {
        this.dbPath = config.dbPath;
        this.db = new Database(config.dbPath, {
            readonly: config.readonly ?? false,
        });

        // Enable WAL mode and foreign keys
        this.db.pragma('journal_mode = WAL');
        this.db.pragma('foreign_keys = ON');
    }

    /**
     * Initialize database with schema
     */
    initSchema(): void {
        const schemaPath = join(__dirname, 'schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);

        // Set initial metadata if not exists
        const stmt = this.db.prepare(
            'INSERT OR IGNORE INTO metadata (key, value) VALUES (?, ?)'
        );
        stmt.run('schema_version', '1.0');
        stmt.run('created_at', Date.now().toString());
    }

    /**
     * Set metadata value
     */
    setMetadata(key: string, value: string | null): void {
        this.db.prepare(
            'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)'
        ).run(key, value);
    }

    /**
     * Get metadata value
     */
    getMetadata(key: string): string | null {
        const row = this.db.prepare(
            'SELECT value FROM metadata WHERE key = ?'
        ).get(key) as { value: string | null } | undefined;
        return row?.value ?? null;
    }

    /**
     * Run a function in a transaction
     */
    transaction<T>(fn: () => T): T {
        return this.db.transaction(fn)();
    }

    /**
     * Get the underlying better-sqlite3 database instance
     */
    getDb(): Database.Database {
        return this.db;
    }

    /**
     * Get database file path
     */
    getPath(): string {
        return this.dbPath;
    }

    /**
     * Get database statistics
     */
    getStats(): {
        files: number;
        lines: number;
        items: number;
        occurrences: number;
        methods: number;
        types: number;
        dependencies: number;
        sizeBytes: number;
    } {
        const counts = {
            files: (this.db.prepare('SELECT COUNT(*) as c FROM files').get() as { c: number }).c,
            lines: (this.db.prepare('SELECT COUNT(*) as c FROM lines').get() as { c: number }).c,
            items: (this.db.prepare('SELECT COUNT(*) as c FROM items').get() as { c: number }).c,
            occurrences: (this.db.prepare('SELECT COUNT(*) as c FROM occurrences').get() as { c: number }).c,
            methods: (this.db.prepare('SELECT COUNT(*) as c FROM methods').get() as { c: number }).c,
            types: (this.db.prepare('SELECT COUNT(*) as c FROM types').get() as { c: number }).c,
            dependencies: (this.db.prepare('SELECT COUNT(*) as c FROM dependencies').get() as { c: number }).c,
        };

        // Get file size
        const pragmaResult = this.db.pragma('page_count') as Array<{ page_count: number }>;
        const pageSizeResult = this.db.pragma('page_size') as Array<{ page_size: number }>;
        const pageCount = pragmaResult[0]?.page_count ?? 0;
        const pageSize = pageSizeResult[0]?.page_size ?? 4096;
        const sizeBytes = pageCount * pageSize;

        return { ...counts, sizeBytes };
    }

    /**
     * Close database connection
     */
    close(): void {
        this.db.close();
    }
}

/**
 * Open or create a CodeGraph database
 */
export function openDatabase(dbPath: string, readonly = false): CodeGraphDatabase {
    return new CodeGraphDatabase({ dbPath, readonly });
}

/**
 * Create and initialize a new CodeGraph database
 * If the database already exists, clears all data for a fresh re-index
 */
export function createDatabase(dbPath: string, projectName?: string, projectRoot?: string): CodeGraphDatabase {
    const db = new CodeGraphDatabase({ dbPath });
    db.initSchema();

    // Clear all data for fresh re-index (ON DELETE CASCADE handles related tables)
    db.getDb().exec('DELETE FROM files');
    db.getDb().exec('DELETE FROM items');

    if (projectName) {
        db.setMetadata('project_name', projectName);
    }
    if (projectRoot) {
        db.setMetadata('project_root', projectRoot);
    }
    db.setMetadata('last_indexed', Date.now().toString());

    return db;
}
