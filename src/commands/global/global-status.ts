/**
 * global-status command
 *
 * Shows overview of all registered projects in the global database.
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { INDEX_DIR } from '../../constants.js';
import { openGlobalDatabase, globalDbExists, type GlobalProject } from '../../db/global-database.js';

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
    if (!globalDbExists()) {
        return {
            success: false,
            projects: [],
            totals: { projects: 0, files: 0, items: 0, methods: 0, types: 0 },
            globalDbPath: '',
            error: 'No global index found. Run aidex_global_init first.',
        };
    }

    const globalDb = openGlobalDatabase();

    try {
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
        const dbPath = globalDb.getPath();

        globalDb.close();

        return {
            success: true,
            projects: statusProjects,
            totals,
            globalDbPath: dbPath,
        };
    } catch (error) {
        globalDb.close();
        return {
            success: false,
            projects: [],
            totals: { projects: 0, files: 0, items: 0, methods: 0, types: 0 },
            globalDbPath: globalDb.getPath(),
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
