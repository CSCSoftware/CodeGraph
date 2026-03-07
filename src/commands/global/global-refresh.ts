/**
 * global-refresh command
 *
 * Update stats in global.db for all (or specific) projects.
 * Removes projects whose paths no longer exist.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { INDEX_DIR } from '../../constants.js';
import { readProjectStats } from '../../db/global-database.js';
import { withGlobalDb, EMPTY_TOTALS } from './global-shared.js';

// ============================================================
// Types
// ============================================================

export interface GlobalRefreshParams {
    project?: string;   // Name or path of a specific project
    tagFilter?: string;
}

export interface GlobalRefreshResult {
    success: boolean;
    updated: number;
    removed: number;
    removedPaths: string[];
    totals: {
        projects: number;
        files: number;
        items: number;
        methods: number;
        types: number;
    };
    error?: string;
}

// ============================================================
// Implementation
// ============================================================

export function globalRefresh(params: GlobalRefreshParams): GlobalRefreshResult {
    return withGlobalDb<GlobalRefreshResult>(
        (error) => ({
            success: false,
            updated: 0,
            removed: 0,
            removedPaths: [],
            totals: { ...EMPTY_TOTALS },
            error,
        }),
        (globalDb) => {
            let projects = globalDb.getProjects(
                params.tagFilter ? { tag: params.tagFilter } : undefined
            );

            // Filter to specific project if requested
            if (params.project) {
                const normalizedFilter = params.project.replace(/\\/g, '/');
                projects = projects.filter(p =>
                    p.name === params.project ||
                    p.path === normalizedFilter
                );
            }

            let updated = 0;
            let removed = 0;
            const removedPaths: string[] = [];

            for (const project of projects) {
                const dbPath = join(project.path, INDEX_DIR, 'index.db');

                if (!existsSync(dbPath)) {
                    // Project no longer exists — remove from registry
                    globalDb.unregisterProject(project.path);
                    removedPaths.push(project.path);
                    removed++;
                    continue;
                }

                // Read fresh stats and update
                const stats = readProjectStats(project.path);
                if (stats) {
                    globalDb.registerProject(project.path, project.name, stats);
                    updated++;
                }
            }

            const totals = globalDb.getTotals();

            return {
                success: true,
                updated,
                removed,
                removedPaths,
                totals,
            };
        }
    );
}
