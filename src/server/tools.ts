/**
 * MCP Tool definitions and handlers for CodeGraph
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { init, query, signature, signatures, update, remove, summary, tree, describe, link, unlink, listLinks, scan, files, note, getSessionNote, session, formatSessionTime, formatDuration, type QueryMode } from '../commands/index.js';
import { openDatabase } from '../db/index.js';

/**
 * Register all available tools
 */
export function registerTools(): Tool[] {
    return [
        {
            name: 'codegraph_init',
            description: 'Initialize CodeGraph indexing for a project. Scans all source files and builds a searchable index of identifiers, methods, types, and signatures.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Absolute path to the project directory to index',
                    },
                    name: {
                        type: 'string',
                        description: 'Optional project name (defaults to directory name)',
                    },
                    exclude: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Additional glob patterns to exclude (e.g., ["**/test/**"])',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_query',
            description: 'Search for terms/identifiers in the CodeGraph index. Returns file locations where the term appears. PREFERRED over Grep/Glob for code searches when .codegraph/ exists - faster and more precise. Use this instead of grep for finding functions, classes, variables by name.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    term: {
                        type: 'string',
                        description: 'The term to search for',
                    },
                    mode: {
                        type: 'string',
                        enum: ['exact', 'contains', 'starts_with'],
                        description: 'Search mode: exact match, contains, or starts_with (default: exact)',
                    },
                    file_filter: {
                        type: 'string',
                        description: 'Glob pattern to filter files (e.g., "src/commands/**")',
                    },
                    type_filter: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Filter by line type: code, comment, method, struct, property',
                    },
                    modified_since: {
                        type: 'string',
                        description: 'Only include lines modified after this time. Supports: "2h" (hours), "30m" (minutes), "1d" (days), "1w" (weeks), or ISO date string',
                    },
                    modified_before: {
                        type: 'string',
                        description: 'Only include lines modified before this time. Same format as modified_since',
                    },
                    limit: {
                        type: 'number',
                        description: 'Maximum number of results (default: 100)',
                    },
                },
                required: ['path', 'term'],
            },
        },
        {
            name: 'codegraph_status',
            description: 'Get CodeGraph server status and statistics for an indexed project',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory (optional, shows server status if not provided)',
                    },
                },
                required: [],
            },
        },
        {
            name: 'codegraph_signature',
            description: 'Get the signature of a single file: header comments, types (classes/structs/interfaces), and method prototypes. Use this INSTEAD of reading entire files when you only need to know what methods/classes exist. Much faster than Read tool for understanding file structure.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    file: {
                        type: 'string',
                        description: 'Relative path to the file within the project (e.g., "src/Core/Engine.cs")',
                    },
                },
                required: ['path', 'file'],
            },
        },
        {
            name: 'codegraph_signatures',
            description: 'Get signatures for multiple files at once using glob pattern or file list. Returns types and method prototypes. Use INSTEAD of reading multiple files when exploring codebase structure. Much more efficient than multiple Read calls.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    pattern: {
                        type: 'string',
                        description: 'Glob pattern to match files (e.g., "src/Core/**/*.cs", "**/*.ts")',
                    },
                    files: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Explicit list of relative file paths (alternative to pattern)',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_update',
            description: 'Re-index a single file. Use after editing a file to update the CodeGraph index. If the file is new, it will be added to the index. If unchanged (same hash), no update is performed.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    file: {
                        type: 'string',
                        description: 'Relative path to the file to update (e.g., "src/Core/Engine.cs")',
                    },
                },
                required: ['path', 'file'],
            },
        },
        {
            name: 'codegraph_remove',
            description: 'Remove a file from the CodeGraph index. Use when a file has been deleted from the project.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    file: {
                        type: 'string',
                        description: 'Relative path to the file to remove (e.g., "src/OldFile.cs")',
                    },
                },
                required: ['path', 'file'],
            },
        },
        {
            name: 'codegraph_summary',
            description: 'Get project summary including auto-detected entry points, main types, and languages. Also returns content from summary.md if it exists.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_tree',
            description: 'Get the indexed file tree. Optionally filter by subdirectory, limit depth, or include statistics per file.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    subpath: {
                        type: 'string',
                        description: 'Subdirectory to list (default: project root)',
                    },
                    depth: {
                        type: 'number',
                        description: 'Maximum depth to traverse (default: unlimited)',
                    },
                    include_stats: {
                        type: 'boolean',
                        description: 'Include item/method/type counts per file',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_describe',
            description: 'Add or update a section in the project summary (summary.md). Use to document project purpose, architecture, key concepts, or patterns.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    section: {
                        type: 'string',
                        enum: ['purpose', 'architecture', 'concepts', 'patterns', 'notes'],
                        description: 'Section to update',
                    },
                    content: {
                        type: 'string',
                        description: 'Content to add to the section',
                    },
                    replace: {
                        type: 'boolean',
                        description: 'Replace existing section content (default: append)',
                    },
                },
                required: ['path', 'section', 'content'],
            },
        },
        {
            name: 'codegraph_link',
            description: 'Link a dependency project to enable cross-project queries. The dependency must have its own .codegraph index.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to current project with .codegraph directory',
                    },
                    dependency: {
                        type: 'string',
                        description: 'Path to dependency project to link',
                    },
                    name: {
                        type: 'string',
                        description: 'Optional display name for the dependency',
                    },
                },
                required: ['path', 'dependency'],
            },
        },
        {
            name: 'codegraph_unlink',
            description: 'Remove a linked dependency project.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to current project with .codegraph directory',
                    },
                    dependency: {
                        type: 'string',
                        description: 'Path to dependency project to unlink',
                    },
                },
                required: ['path', 'dependency'],
            },
        },
        {
            name: 'codegraph_links',
            description: 'List all linked dependency projects.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_scan',
            description: 'Scan a directory tree to find all projects with CodeGraph indexes (.codegraph directories). Use this to discover which projects are already indexed before using Grep/Glob - indexed projects should use codegraph_query instead.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Root path to scan for .codegraph directories',
                    },
                    max_depth: {
                        type: 'number',
                        description: 'Maximum directory depth to scan (default: 10)',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_files',
            description: 'List all files and directories in the indexed project. Returns the complete project structure with file types (code, config, doc, asset, test, other) and whether each file is indexed for code search.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    type: {
                        type: 'string',
                        enum: ['dir', 'code', 'config', 'doc', 'asset', 'test', 'other'],
                        description: 'Filter by file type',
                    },
                    pattern: {
                        type: 'string',
                        description: 'Glob pattern to filter files (e.g., "src/**/*.ts")',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_note',
            description: 'Read or write a session note for the project. Use this to leave reminders for the next session (e.g., "Test the glob fix", "Refactor X"). Notes persist in the CodeGraph database and are shown when querying the project.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                    note: {
                        type: 'string',
                        description: 'Note to save. If omitted, reads the current note.',
                    },
                    append: {
                        type: 'boolean',
                        description: 'If true, appends to existing note instead of replacing (default: false)',
                    },
                    clear: {
                        type: 'boolean',
                        description: 'If true, clears the note (default: false)',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: 'codegraph_session',
            description: 'Start or check a CodeGraph session. Call this at the beginning of a new chat session to: (1) detect files changed externally since last session, (2) auto-reindex modified files, (3) get session note and last session times. Returns info for "What did we do last session?" queries.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: 'Path to project with .codegraph directory',
                    },
                },
                required: ['path'],
            },
        },
    ];
}

