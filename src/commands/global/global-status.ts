/**
 * global-status command
 *
 * Shows overview of all registered projects in the global database.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { INDEX_DIR } from '../../constants.js';
import { withGlobalDb, EMPTY_TOTALS } from './global-shared.js';

// ============================================================
// Types
// ============================================================

export interface GlobalStatusParams {
    tagFilter?: string;
    sort?: 'name' | 'size' | 'recent';
}

export interface GlobalStatusProject {
    name: string;
    path: string;
    files: number;
    methods: number;
    types: number;
    languages: string | null;
    lastIndexed: number | null;
    tags: string | null;
    available: boolean;
}

export interface GlobalStatusResult {
    success: boolean;
    projects: GlobalStatusProject[];
    totals: {
        projects: number;
        files: number;
        items: number;
        methods: number;
        types: number;
    };
    globalDbPath: string;
    error?: string;
}

// ============================================================
// Implementation
// ============================================================

export function globalStatus(params: GlobalStatusParams): GlobalStatusResult {
    return withGlobalDb<GlobalStatusResult>(
        (error) => ({
            success: false,
            projects: [],
            totals: { ...EMPTY_TOTALS },
            globalDbPath: '',
            error,
        }),
        (globalDb) => {
            const filter = params.tagFilter ? { tag: params.tagFilter } : undefined;
            const projects = globalDb.getProjects(filter);

            // Map to output format and check availability
            const statusProjects: GlobalStatusProject[] = projects.map(p => ({
                name: p.name,
                path: p.path,
                files: p.files_count,
                methods: p.methods_count,
                types: p.types_count,
                languages: p.languages,
                lastIndexed: p.last_indexed,
                tags: p.tags,
                available: existsSync(join(p.path, INDEX_DIR, 'index.db')),
            }));

            // Sort
            const sort = params.sort ?? 'name';
            switch (sort) {
                case 'size':
                    statusProjects.sort((a, b) => b.files - a.files);
                    break;
                case 'recent':
                    statusProjects.sort((a, b) => (b.lastIndexed ?? 0) - (a.lastIndexed ?? 0));
                    break;
                case 'name':
                default:
                    statusProjects.sort((a, b) => a.name.localeCompare(b.name));
                    break;
            }

            const totals = globalDb.getTotals();

            return {
                success: true,
                projects: statusProjects,
                totals,
                globalDbPath: globalDb.getPath(),
            };
        }
    );
}
