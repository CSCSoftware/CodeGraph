/**
 * codegraph_init command - Initialize CodeGraph for a project
 */

import { existsSync, mkdirSync, readFileSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import { glob } from 'glob';
import { createHash } from 'crypto';

import { createDatabase, createQueries, type CodeGraphDatabase, type Queries } from '../db/index.js';
import { extract, getSupportedExtensions } from '../parser/index.js';

// ============================================================
// Types
// ============================================================

export interface InitParams {
    path: string;
    name?: string;
    languages?: string[];
    exclude?: string[];
}

export interface InitResult {
    success: boolean;
    codegraphPath: string;
    filesIndexed: number;
    itemsFound: number;
    methodsFound: number;
    typesFound: number;
    durationMs: number;
    errors: string[];
}

// ============================================================
// Default patterns
// ============================================================

const DEFAULT_EXCLUDE = [
    '**/node_modules/**',
    '**/bin/**',
    '**/obj/**',
    '**/build/**',
    '**/dist/**',
    '**/.git/**',
    '**/.vs/**',
    '**/.idea/**',
    '**/packages/**',
    '**/*.min.js',
    '**/*.generated.*',
];

// ============================================================
// Main init function
// ============================================================

export async function init(params: InitParams): Promise<InitResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    // Validate project path
    if (!existsSync(params.path)) {
        return {
            success: false,
            codegraphPath: '',
            filesIndexed: 0,
            itemsFound: 0,
            methodsFound: 0,
            typesFound: 0,
            durationMs: Date.now() - startTime,
            errors: [`Project path does not exist: ${params.path}`],
        };
    }

    const stat = statSync(params.path);
    if (!stat.isDirectory()) {
        return {
            success: false,
            codegraphPath: '',
            filesIndexed: 0,
            itemsFound: 0,
            methodsFound: 0,
            typesFound: 0,
            durationMs: Date.now() - startTime,
            errors: [`Path is not a directory: ${params.path}`],
        };
    }

    // Create .codegraph directory
    const codegraphDir = join(params.path, '.codegraph');
    if (!existsSync(codegraphDir)) {
        mkdirSync(codegraphDir, { recursive: true });
    }

    const dbPath = join(codegraphDir, 'index.db');
    const projectName = params.name ?? basename(params.path);

    // Create database
    const db = createDatabase(dbPath, projectName, params.path);
    const queries = createQueries(db);

    // Build glob pattern for supported files
    const extensions = getSupportedExtensions();
    const patterns = extensions.map(ext => `**/*${ext}`);

    // Merge exclude patterns
    const exclude = [...DEFAULT_EXCLUDE, ...(params.exclude ?? [])];

    // Find all source files
    let files: string[] = [];
    for (const pattern of patterns) {
        const found = await glob(pattern, {
            cwd: params.path,
            ignore: exclude,
            nodir: true,
            absolute: false,
        });
        files.push(...found);
    }

    // Remove duplicates and sort
    files = [...new Set(files)].sort();

    // Index each file
    let filesIndexed = 0;
    let totalItems = 0;
    let totalMethods = 0;
    let totalTypes = 0;

    // Use transaction for bulk insert
    db.transaction(() => {
        for (const filePath of files) {
            try {
                const result = indexFile(params.path, filePath, db, queries);
                if (result.success) {
                    filesIndexed++;
                    totalItems += result.items;
                    totalMethods += result.methods;
                    totalTypes += result.types;
                } else if (result.error) {
                    errors.push(`${filePath}: ${result.error}`);
                }
            } catch (err) {
                errors.push(`${filePath}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    });

    // Cleanup unused items
    queries.deleteUnusedItems();

    db.close();

    return {
        success: true,
        codegraphPath: codegraphDir,
        filesIndexed,
        itemsFound: totalItems,
        methodsFound: totalMethods,
        typesFound: totalTypes,
        durationMs: Date.now() - startTime,
        errors,
    };
}

// ============================================================
// File indexing
// ============================================================

interface IndexFileResult {
    success: boolean;
    items: number;
    methods: number;
    types: number;
    error?: string;
}

function indexFile(
    projectPath: string,
    relativePath: string,
    db: CodeGraphDatabase,
    queries: Queries
): IndexFileResult {
    const absolutePath = join(projectPath, relativePath);

    // Read file content
    let content: string;
    try {
        content = readFileSync(absolutePath, 'utf-8');
    } catch (err) {
        return {
            success: false,
            items: 0,
            methods: 0,
            types: 0,
            error: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
        };
    }

    // Calculate hash
    const hash = createHash('sha256').update(content).digest('hex').substring(0, 16);

    // Extract data from file
    const extraction = extract(content, relativePath);
    if (!extraction) {
        return {
            success: false,
            items: 0,
            methods: 0,
            types: 0,
            error: 'Unsupported file type or parse error',
        };
    }

    // Insert file record
    const fileId = queries.insertFile(relativePath, hash);

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
        const lineIdForItem = lineNumberToId.get(item.lineNumber);
        if (lineIdForItem === undefined) {
            // Line wasn't recorded, add it now
            const newLineId = lineId++;
            queries.insertLine(fileId, newLineId, item.lineNumber, item.lineType);
            lineNumberToId.set(item.lineNumber, newLineId);
        }

        const itemId = queries.getOrCreateItem(item.term);
        const finalLineId = lineNumberToId.get(item.lineNumber)!;
        queries.insertOccurrence(itemId, fileId, finalLineId);
        itemsInserted.add(item.term);
    }

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

    return {
        success: true,
        items: itemsInserted.size,
        methods: extraction.methods.length,
        types: extraction.types.length,
    };
}