/**
 * Handle tool calls
 */
export async function handleToolCall(
    name: string,
    args: Record<string, unknown>
): Promise<{ content: Array<{ type: string; text: string }> }> {
    try {
        switch (name) {
            case 'codegraph_init':
                return await handleInit(args);

            case 'codegraph_query':
                return handleQuery(args);

            case 'codegraph_status':
                return handleStatus(args);

            case 'codegraph_signature':
                return handleSignature(args);

            case 'codegraph_signatures':
                return handleSignatures(args);

            case 'codegraph_update':
                return handleUpdate(args);

            case 'codegraph_remove':
                return handleRemove(args);

            case 'codegraph_summary':
                return handleSummary(args);

            case 'codegraph_tree':
                return handleTree(args);

            case 'codegraph_describe':
                return handleDescribe(args);

            case 'codegraph_link':
                return handleLink(args);

            case 'codegraph_unlink':
                return handleUnlink(args);

            case 'codegraph_links':
                return handleLinks(args);

            case 'codegraph_scan':
                return handleScan(args);

            case 'codegraph_files':
                return handleFiles(args);

            case 'codegraph_note':
                return handleNote(args);

            case 'codegraph_session':
                return handleSession(args);

            default:
                return {
                    content: [
                        {
                            type: 'text',
                            text: `Unknown tool: ${name}`,
                        },
                    ],
                };
        }
    } catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
        };
    }
}

