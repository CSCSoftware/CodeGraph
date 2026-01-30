/**
 * link command - Link dependency projects
 *
 * Allows cross-project queries by linking other AiDex instances.
 */

import { existsSync } from 'fs';
import { join, basename } from 'path';
import { PRODUCT_NAME, INDEX_DIR, TOOL_PREFIX } from '../constants.js';

import { openDatabase, createQueries } from '../db/index.js';

// ============================================================
// Types
// ============================================================

export interface LinkParams {
    path: string;           // Current project path
    dependency: string;     // Path to dependency project (with index dir)
    name?: string;          // Optional display name
}

export interface LinkResult {
    success: boolean;
    dependencyId?: number;
    name: string;
    filesAvailable: number;
    error?: string;
}

export interface UnlinkParams {
    path: string;           // Current project path
    dependency: string;     // Path to dependency to remove
}

export interface UnlinkResult {
    success: boolean;
    removed: boolean;
    error?: string;
}

export interface ListLinksParams {
    path: string;           // Project path
}

export interface LinkedProject {
    id: number;
    path: string;
    name: string | null;
    filesAvailable: number;
    available: boolean;
}

export interface ListLinksResult {
    success: boolean;
    dependencies: LinkedProject[];
    error?: string;
}

// ============================================================
// Link implementation
// ============================================================

export function link(params: LinkParams): LinkResult {
    const { path: projectPath, dependency: dependencyPath, name } = params;

    // Validate project path
    const indexDir = join(projectPath, INDEX_DIR);
    const dbPath = join(indexDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            name: '',
            filesAvailable: 0,
            error: `No ${PRODUCT_NAME} index found at ${projectPath}. Run ${TOOL_PREFIX}init first.`,
        };
    }

    // Validate dependency path
    const depIndexDir = join(dependencyPath, INDEX_DIR);
    const depDbPath = join(depIndexDir, 'index.db');

    if (!existsSync(depDbPath)) {
        return {
            success: false,
            name: '',
            filesAvailable: 0,
            error: `No ${PRODUCT_NAME} index found at ${dependencyPath}. Run ${TOOL_PREFIX}init on dependency first.`,
        };
    }

    // Open main database
    const db = openDatabase(dbPath);

    try {
        // Get dependency info
        const depDb = openDatabase(depDbPath, true);
        const depStats = depDb.getStats();
        const depName = name ?? depDb.getMetadata('project_name') ?? basename(dependencyPath);
        depDb.close();

        // Check if already linked
        const existingDep = db.getDb().prepare(
            'SELECT * FROM dependencies WHERE path = ?'
        ).get(dependencyPath) as { id: number } | undefined;

        let dependencyId: number;

        if (existingDep) {
            // Update existing
            db.getDb().prepare(
                'UPDATE dependencies SET name = ?, last_checked = ? WHERE id = ?'
            ).run(depName, Date.now(), existingDep.id);
            dependencyId = existingDep.id;
        } else {
            // Insert new
            const result = db.getDb().prepare(
                'INSERT INTO dependencies (path, name, last_checked) VALUES (?, ?, ?)'
            ).run(dependencyPath, depName, Date.now());
            dependencyId = result.lastInsertRowid as number;
        }

        db.close();

        return {
            success: true,
            dependencyId,
            name: depName,
            filesAvailable: depStats.files,
        };
    } catch (err) {
        db.close();
        return {
            success: false,
            name: '',
            filesAvailable: 0,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================================
// Unlink implementation
// ============================================================

export function unlink(params: UnlinkParams): UnlinkResult {
    const { path: projectPath, dependency: dependencyPath } = params;

    // Validate project path
    const indexDir = join(projectPath, INDEX_DIR);
    const dbPath = join(indexDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            removed: false,
            error: `No ${PRODUCT_NAME} index found at ${projectPath}. Run ${TOOL_PREFIX}init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath);

    try {
        const result = db.getDb().prepare(
            'DELETE FROM dependencies WHERE path = ?'
        ).run(dependencyPath);

        db.close();

        return {
            success: true,
            removed: result.changes > 0,
        };
    } catch (err) {
        db.close();
        return {
            success: false,
            removed: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================================
// List links implementation
// ============================================================

export function listLinks(params: ListLinksParams): ListLinksResult {
    const { path: projectPath } = params;

    // Validate project path
    const indexDir = join(projectPath, INDEX_DIR);
    const dbPath = join(indexDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            dependencies: [],
            error: `No ${PRODUCT_NAME} index found at ${projectPath}. Run ${TOOL_PREFIX}init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath, true);

    try {
        const deps = db.getDb().prepare(
            'SELECT * FROM dependencies ORDER BY name'
        ).all() as Array<{ id: number; path: string; name: string | null; last_checked: number | null }>;

        const dependencies: LinkedProject[] = [];

        for (const dep of deps) {
            const depDbPath = join(dep.path, INDEX_DIR, 'index.db');
            const available = existsSync(depDbPath);

            let filesAvailable = 0;
            if (available) {
                try {
                    const depDb = openDatabase(depDbPath, true);
                    filesAvailable = depDb.getStats().files;
                    depDb.close();
                } catch {
                    // Ignore errors reading dependency
                }
            }

            dependencies.push({
                id: dep.id,
                path: dep.path,
                name: dep.name,
                filesAvailable,
                available,
            });
        }

        db.close();

        return {
            success: true,
            dependencies,
        };
    } catch (err) {
        db.close();
        return {
            success: false,
            dependencies: [],
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
