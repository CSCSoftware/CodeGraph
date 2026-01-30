/**
 * scan command - Find all AiDex index directories!
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import { INDEX_DIR } from '../constants.js';
import { openDatabase } from '../db/index.js';

// ============================================================
// Types
// ============================================================

export interface ScanParams {
    path: string;
    maxDepth?: number;
}

export interface IndexedProject {
    path: string;
    name: string;
    files: number;
    items: number;
    methods: number;
    types: number;
    lastIndexed: string;
}

export interface ScanResult {
    success: boolean;
    searchPath: string;
    projects: IndexedProject[];
    scannedDirs: number;
    error?: string;
}

// ============================================================
// Default excluded directories
// ============================================================

const EXCLUDED_DIRS = new Set([
    'node_modules',
    '.git',
    '.svn',
    '.hg',
    '__pycache__',
    '.cache',
    'dist',
    'build',
    'out',
    'target',
    'bin',
    'obj',
    '.next',
    '.nuxt',
    'vendor',
    '.gradle',
    '.idea',
    '.vscode',
]);

// ============================================================
// Main scan function
// ============================================================

export function scan(params: ScanParams): ScanResult {
    const { path: searchPath, maxDepth = 10 } = params;

    // Validate path
    if (!existsSync(searchPath)) {
        return {
            success: false,
            searchPath,
            projects: [],
            scannedDirs: 0,
            error: `Path does not exist: ${searchPath}`,
        };
    }

    const projects: IndexedProject[] = [];
    let scannedDirs = 0;

    function scanDirectory(dirPath: string, depth: number): void {
        if (depth > maxDepth) return;

        scannedDirs++;

        // Check if this directory has an index dir
        const indexPath = join(dirPath, INDEX_DIR);
        const dbPath = join(indexPath, 'index.db');

        if (existsSync(dbPath)) {
            try {
                const db = openDatabase(dbPath, true);
                const stats = db.getStats();
                const projectName = db.getMetadata('project_name') ?? basename(dirPath);
                const lastIndexed = db.getMetadata('last_indexed') ?? 'unknown';
                db.close();

                projects.push({
                    path: dirPath,
                    name: projectName,
                    files: stats.files,
                    items: stats.items,
                    methods: stats.methods,
                    types: stats.types,
                    lastIndexed,
                });
            } catch {
                // Skip invalid databases
            }
        }

        // Scan subdirectories
        try {
            const entries = readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                if (entry.name.startsWith('.') && entry.name !== INDEX_DIR) continue;
                if (EXCLUDED_DIRS.has(entry.name)) continue;

                const subPath = join(dirPath, entry.name);
                scanDirectory(subPath, depth + 1);
            }
        } catch {
            // Skip directories we can't read
        }
    }

    scanDirectory(searchPath, 0);

    // Sort by path
    projects.sort((a, b) => a.path.localeCompare(b.path));

    return {
        success: true,
        searchPath,
        projects,
        scannedDirs,
    };
}