/**
 * Handle codegraph_init
 */
async function handleInit(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
    const path = args.path as string;
    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = await init({
        path,
        name: args.name as string | undefined,
        exclude: args.exclude as string[] | undefined,
    });

    if (result.success) {
        let message = `✓ CodeGraph initialized for project\n\n`;
        message += `Database: ${result.codegraphPath}/index.db\n`;
        message += `Files indexed: ${result.filesIndexed}\n`;
        message += `Items found: ${result.itemsFound}\n`;
        message += `Methods found: ${result.methodsFound}\n`;
        message += `Types found: ${result.typesFound}\n`;
        message += `Duration: ${result.durationMs}ms`;

        if (result.errors.length > 0) {
            message += `\n\nWarnings (${result.errors.length}):\n`;
            message += result.errors.slice(0, 10).map(e => `  - ${e}`).join('\n');
            if (result.errors.length > 10) {
                message += `\n  ... and ${result.errors.length - 10} more`;
            }
        }

        return {
            content: [{ type: 'text', text: message }],
        };
    } else {
        return {
            content: [{ type: 'text', text: `Error: ${result.errors.join(', ')}` }],
        };
    }
}

/**
 * Handle codegraph_query
 */
function handleQuery(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const term = args.term as string;

    if (!path || !term) {
        return {
            content: [{ type: 'text', text: 'Error: path and term parameters are required' }],
        };
    }

    const result = query({
        path,
        term,
        mode: (args.mode as QueryMode) ?? 'exact',
        fileFilter: args.file_filter as string | undefined,
        typeFilter: args.type_filter as string[] | undefined,
        modifiedSince: args.modified_since as string | undefined,
        modifiedBefore: args.modified_before as string | undefined,
        limit: args.limit as number | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.matches.length === 0) {
        return {
            content: [{ type: 'text', text: `No matches found for "${term}" (mode: ${result.mode})` }],
        };
    }

    // Format results
    let message = `Found ${result.totalMatches} match(es) for "${term}" (mode: ${result.mode})`;
    if (result.truncated) {
        message += ` [showing first ${result.matches.length}]`;
    }
    message += '\n\n';

    // Group by file
    const byFile = new Map<string, Array<{ lineNumber: number; lineType: string }>>();
    for (const match of result.matches) {
        if (!byFile.has(match.file)) {
            byFile.set(match.file, []);
        }
        byFile.get(match.file)!.push({ lineNumber: match.lineNumber, lineType: match.lineType });
    }

    for (const [file, lines] of byFile) {
        message += `${file}\n`;
        for (const line of lines) {
            message += `  :${line.lineNumber} (${line.lineType})\n`;
        }
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_status
 */
function handleStatus(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string | undefined;

    if (!path) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        status: 'running',
                        version: '0.1.0',
                        message: 'CodeGraph MCP server is running. Use codegraph_init to index a project.',
                    }, null, 2),
                },
            ],
        };
    }

    // Check if project has .codegraph
    const codegraphDir = join(path, '.codegraph');
    const dbPath = join(codegraphDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            content: [
                {
                    type: 'text',
                    text: `No CodeGraph index found at ${path}. Run codegraph_init first.`,
                },
            ],
        };
    }

    // Open database and get stats
    const db = openDatabase(dbPath, true);
    const stats = db.getStats();
    const projectName = db.getMetadata('project_name') ?? 'Unknown';
    const schemaVersion = db.getMetadata('schema_version') ?? 'Unknown';
    db.close();

    return {
        content: [
            {
                type: 'text',
                text: JSON.stringify({
                    project: projectName,
                    schemaVersion,
                    statistics: stats,
                    databasePath: dbPath,
                }, null, 2),
            },
        ],
    };
}

/**
 * Handle codegraph_signature
 */
