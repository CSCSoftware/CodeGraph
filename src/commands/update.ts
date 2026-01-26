/**
 * codegraph_update command - Update index for a single file
 *
 * Supports:
 * - Full re-index of a file (no line range specified)
 * - Incremental update of a line range (from_line/to_line specified) - future
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

import { openDatabase, createQueries, type CodeGraphDatabase, type Queries } from '../db/index.js';
import { extract } from '../parser/index.js';

// ============================================================
// Types
// ============================================================

export interface UpdateParams {
    path: string;           // Project path
    file: string;           // Relative file path
    fromLine?: number;      // Optional: Start of change (for future incremental update)
    toLine?: number;        // Optional: End of change (for future incremental update)
}

export interface UpdateResult {
    success: boolean;
    file: string;
    itemsAdded: number;
    itemsRemoved: number;
    methodsUpdated: number;
    typesUpdated: number;
    durationMs: number;
    error?: string;
}

// ============================================================
// Main update function
// ============================================================

export function update(params: UpdateParams): UpdateResult {
    const startTime = Date.now();
    const { path: projectPath, file: relativePath } = params;

    // Validate project path
    const codegraphDir = join(projectPath, '.codegraph');
    const dbPath = join(codegraphDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            file: relativePath,
            itemsAdded: 0,
            itemsRemoved: 0,
            methodsUpdated: 0,
            typesUpdated: 0,
            durationMs: Date.now() - startTime,
            error: `No CodeGraph index found at ${projectPath}. Run codegraph_init first.`,
        };
    }

    // Check if file exists
    const absolutePath = join(projectPath, relativePath);
    if (!existsSync(absolutePath)) {
        return {
            success: false,
            file: relativePath,
            itemsAdded: 0,
            itemsRemoved: 0,
            methodsUpdated: 0,
            typesUpdated: 0,
            durationMs: Date.now() - startTime,
            error: `File does not exist: ${relativePath}`,
        };
    }

    // Open database
    const db = openDatabase(dbPath);
    const queries = createQueries(db);

    try {
        // Check if file is already indexed
        const existingFile = queries.getFileByPath(relativePath);

        // Read file content
        let content: string;
        try {
            content = readFileSync(absolutePath, 'utf-8');
        } catch (err) {
            return {
                success: false,
                file: relativePath,
                itemsAdded: 0,
                itemsRemoved: 0,
                methodsUpdated: 0,
                typesUpdated: 0,
                durationMs: Date.now() - startTime,
                error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
            };
        }

        // Calculate new hash
        const newHash = createHash('sha256').update(content).digest('hex').substring(0, 16);

        // Check if file has actually changed
        if (existingFile && existingFile.hash === newHash) {
            return {
                success: true,
                file: relativePath,
                itemsAdded: 0,
                itemsRemoved: 0,
                methodsUpdated: 0,
                typesUpdated: 0,
                durationMs: Date.now() - startTime,
                error: 'File unchanged (hash match)',
            };
        }

        // Extract data from file
        const extraction = extract(content, relativePath);
        if (!extraction) {
            return {
                success: false,
                file: relativePath,
                itemsAdded: 0,
                itemsRemoved: 0,
                methodsUpdated: 0,
                typesUpdated: 0,
                durationMs: Date.now() - startTime,
                error: 'Unsupported file type or parse error',
            };
        }

        // Count old items for comparison
        let oldItemCount = 0;
        let oldMethodCount = 0;
        let oldTypeCount = 0;

        if (existingFile) {
            const oldOccurrences = queries.getOccurrencesByFile(existingFile.id);
            oldItemCount = new Set(oldOccurrences.map(o => o.item_id)).size;
            oldMethodCount = queries.getMethodsByFile(existingFile.id).length;
            oldTypeCount = queries.getTypesByFile(existingFile.id).length;
        }

        // Perform update in transaction
        let fileId: number;
        let newItemCount = 0;

        db.transaction(() => {
            if (existingFile) {
                // Clear existing data for this file
                queries.clearFileData(existingFile.id);

                // Update hash
                queries.updateFileHash(existingFile.id, newHash);
                fileId = existingFile.id;
            } else {
                // Insert new file record
                fileId = queries.insertFile(relativePath, newHash);
            }

            // Insert lines
            let lineId = 1;
            for (const line of extraction.lines) {
                queries.insertLine(fileId, lineId++, line.lineNumber, line.lineType);
            }

            // Build line number to line ID mapping
            const lineNumberToId = new Map<number, number>();
            lineId = 1;
            for (const line of extraction.lines) {
                lineNumberToId.set(line.lineNumber, lineId++);
            }

            // Insert items and occurrences
            const itemsInserted = new Set<string>();
            for (const item of extraction.items) {
                let itemLineId = lineNumberToId.get(item.lineNumber);
                if (itemLineId === undefined) {
                    // Line wasn't recorded, add it now
                    const newLineId = lineId++;
                    queries.insertLine(fileId, newLineId, item.lineNumber, item.lineType);
                    lineNumberToId.set(item.lineNumber, newLineId);
                    itemLineId = newLineId;
                }

                const itemId = queries.getOrCreateItem(item.term);
                queries.insertOccurrence(itemId, fileId, itemLineId);
                itemsInserted.add(item.term);
            }
            newItemCount = itemsInserted.size;

            // Insert methods
            for (const method of extraction.methods) {
                queries.insertMethod(
                    fileId,
                    method.name,
                    method.prototype,
                    method.lineNumber,
                    method.visibility,
                    method.isStatic,
                    method.isAsync
                );
            }

            // Insert types
            for (const type of extraction.types) {
                queries.insertType(fileId, type.name, type.kind, type.lineNumber);
            }

            // Insert signature (header comments)
            if (extraction.headerComments.length > 0) {
                queries.insertSignature(fileId, extraction.headerComments.join('\n'));
            }
        });

        // Cleanup unused items
        queries.deleteUnusedItems();

        db.close();

        return {
            success: true,
            file: relativePath,
            itemsAdded: Math.max(0, newItemCount - oldItemCount),
            itemsRemoved: Math.max(0, oldItemCount - newItemCount),
            methodsUpdated: extraction.methods.length,
            typesUpdated: extraction.types.length,
            durationMs: Date.now() - startTime,
        };
    } catch (err) {
        db.close();
        return {
            success: false,
            file: relativePath,
            itemsAdded: 0,
            itemsRemoved: 0,
            methodsUpdated: 0,
            typesUpdated: 0,
            durationMs: Date.now() - startTime,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}

// ============================================================
// Remove file from index
// ============================================================

export interface RemoveParams {
    path: string;           // Project path
    file: string;           // Relative file path
}

export interface RemoveResult {
    success: boolean;
    file: string;
    removed: boolean;
    error?: string;
}

export function remove(params: RemoveParams): RemoveResult {
    const { path: projectPath, file: relativePath } = params;

    // Validate project path
    const codegraphDir = join(projectPath, '.codegraph');
    const dbPath = join(codegraphDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            success: false,
            file: relativePath,
            removed: false,
            error: `No CodeGraph index found at ${projectPath}. Run codegraph_init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath);
    const queries = createQueries(db);

    try {
        const existingFile = queries.getFileByPath(relativePath);

        if (!existingFile) {
            db.close();
            return {
                success: true,
                file: relativePath,
                removed: false,
                error: 'File not found in index',
            };
        }

        // Delete file (CASCADE will handle related data)
        db.transaction(() => {
            queries.deleteFile(existingFile.id);
            queries.deleteUnusedItems();
        });

        db.close();

        return {
            success: true,
            file: relativePath,
            removed: true,
        };
    } catch (err) {
        db.close();
        return {
            success: false,
            file: relativePath,
            removed: false,
            error: err instanceof Error ? err.message : String(err),
        };
    }
}
