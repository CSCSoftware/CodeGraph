/**
 * Shared utilities for AiDex commands
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { PRODUCT_NAME, INDEX_DIR, TOOL_PREFIX } from '../constants.js';
import { openDatabase, createQueries, type AiDexDatabase } from '../db/index.js';
import type { Queries } from '../db/queries.js';

/**
 * Normalize path separators to forward slashes (consistent storage format).
 * Use this instead of inline .replace(/\\/g, '/') everywhere.
 */
export function normalizePath(p: string): string {
    return p.replace(/\\/g, '/');
}

/**
 * Escape a term for use in SQLite LIKE queries (with ESCAPE '\').
 * Handles: backslash, percent, underscore.
 */
export function escapeLikeTerm(term: string): string {
    return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Validate that a project has an AiDex index. Returns dbPath or null.
 */
export function validateIndex(projectPath: string): string | null {
    const dbPath = join(projectPath, INDEX_DIR, 'index.db');
    return existsSync(dbPath) ? dbPath : null;
}

/**
 * Standard error message when no index is found.
 */
export function noIndexError(projectPath: string): string {
    return `No ${PRODUCT_NAME} index found at ${projectPath}. Run ${TOOL_PREFIX}init first.`;
}

/**
 * Open a project database, run a function, and ensure the DB is always closed.
 * Returns whatever the function returns.
 */
export function withDatabase<T>(
    dbPath: string,
    readonly: boolean,
    fn: (db: AiDexDatabase, queries: Queries) => T
): T {
    const db = openDatabase(dbPath, readonly);
    const queries = createQueries(db);
    try {
        return fn(db, queries);
    } finally {
        db.close();
    }
}

/**
 * Validate index + open database + run function. Combines validateIndex + withDatabase.
 * Returns the error result if no index found, otherwise runs fn.
 */
export function withProjectDb<T>(
    projectPath: string,
    readonly: boolean,
    onError: (error: string) => T,
    fn: (db: AiDexDatabase, queries: Queries) => T
): T {
    const dbPath = validateIndex(projectPath);
    if (!dbPath) {
        return onError(noIndexError(projectPath));
    }
    return withDatabase(dbPath, readonly, fn);
}