function handleSignature(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const file = args.file as string;

    if (!path || !file) {
        return {
            content: [{ type: 'text', text: 'Error: path and file parameters are required' }],
        };
    }

    const result = signature({ path, file });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    // Format output
    let message = `# Signature: ${result.file}\n\n`;

    // Header comments
    if (result.headerComments) {
        message += `## Header Comments\n\`\`\`\n${result.headerComments}\n\`\`\`\n\n`;
    }

    // Types
    if (result.types.length > 0) {
        message += `## Types (${result.types.length})\n`;
        for (const t of result.types) {
            message += `- **${t.kind}** \`${t.name}\` (line ${t.lineNumber})\n`;
        }
        message += '\n';
    }

    // Methods
    if (result.methods.length > 0) {
        message += `## Methods (${result.methods.length})\n`;
        for (const m of result.methods) {
            const modifiers: string[] = [];
            if (m.visibility) modifiers.push(m.visibility);
            if (m.isStatic) modifiers.push('static');
            if (m.isAsync) modifiers.push('async');
            const prefix = modifiers.length > 0 ? `[${modifiers.join(' ')}] ` : '';
            message += `- ${prefix}\`${m.prototype}\` (line ${m.lineNumber})\n`;
        }
    }

    if (result.types.length === 0 && result.methods.length === 0 && !result.headerComments) {
        message += '_No signature data found for this file._\n';
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_signatures
 */
function handleSignatures(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const pattern = args.pattern as string | undefined;
    const files = args.files as string[] | undefined;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    if (!pattern && (!files || files.length === 0)) {
        return {
            content: [{ type: 'text', text: 'Error: either pattern or files parameter is required' }],
        };
    }

    const result = signatures({ path, pattern, files });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.signatures.length === 0) {
        const searchDesc = pattern ? `pattern "${pattern}"` : `files list`;
        return {
            content: [{ type: 'text', text: `No files found matching ${searchDesc}` }],
        };
    }

    // Format output - summary view
    let message = `# Signatures (${result.totalFiles} files)\n\n`;

    for (const sig of result.signatures) {
        if (!sig.success) {
            message += `## ${sig.file}\n_Error: ${sig.error}_\n\n`;
            continue;
        }

        message += `## ${sig.file}\n`;

        // Compact summary
        const parts: string[] = [];
        if (sig.types.length > 0) {
            const typesSummary = sig.types.map(t => `${t.kind} ${t.name}`).join(', ');
            parts.push(`Types: ${typesSummary}`);
        }
        if (sig.methods.length > 0) {
            parts.push(`Methods: ${sig.methods.length}`);
        }

        if (parts.length > 0) {
            message += parts.join(' | ') + '\n';
        }

        // List methods compactly
        if (sig.methods.length > 0) {
            for (const m of sig.methods) {
                const modifiers: string[] = [];
                if (m.visibility) modifiers.push(m.visibility);
                if (m.isStatic) modifiers.push('static');
                if (m.isAsync) modifiers.push('async');
                const prefix = modifiers.length > 0 ? `[${modifiers.join(' ')}] ` : '';
                message += `  - ${prefix}${m.prototype} :${m.lineNumber}\n`;
            }
        }

        message += '\n';
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_update
 */
function handleUpdate(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const file = args.file as string;

    if (!path || !file) {
        return {
            content: [{ type: 'text', text: 'Error: path and file parameters are required' }],
        };
    }

    const result = update({ path, file });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    // Check if file was unchanged
    if (result.error === 'File unchanged (hash match)') {
        return {
            content: [{ type: 'text', text: `File unchanged: ${result.file} (hash match, no update needed)` }],
        };
    }

    let message = `✓ Updated: ${result.file}\n`;
    message += `  Items: +${result.itemsAdded} / -${result.itemsRemoved}\n`;
    message += `  Methods: ${result.methodsUpdated}\n`;
    message += `  Types: ${result.typesUpdated}\n`;
    message += `  Duration: ${result.durationMs}ms`;

    return {
        content: [{ type: 'text', text: message }],
    };
}

/**
 * Handle codegraph_remove
 */
function handleRemove(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const file = args.file as string;

    if (!path || !file) {
        return {
            content: [{ type: 'text', text: 'Error: path and file parameters are required' }],
        };
    }

    const result = remove({ path, file });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (!result.removed) {
        return {
            content: [{ type: 'text', text: `File not in index: ${result.file}` }],
        };
    }

    return {
        content: [{ type: 'text', text: `✓ Removed from index: ${result.file}` }],
    };
}

/**
 * Handle codegraph_summary
 */
function handleSummary(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = summary({ path });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    let message = `# Project: ${result.name}\n\n`;

    // Auto-generated info
    message += `## Overview\n`;
    message += `- **Files indexed:** ${result.autoGenerated.fileCount}\n`;
    message += `- **Languages:** ${result.autoGenerated.languages.join(', ') || 'None detected'}\n`;

    if (result.autoGenerated.entryPoints.length > 0) {
        message += `- **Entry points:** ${result.autoGenerated.entryPoints.join(', ')}\n`;
    }

    if (result.autoGenerated.mainTypes.length > 0) {
        message += `\n## Main Types\n`;
        for (const t of result.autoGenerated.mainTypes) {
            message += `- ${t}\n`;
        }
    }

    // User-provided summary content
    if (result.content) {
        message += `\n---\n\n${result.content}`;
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_tree
 */
function handleTree(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = tree({
        path,
        subpath: args.subpath as string | undefined,
        depth: args.depth as number | undefined,
        includeStats: args.include_stats as boolean | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.entries.length === 0) {
        return {
            content: [{ type: 'text', text: `No files found in ${result.root}` }],
        };
    }

    let message = `# File Tree: ${result.root} (${result.totalFiles} files)\n\n`;

    for (const entry of result.entries) {
        if (entry.type === 'directory') {
            message += `📁 ${entry.path}/\n`;
        } else {
            let stats = '';
            if (entry.itemCount !== undefined) {
                stats = ` [${entry.itemCount} items, ${entry.methodCount} methods, ${entry.typeCount} types]`;
            }
            message += `  📄 ${entry.path}${stats}\n`;
        }
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_describe
 */
function handleDescribe(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const section = args.section as string;
    const content = args.content as string;

    if (!path || !section || !content) {
        return {
            content: [{ type: 'text', text: 'Error: path, section, and content parameters are required' }],
        };
    }

    const validSections = ['purpose', 'architecture', 'concepts', 'patterns', 'notes'];
    if (!validSections.includes(section)) {
        return {
            content: [{ type: 'text', text: `Error: section must be one of: ${validSections.join(', ')}` }],
        };
    }

    const result = describe({
        path,
        section: section as 'purpose' | 'architecture' | 'concepts' | 'patterns' | 'notes',
        content,
        replace: args.replace as boolean | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    return {
        content: [{ type: 'text', text: `✓ Updated section: ${result.section}` }],
    };
}

/**
 * Handle codegraph_link
 */
function handleLink(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const dependency = args.dependency as string;

    if (!path || !dependency) {
        return {
            content: [{ type: 'text', text: 'Error: path and dependency parameters are required' }],
        };
    }

    const result = link({
        path,
        dependency,
        name: args.name as string | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    return {
        content: [{ type: 'text', text: `✓ Linked: ${result.name} (${result.filesAvailable} files)` }],
    };
}

/**
 * Handle codegraph_unlink
 */
function handleUnlink(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const dependency = args.dependency as string;

    if (!path || !dependency) {
        return {
            content: [{ type: 'text', text: 'Error: path and dependency parameters are required' }],
        };
    }

    const result = unlink({ path, dependency });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (!result.removed) {
        return {
            content: [{ type: 'text', text: `Dependency not found: ${dependency}` }],
        };
    }

    return {
        content: [{ type: 'text', text: `✓ Unlinked: ${dependency}` }],
    };
}

/**
 * Handle codegraph_links
 */
function handleLinks(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = listLinks({ path });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.dependencies.length === 0) {
        return {
            content: [{ type: 'text', text: 'No linked dependencies.' }],
        };
    }

    let message = `# Linked Dependencies (${result.dependencies.length})\n\n`;

    for (const dep of result.dependencies) {
        const status = dep.available ? '✓' : '✗';
        const name = dep.name ?? 'unnamed';
        message += `${status} **${name}**\n`;
        message += `  Path: ${dep.path}\n`;
        message += `  Files: ${dep.filesAvailable}\n`;
        if (!dep.available) {
            message += `  ⚠️ Not available (index missing)\n`;
        }
        message += '\n';
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_scan
 */
function handleScan(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = scan({
        path,
        maxDepth: args.max_depth as number | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.projects.length === 0) {
        return {
            content: [{ type: 'text', text: `No CodeGraph indexes found in ${result.searchPath}\n(scanned ${result.scannedDirs} directories)` }],
        };
    }

    let message = `# CodeGraph Indexes Found (${result.projects.length})\n\n`;
    message += `Scanned: ${result.searchPath} (${result.scannedDirs} directories)\n\n`;

    for (const proj of result.projects) {
        message += `## ${proj.name}\n`;
        message += `- **Path:** ${proj.path}\n`;
        message += `- **Files:** ${proj.files} | **Items:** ${proj.items} | **Methods:** ${proj.methods} | **Types:** ${proj.types}\n`;
        message += `- **Last indexed:** ${proj.lastIndexed}\n`;
        message += '\n';
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_files
 */
function handleFiles(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = files({
        path,
        type: args.type as string | undefined,
        pattern: args.pattern as string | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.files.length === 0) {
        return {
            content: [{ type: 'text', text: 'No files found in project.' }],
        };
    }

    // Build summary
    let message = `# Project Files (${result.totalFiles})\n\n`;

    // Type statistics
    message += `## By Type\n`;
    for (const [type, count] of Object.entries(result.byType).sort()) {
        message += `- **${type}:** ${count}\n`;
    }
    message += '\n';

    // Group files by directory
    const byDir = new Map<string, typeof result.files>();
    for (const file of result.files) {
        const dir = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '.';
        if (!byDir.has(dir)) {
            byDir.set(dir, []);
        }
        byDir.get(dir)!.push(file);
    }

    // List files (limit output for large projects)
    const MAX_ENTRIES = 200;
    let entriesShown = 0;

    message += `## Files\n`;
    for (const [dir, dirFiles] of [...byDir.entries()].sort()) {
        if (entriesShown >= MAX_ENTRIES) {
            message += `\n... and ${result.totalFiles - entriesShown} more files\n`;
            break;
        }

        // Show directory
        if (dir !== '.') {
            message += `\n📁 ${dir}/\n`;
            entriesShown++;
        }

        // Show files in directory
        for (const file of dirFiles) {
            if (entriesShown >= MAX_ENTRIES) break;

            const fileName = file.path.includes('/') ? file.path.substring(file.path.lastIndexOf('/') + 1) : file.path;
            const icon = file.type === 'dir' ? '📁' : '📄';
            const indexed = file.indexed ? ' ✓' : '';
            message += `  ${icon} ${fileName} (${file.type})${indexed}\n`;
            entriesShown++;
        }
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle codegraph_note
 */
function handleNote(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = note({
        path,
        note: args.note as string | undefined,
        append: args.append as boolean | undefined,
        clear: args.clear as boolean | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    switch (result.action) {
        case 'clear':
            return {
                content: [{ type: 'text', text: '✓ Session note cleared.' }],
            };

        case 'write':
            return {
                content: [{ type: 'text', text: `✓ Session note saved:\n\n${result.note}` }],
            };

        case 'append':
            return {
                content: [{ type: 'text', text: `✓ Appended to session note:\n\n${result.note}` }],
            };

        case 'read':
        default:
            if (!result.note) {
                return {
                    content: [{ type: 'text', text: 'No session note set for this project.' }],
                };
            }
            return {
                content: [{ type: 'text', text: `📝 Session Note:\n\n${result.note}` }],
            };
    }
}

/**
 * Handle codegraph_session
 */
function handleSession(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = session({ path });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    let message = '';

    // Session status
    if (result.isNewSession) {
        message += '🆕 **New Session Started**\n\n';
    } else {
        message += '▶️ **Session Continued**\n\n';
    }

    // Last session info
    if (result.sessionInfo.lastSessionStart && result.sessionInfo.lastSessionEnd) {
        message += '## Last Session\n';
        message += `- **Start:** ${formatSessionTime(result.sessionInfo.lastSessionStart)}\n`;
        message += `- **End:** ${formatSessionTime(result.sessionInfo.lastSessionEnd)}\n`;
        message += `- **Duration:** ${formatDuration(result.sessionInfo.lastSessionStart, result.sessionInfo.lastSessionEnd)}\n`;
        message += `\n💡 Query last session changes with:\n\`codegraph_query({ term: "...", modified_since: "${result.sessionInfo.lastSessionStart}", modified_before: "${result.sessionInfo.lastSessionEnd}" })\`\n\n`;
    }

    // External changes
    if (result.externalChanges.length > 0) {
        message += '## External Changes Detected\n';
        message += `Found ${result.externalChanges.length} file(s) changed outside of session:\n\n`;

        for (const change of result.externalChanges) {
            const icon = change.reason === 'deleted' ? '🗑️' : '✏️';
            message += `- ${icon} ${change.path} (${change.reason})\n`;
        }

        if (result.reindexed.length > 0) {
            message += `\n✅ Auto-reindexed ${result.reindexed.length} file(s)\n`;
        }
        message += '\n';
    }

    // Session note
    if (result.note) {
        message += '## 📝 Session Note\n';
        message += result.note + '\n';
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}
