/**
 * files command - List project files and directories
 *
 * Supports time-based filtering via modified_since parameter to find
 * files that were recently indexed (useful for "what changed this session?")
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { PRODUCT_NAME, INDEX_DIR, TOOL_PREFIX } from '../constants.js';
import { openDatabase, createQueries } from '../db/index.js';
import { parseTimeOffset } from './query.js';
import type { ProjectFileRow, FileRow } from '../db/queries.js';
import { globToRegex } from '../utils/glob.js';

// ============================================================
// Types
// ============================================================

export interface FilesParams {
    path: string;
    type?: string;           // Filter by type: dir, code, config, doc, asset, test, other
    pattern?: string;        // Glob pattern filter
    modifiedSince?: string;  // Only files indexed after this time (2h, 30m, 1d, 1w, or ISO date)
}

export interface ProjectFile {
    path: string;
    type: string;
    extension: string | null;
    indexed: boolean;
    lastIndexed?: number;  // Timestamp when file was last indexed (only for code files)
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
    const { path: projectPath, type, pattern, modifiedSince } = params;

    // Validate project path
    const dbPath = join(projectPath, INDEX_DIR, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            files: [],
            totalFiles: 0,
            byType: {},
            error: `No ${PRODUCT_NAME} index found at ${projectPath}. Run ${TOOL_PREFIX}init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath, true);
    const queries = createQueries(db);

    try {
        // Parse time filter
        const modifiedSinceTs = modifiedSince ? parseTimeOffset(modifiedSince) : null;

        // If time filter is specified, get recently indexed files from the files table
        let recentlyIndexedPaths: Set<string> | null = null;
        let indexedFilesMap: Map<string, FileRow> | null = null;

        if (modifiedSinceTs !== null) {
            // Get all indexed files and filter by last_indexed
            const allIndexedFiles = queries.getAllFiles();
            recentlyIndexedPaths = new Set<string>();
            indexedFilesMap = new Map<string, FileRow>();

            for (const file of allIndexedFiles) {
                indexedFilesMap.set(file.path, file);
                if (file.last_indexed >= modifiedSinceTs) {
                    recentlyIndexedPaths.add(file.path);
                }
            }
        }

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

        // Apply time filter if specified (only show files indexed after the timestamp)
        if (recentlyIndexedPaths !== null) {
            projectFiles = projectFiles.filter(f => recentlyIndexedPaths!.has(f.path));
        }

        // Build type statistics
        const byType: Record<string, number> = {};
        for (const file of projectFiles) {
            byType[file.type] = (byType[file.type] || 0) + 1;
        }

        // Convert to output format
        const result: ProjectFile[] = projectFiles.map(f => {
            const indexed = f.indexed === 1;
            const indexedFile = indexedFilesMap?.get(f.path);
            return {
                path: f.path,
                type: f.type,
                extension: f.extension,
                indexed,
                lastIndexed: indexedFile?.last_indexed,
            };
        });

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

