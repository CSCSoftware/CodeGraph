/**
 * Signature commands for AiDex
 * Retrieves file signatures (header comments, types, methods)
 */

import { withProjectDb } from './shared.js';
import type { Queries } from '../db/queries.js';
import { globToRegex } from '../utils/glob.js';

// ============================================================
// Types
// ============================================================

export interface SignatureParams {
    /** Project path (containing index dir) */
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
    /** Project path (containing index dir) */
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
    const { path: projectPath } = params;
    // Normalize path to forward slashes
    const file = params.file.replace(/\\/g, '/');

    return withProjectDb(
        projectPath, true,
        (error) => ({ success: false, file, headerComments: null, types: [], methods: [], error }),
        (db, queries) => {
            try {
                // Find file in database
                const fileRow = queries.getFileByPath(file);
                if (!fileRow) {
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
    );
}

/**
 * Get signature data for a single file using pre-opened queries (internal helper)
 */
function getSignatureFromQueries(queries: Queries, file: string): SignatureResult {
    const normalizedFile = file.replace(/\\/g, '/');
    const fileRow = queries.getFileByPath(normalizedFile);
    if (!fileRow) {
        return {
            success: false,
            file: normalizedFile,
            headerComments: null,
            types: [],
            methods: [],
            error: `File "${normalizedFile}" not found in index. It may not be indexed or the path is incorrect.`,
        };
    }

    const signatureRow = queries.getSignatureByFile(fileRow.id);
    const methodRows = queries.getMethodsByFile(fileRow.id);
    const typeRows = queries.getTypesByFile(fileRow.id);

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
}

/**
 * Get signatures for multiple files
 */
export function signatures(params: SignaturesParams): SignaturesResult {
    const { path: projectPath, pattern, files } = params;

    return withProjectDb(
        projectPath, true,
        (error) => ({ success: false, signatures: [], totalFiles: 0, error }),
        (db, queries) => {
            try {
                // Determine which files to query
                let filesToQuery: string[] = [];

                if (files && files.length > 0) {
                    filesToQuery = files;
                } else if (pattern) {
                    const allFiles = queries.getAllFiles();
                    const normalizedPattern = pattern.replace(/\\/g, '/');
                    const regex = globToRegex(normalizedPattern);

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

                // Get signatures for all matched files using the same DB connection
                const results: SignatureResult[] = [];
                for (const file of filesToQuery) {
                    const result = getSignatureFromQueries(queries, file);
                    results.push(result);
                }

                return {
                    success: true,
                    signatures: results,
                    totalFiles: results.length,
                };
            } catch (error) {
                return {
                    success: false,
                    signatures: [],
                    totalFiles: 0,
                    error: `Error retrieving signatures: ${error instanceof Error ? error.message : String(error)}`,
                };
            }
        }
    );
}

