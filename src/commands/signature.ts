/**
 * Signature commands for CodeGraph
 * Retrieves file signatures (header comments, types, methods)
 */

import { join, normalize } from 'path';
import { existsSync } from 'fs';
import { glob } from 'glob';
import { openDatabase } from '../db/index.js';
import { createQueries, type MethodRow, type TypeRow } from '../db/queries.js';

// ============================================================
// Types
// ============================================================

export interface SignatureParams {
    /** Project path (containing .codegraph) */
    path: string;
    /** Relative file path within the project */
    file: string;
}

export interface SignatureResult {
    success: boolean;
    file: string;
    headerComments: string | null;
    types: Array<{
        name: string;
        kind: string;
        lineNumber: number;
    }>;
    methods: Array<{
        name: string;
        prototype: string;
        lineNumber: number;
        visibility: string | null;
        isStatic: boolean;
        isAsync: boolean;
    }>;
    error?: string;
}

export interface SignaturesParams {
    /** Project path (containing .codegraph) */
    path: string;
    /** Glob pattern to match files (e.g., "src/Core/**.cs") */
    pattern?: string;
    /** Explicit list of relative file paths */
    files?: string[];
}

export interface SignaturesResult {
    success: boolean;
    signatures: SignatureResult[];
    totalFiles: number;
    error?: string;
}

// ============================================================
// Implementation
// ============================================================

/**
 * Get signature for a single file
 */
export function signature(params: SignatureParams): SignatureResult {
    const { path: projectPath, file } = params;

    // Validate project path
    const codegraphDir = join(projectPath, '.codegraph');
    const dbPath = join(codegraphDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            file,
            headerComments: null,
            types: [],
            methods: [],
            error: `No CodeGraph index found at ${projectPath}. Run codegraph_init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath, true); // readonly
    const queries = createQueries(db);

    try {
        // Normalize file path - try both forward and backslashes
        const normalizedForward = file.replace(/\\/g, '/');
        const normalizedBack = file.replace(/\//g, '\\');

        // Find file in database (try both path formats)
        let fileRow = queries.getFileByPath(normalizedForward);
        if (!fileRow) {
            fileRow = queries.getFileByPath(normalizedBack);
        }
        if (!fileRow) {
            db.close();
            return {
                success: false,
                file,
                headerComments: null,
                types: [],
                methods: [],
                error: `File "${file}" not found in index. It may not be indexed or the path is incorrect.`,
            };
        }

        // Get signature data
        const signatureRow = queries.getSignatureByFile(fileRow.id);
        const methodRows = queries.getMethodsByFile(fileRow.id);
        const typeRows = queries.getTypesByFile(fileRow.id);

        db.close();

        return {
            success: true,
            file: fileRow.path,
            headerComments: signatureRow?.header_comments ?? null,
            types: typeRows.map(t => ({
                name: t.name,
                kind: t.kind,
                lineNumber: t.line_number,
            })),
            methods: methodRows.map(m => ({
                name: m.name,
                prototype: m.prototype,
                lineNumber: m.line_number,
                visibility: m.visibility,
                isStatic: m.is_static === 1,
                isAsync: m.is_async === 1,
            })),
        };
    } catch (error) {
        db.close();
        return {
            success: false,
            file,
            headerComments: null,
            types: [],
            methods: [],
            error: `Error retrieving signature: ${error instanceof Error ? error.message : String(error)}`,
        };
    }
}

/**
 * Get signatures for multiple files
 */
export function signatures(params: SignaturesParams): SignaturesResult {
    const { path: projectPath, pattern, files } = params;

    // Validate project path
    const codegraphDir = join(projectPath, '.codegraph');
    const dbPath = join(codegraphDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            signatures: [],
            totalFiles: 0,
            error: `No CodeGraph index found at ${projectPath}. Run codegraph_init first.`,
        };
    }

    // Determine which files to query
    let filesToQuery: string[] = [];

    if (files && files.length > 0) {
        // Use explicit file list (paths as-is, signature() handles normalization)
        filesToQuery = files;
    } else if (pattern) {
        // Use glob pattern against indexed files
        const db = openDatabase(dbPath, true);
        const queries = createQueries(db);
        const allFiles = queries.getAllFiles();
        db.close();

        // Convert glob pattern to regex (normalize pattern to forward slashes)
        const normalizedPattern = pattern.replace(/\\/g, '/');
        const regex = globToRegex(normalizedPattern);

        // Test against both original path and forward-slash normalized version
        filesToQuery = allFiles
            .map(f => f.path)
            .filter(p => {
                const normalizedPath = p.replace(/\\/g, '/');
                return regex.test(normalizedPath);
            });
    } else {
        return {
            success: false,
            signatures: [],
            totalFiles: 0,
            error: 'Either pattern or files parameter is required.',
        };
    }

    // Get signatures for all matched files
    const results: SignatureResult[] = [];
    for (const file of filesToQuery) {
        const result = signature({ path: projectPath, file });
        results.push(result);
    }

    return {
        success: true,
        signatures: results,
        totalFiles: results.length,
    };
}

/**
 * Convert a glob pattern to a regular expression
 * Supports: *, **, ?
 */
function globToRegex(pattern: string): RegExp {
    // Normalize to forward slashes
    pattern = pattern.replace(/\\/g, '/');

    // Escape regex special chars except * and ?
    let regex = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');

    // Convert glob patterns to regex:
    // ** matches any path (including /)
    // * matches any characters except /
    // ? matches any single character except /

    // Handle ** first (must match across directories)
    // **/ at start or middle means "any path prefix"
    regex = regex.replace(/\*\*\//g, '(.*/)?');
    // /** at end means "any path suffix"
    regex = regex.replace(/\/\*\*/g, '(/.*)?');
    // Standalone ** (rare)
    regex = regex.replace(/\*\*/g, '.*');

    // Handle single * (matches within directory)
    regex = regex.replace(/\*/g, '[^/]*');

    // Handle ? (single character)
    regex = regex.replace(/\?/g, '[^/]');

    return new RegExp(`^${regex}$`, 'i');
}
