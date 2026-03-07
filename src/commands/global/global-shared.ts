/**
 * Shared utilities for global commands
 */

import { openGlobalDatabase, globalDbExists, type GlobalDatabase } from '../../db/global-database.js';

/**
 * Standard totals object for error responses.
 */
export const EMPTY_TOTALS = { projects: 0, files: 0, items: 0, methods: 0, types: 0 } as const;

/**
 * Open the global database, run a function, and ensure the DB is always closed.
 * Returns the error result if no global DB exists.
 */
export function withGlobalDb<T>(
    onError: (error: string) => T,
    fn: (db: GlobalDatabase) => T
): T {
    if (!globalDbExists()) {
        return onError('No global index found. Run aidex_global_init first.');
    }

    const globalDb = openGlobalDatabase();
    try {
        return fn(globalDb);
    } catch (error) {
        return onError(error instanceof Error ? error.message : String(error));
    } finally {
        globalDb.close();
    }
}
