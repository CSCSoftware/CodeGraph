/**
 * codegraph_files command - List project files and directories
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { openDatabase, createQueries } from '../db/index.js';
import type { ProjectFileRow } from '../db/queries.js';

// ============================================================
// Types
// ============================================================

export interface FilesParams {
    path: string;
    type?: string;      // Filter by type: dir, code, config, doc, asset, test, other
    pattern?: string;   // Glob pattern filter
}

export interface ProjectFile {
    path: string;
    type: string;
    extension: string | null;
    indexed: boolean;
}

export interface FilesResult {
    success: boolean;
    files: ProjectFile[];
    totalFiles: number;
    byType: Record<string, number>;
    error?: string;
}

// ============================================================
// Implementation
// ============================================================

export function files(params: FilesParams): FilesResult {
    const { path: projectPath, type, pattern } = params;

    // Validate project path
    const dbPath = join(projectPath, '.codegraph', 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            files: [],
            totalFiles: 0,
            byType: {},
            error: `No CodeGraph index found at ${projectPath}. Run codegraph_init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath, true);
    const queries = createQueries(db);

    try {
        // Get files, optionally filtered by type
        let projectFiles: ProjectFileRow[];

        if (type && isValidType(type)) {
            projectFiles = queries.getProjectFilesByType(type as ProjectFileRow['type']);
        } else {
            projectFiles = queries.getProjectFiles();
        }

        // Apply glob pattern filter if specified
        if (pattern) {
            const regex = globToRegex(pattern);
            projectFiles = projectFiles.filter(f => regex.test(f.path));
        }

        // Build type statistics
        const byType: Record<string, number> = {};
        for (const file of projectFiles) {
            byType[file.type] = (byType[file.type] || 0) + 1;
        }

        // Convert to output format
        const result: ProjectFile[] = projectFiles.map(f => ({
            path: f.path,
            type: f.type,
            extension: f.extension,
            indexed: f.indexed === 1,
        }));

        db.close();

        return {
            success: true,
            files: result,
            totalFiles: result.length,
            byType,
        };

    } catch (error) {
        db.close();
        return {
            success: false,
            files: [],
            totalFiles: 0,
            byType: {},
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================
// Helper functions
// ============================================================

const VALID_TYPES = new Set(['dir', 'code', 'config', 'doc', 'asset', 'test', 'other']);

function isValidType(type: string): boolean {
    return VALID_TYPES.has(type);
}

function globToRegex(pattern: string): RegExp {
    // Normalize to forward slashes
    let regex = pattern.replace(/\\/g, '/');

    // Escape special regex chars except * and ?
    regex = regex.replace(/[.+^${}()|[\]]/g, '\\$&');

    // Convert glob to regex
    regex = regex
        .replace(/\*\*\//g, '(.*/)?')   // **/ matches zero or more dirs
        .replace(/\*\*/g, '.*')          // ** matches anything
        .replace(/\*/g, '[^/]*')         // * matches anything except /
        .replace(/\?/g, '.');            // ? matches single char

    return new RegExp('^' + regex + '$', 'i');
}
