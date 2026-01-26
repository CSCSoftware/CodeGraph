/**
 * codegraph_query command - Search for terms in the index
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { openDatabase, createQueries, type Queries } from '../db/index.js';

// ============================================================
// Types
// ============================================================

export type QueryMode = 'exact' | 'contains' | 'starts_with';

export interface QueryParams {
    path: string;
    term: string;
    mode?: QueryMode;
    fileFilter?: string;
    typeFilter?: string[];
    limit?: number;
}

export interface QueryMatch {
    file: string;
    lineNumber: number;
    lineType: string;
}

export interface QueryResult {
    success: boolean;
    term: string;
    mode: QueryMode;
    matches: QueryMatch[];
    totalMatches: number;
    truncated: boolean;
    error?: string;
}

// ============================================================
// Main query function
// ============================================================

export function query(params: QueryParams): QueryResult {
    const mode = params.mode ?? 'exact';
    const limit = params.limit ?? 100;

    // Validate project path
    const dbPath = join(params.path, '.codegraph', 'index.db');
    if (!existsSync(dbPath)) {
        return {
            success: false,
            term: params.term,
            mode,
            matches: [],
            totalMatches: 0,
            truncated: false,
            error: `No CodeGraph index found at ${params.path}. Run codegraph_init first.`,
        };
    }

    // Open database
    const db = openDatabase(dbPath, true);
    const queries = createQueries(db);

    try {
        // Search for items
        const items = queries.searchItems(params.term, mode, 1000);

        if (items.length === 0) {
            db.close();
            return {
                success: true,
                term: params.term,
                mode,
                matches: [],
                totalMatches: 0,
                truncated: false,
            };
        }

        // Collect all occurrences
        let allMatches: QueryMatch[] = [];

        for (const item of items) {
            const occurrences = queries.getOccurrencesByItem(item.id);

            for (const occ of occurrences) {
                // Apply file filter
                if (params.fileFilter && !matchesGlob(occ.path, params.fileFilter)) {
                    continue;
                }

                // Apply type filter
                if (params.typeFilter && params.typeFilter.length > 0) {
                    if (!params.typeFilter.includes(occ.line_type)) {
                        continue;
                    }
                }

                allMatches.push({
                    file: occ.path,
                    lineNumber: occ.line_number,
                    lineType: occ.line_type,
                });
            }
        }

        // Remove duplicates (same file + line)
        const seen = new Set<string>();
        allMatches = allMatches.filter(m => {
            const key = `${m.file}:${m.lineNumber}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        // Sort by file, then line number
        allMatches.sort((a, b) => {
            const fileCompare = a.file.localeCompare(b.file);
            if (fileCompare !== 0) return fileCompare;
            return a.lineNumber - b.lineNumber;
        });

        const totalMatches = allMatches.length;
        const truncated = allMatches.length > limit;

        if (truncated) {
            allMatches = allMatches.slice(0, limit);
        }

        db.close();

        return {
            success: true,
            term: params.term,
            mode,
            matches: allMatches,
            totalMatches,
            truncated,
        };

    } catch (error) {
        db.close();
        return {
            success: false,
            term: params.term,
            mode,
            matches: [],
            totalMatches: 0,
            truncated: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================
// Helper functions
// ============================================================

/**
 * Simple glob matching (supports * and ** patterns)
 * Handles patterns like "** /folder/** " correctly for paths starting with folder/
 */
function matchesGlob(path: string, pattern: string): boolean {
    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');

    // Convert glob to regex using placeholders to avoid interference
    let regex = normalizedPattern
        .replace(/\./g, '\\.')                          // Escape dots
        .replace(/\*\*\//g, '<<<STARSTAR_SLASH>>>')     // **/ placeholder
        .replace(/\/\*\*/g, '<<<SLASH_STARSTAR>>>')     // /** placeholder
        .replace(/\*\*/g, '<<<STARSTAR>>>')             // standalone ** placeholder
        .replace(/\*/g, '[^/]*')                        // * matches anything except /
        .replace(/<<<STARSTAR_SLASH>>>/g, '(.*/)?')     // **/ = optional prefix ending with /
        .replace(/<<<SLASH_STARSTAR>>>/g, '(/.*)?')     // /** = optional suffix starting with /
        .replace(/<<<STARSTAR>>>/g, '.*');              // ** matches anything

    regex = '^' + regex + '$';

    return new RegExp(regex, 'i').test(normalizedPath);
}
