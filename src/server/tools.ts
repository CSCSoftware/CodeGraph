/**
 * MCP Tool definitions and handlers for AiDex
 */

import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { existsSync } from 'fs';
import { join } from 'path';
import { init, query, signature, signatures, update, remove, summary, tree, describe, link, unlink, listLinks, scan, files, note, getSessionNote, session, formatSessionTime, formatDuration, task, tasks, screenshot, listWindows, type QueryMode, type TaskAction, type ScreenshotMode } from '../commands/index.js';
import type { TaskRow } from '../db/index.js';
import { openDatabase } from '../db/index.js';
import { startViewer, stopViewer } from '../viewer/index.js';
import { PRODUCT_NAME, PRODUCT_NAME_LOWER, PRODUCT_VERSION, INDEX_DIR, TOOL_PREFIX } from '../constants.js';

/**
 * Register all available tools
 */
export function registerTools(): Tool[] {
    return [
        {
            name: `${TOOL_PREFIX}init`,
            description: `Initialize ${PRODUCT_NAME} indexing for a project. Scans all source files and builds a searchable index of identifiers, methods, types, and signatures.`,
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
            name: `${TOOL_PREFIX}query`,
            description: `Search for terms/identifiers in the ${PRODUCT_NAME} index. Returns file locations where the term appears. PREFERRED over Grep/Glob for code searches when ${INDEX_DIR}/ exists - faster and more precise. Use this instead of grep for finding functions, classes, variables by name.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}status`,
            description: `Get ${PRODUCT_NAME} server status and statistics for an indexed project`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory (optional, shows server status if not provided)`,
                    },
                },
                required: [],
            },
        },
        {
            name: `${TOOL_PREFIX}signature`,
            description: 'Get the signature of a single file: header comments, types (classes/structs/interfaces), and method prototypes. Use this INSTEAD of reading entire files when you only need to know what methods/classes exist. Much faster than Read tool for understanding file structure.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}signatures`,
            description: 'Get signatures for multiple files at once using glob pattern or file list. Returns types and method prototypes. Use INSTEAD of reading multiple files when exploring codebase structure. Much more efficient than multiple Read calls.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}update`,
            description: `Re-index a single file. Use after editing a file to update the ${PRODUCT_NAME} index. If the file is new, it will be added to the index. If unchanged (same hash), no update is performed.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}remove`,
            description: `Remove a file from the ${PRODUCT_NAME} index. Use when a file has been deleted from the project.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}summary`,
            description: 'Get project summary including auto-detected entry points, main types, and languages. Also returns content from summary.md if it exists.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
                    },
                },
                required: ['path'],
            },
        },
        {
            name: `${TOOL_PREFIX}tree`,
            description: 'Get the indexed file tree. Optionally filter by subdirectory, limit depth, or include statistics per file.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}describe`,
            description: 'Add or update a section in the project summary (summary.md). Use to document project purpose, architecture, key concepts, or patterns.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}link`,
            description: `Link a dependency project to enable cross-project queries. The dependency must have its own ${INDEX_DIR} index.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to current project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}unlink`,
            description: 'Remove a linked dependency project.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to current project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}links`,
            description: 'List all linked dependency projects.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
                    },
                },
                required: ['path'],
            },
        },
        {
            name: `${TOOL_PREFIX}scan`,
            description: `Scan a directory tree to find all projects with ${PRODUCT_NAME} indexes (${INDEX_DIR} directories). Use this to discover which projects are already indexed before using Grep/Glob - indexed projects should use ${TOOL_PREFIX}query instead.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Root path to scan for ${INDEX_DIR} directories`,
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
            name: `${TOOL_PREFIX}files`,
            description: 'List all files and directories in the indexed project. Returns the complete project structure with file types (code, config, doc, asset, test, other) and whether each file is indexed for code search. Use modified_since to find files changed in this session.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
                    modified_since: {
                        type: 'string',
                        description: 'Only files indexed after this time. Supports: "2h", "30m", "1d", "1w", or ISO date. Use to find files changed this session.',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: `${TOOL_PREFIX}note`,
            description: `Read or write a session note for the project. Use this to leave reminders for the next session (e.g., "Test the glob fix", "Refactor X"). Notes persist in the ${PRODUCT_NAME} database and are shown when querying the project.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
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
            name: `${TOOL_PREFIX}session`,
            description: `Start or check an ${PRODUCT_NAME} session. Call this at the beginning of a new chat session to: (1) detect files changed externally since last session, (2) auto-reindex modified files, (3) get session note and last session times. Returns info for "What did we do last session?" queries.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
                    },
                },
                required: ['path'],
            },
        },
        {
            name: `${TOOL_PREFIX}viewer`,
            description: 'Open an interactive project tree viewer in the browser. Shows the indexed file structure with clickable nodes - click on a file to see its signature (header comments, types, methods). Uses a local HTTP server with WebSocket for live updates.',
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
                    },
                    action: {
                        type: 'string',
                        enum: ['open', 'close'],
                        description: 'Action to perform: open (default) or close the viewer',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: `${TOOL_PREFIX}task`,
            description: `Manage a single task in the project backlog. Actions: create (new task), read (get task + log), update (change fields), delete, log (add history note). Tasks persist in the ${PRODUCT_NAME} database. Completed tasks are preserved as documentation.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
                    },
                    action: {
                        type: 'string',
                        enum: ['create', 'read', 'update', 'delete', 'log'],
                        description: 'Action to perform on the task',
                    },
                    id: {
                        type: 'number',
                        description: 'Task ID (required for read/update/delete/log)',
                    },
                    title: {
                        type: 'string',
                        description: 'Task title (required for create)',
                    },
                    description: {
                        type: 'string',
                        description: 'Task description (optional details)',
                    },
                    priority: {
                        type: 'number',
                        enum: [1, 2, 3],
                        description: 'Priority: 1=high, 2=medium (default), 3=low',
                    },
                    status: {
                        type: 'string',
                        enum: ['backlog', 'active', 'done', 'cancelled'],
                        description: 'Task status (default: backlog)',
                    },
                    tags: {
                        type: 'string',
                        description: 'Comma-separated tags (e.g., "bug, viewer, parser")',
                    },
                    source: {
                        type: 'string',
                        description: 'Where the task came from (freetext, e.g., "code review of parser.ts:142")',
                    },
                    sort_order: {
                        type: 'number',
                        description: 'Sort order within same priority (lower = first, default: 0)',
                    },
                    note: {
                        type: 'string',
                        description: 'Log note text (required for log action)',
                    },
                },
                required: ['path', 'action'],
            },
        },
        {
            name: `${TOOL_PREFIX}tasks`,
            description: `List and filter tasks in the project backlog. Returns tasks grouped by status (active, backlog, done, cancelled) and sorted by priority. Use to get an overview of all open and completed work.`,
            inputSchema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description: `Path to project with ${INDEX_DIR} directory`,
                    },
                    status: {
                        type: 'string',
                        enum: ['backlog', 'active', 'done', 'cancelled'],
                        description: 'Filter by status (default: show all)',
                    },
                    priority: {
                        type: 'number',
                        enum: [1, 2, 3],
                        description: 'Filter by priority',
                    },
                    tag: {
                        type: 'string',
                        description: 'Filter by tag (matches any task containing this tag)',
                    },
                },
                required: ['path'],
            },
        },
        {
            name: `${TOOL_PREFIX}screenshot`,
            description: 'Take a screenshot of the screen, active window, a specific window, an interactive region selection, or a specific rectangle by coordinates. Returns the file path so you can immediately Read the image. No project index required.',
            inputSchema: {
                type: 'object',
                properties: {
                    mode: {
                        type: 'string',
                        enum: ['fullscreen', 'active_window', 'window', 'region', 'rect'],
                        description: 'Capture mode: fullscreen (default), active_window, window (by title), region (interactive selection), or rect (specific coordinates)',
                    },
                    window_title: {
                        type: 'string',
                        description: 'Window title substring to match (required when mode="window"). Use aidex_windows to find titles.',
                    },
                    monitor: {
                        type: 'number',
                        description: 'Monitor index (0-based, default: primary). Only applies to fullscreen mode.',
                    },
                    delay: {
                        type: 'number',
                        description: 'Seconds to wait before capturing (e.g., 3 to give time to switch windows)',
                    },
                    filename: {
                        type: 'string',
                        description: 'Custom filename (default: aidex-screenshot.png). Overwrites if exists.',
                    },
                    save_path: {
                        type: 'string',
                        description: 'Custom directory to save in (default: system temp directory)',
                    },
                    x: {
                        type: 'number',
                        description: 'X coordinate of the capture rectangle (required when mode="rect")',
                    },
                    y: {
                        type: 'number',
                        description: 'Y coordinate of the capture rectangle (required when mode="rect")',
                    },
                    width: {
                        type: 'number',
                        description: 'Width of the capture rectangle in pixels (required when mode="rect")',
                    },
                    height: {
                        type: 'number',
                        description: 'Height of the capture rectangle in pixels (required when mode="rect")',
                    },
                },
                required: [],
            },
        },
        {
            name: `${TOOL_PREFIX}windows`,
            description: 'List all open windows with their titles, PIDs, and process names. Use this to find the exact window title for aidex_screenshot with mode="window". No project index required.',
            inputSchema: {
                type: 'object',
                properties: {
                    filter: {
                        type: 'string',
                        description: 'Optional substring to filter window titles (case-insensitive)',
                    },
                },
                required: [],
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
            case `${TOOL_PREFIX}init`:
                return await handleInit(args);

            case `${TOOL_PREFIX}query`:
                return handleQuery(args);

            case `${TOOL_PREFIX}status`:
                return handleStatus(args);

            case `${TOOL_PREFIX}signature`:
                return handleSignature(args);

            case `${TOOL_PREFIX}signatures`:
                return handleSignatures(args);

            case `${TOOL_PREFIX}update`:
                return handleUpdate(args);

            case `${TOOL_PREFIX}remove`:
                return handleRemove(args);

            case `${TOOL_PREFIX}summary`:
                return handleSummary(args);

            case `${TOOL_PREFIX}tree`:
                return handleTree(args);

            case `${TOOL_PREFIX}describe`:
                return handleDescribe(args);

            case `${TOOL_PREFIX}link`:
                return handleLink(args);

            case `${TOOL_PREFIX}unlink`:
                return handleUnlink(args);

            case `${TOOL_PREFIX}links`:
                return handleLinks(args);

            case `${TOOL_PREFIX}scan`:
                return handleScan(args);

            case `${TOOL_PREFIX}files`:
                return handleFiles(args);

            case `${TOOL_PREFIX}note`:
                return handleNote(args);

            case `${TOOL_PREFIX}session`:
                return handleSession(args);

            case `${TOOL_PREFIX}viewer`:
                return handleViewer(args);

            case `${TOOL_PREFIX}task`:
                return handleTask(args);

            case `${TOOL_PREFIX}tasks`:
                return handleTasks(args);

            case `${TOOL_PREFIX}screenshot`:
                return handleScreenshot(args);

            case `${TOOL_PREFIX}windows`:
                return handleWindows(args);

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
 * Handle init
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
        let message = `✓ ${PRODUCT_NAME} initialized for project\n\n`;
        message += `Database: ${result.indexPath}/index.db\n`;
        message += `Files indexed: ${result.filesIndexed}`;
        if (result.filesSkipped > 0) {
            message += ` (${result.filesSkipped} unchanged, skipped)`;
        }
        message += `\n`;
        if (result.filesRemoved > 0) {
            message += `Files removed: ${result.filesRemoved} (now excluded)\n`;
        }
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
 * Handle query
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
 * Handle status
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
                        version: PRODUCT_VERSION,
                        message: `${PRODUCT_NAME} MCP server is running. Use ${TOOL_PREFIX}init to index a project.`,
                    }, null, 2),
                },
            ],
        };
    }

    // Check if project has index
    const indexDir = join(path, INDEX_DIR);
    const dbPath = join(indexDir, 'index.db');

    if (!existsSync(dbPath)) {
        return {
            content: [
                {
                    type: 'text',
                    text: `No ${PRODUCT_NAME} index found at ${path}. Run ${TOOL_PREFIX}init first.`,
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
 * Handle signature
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
 * Handle signatures
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
 * Handle update
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
 * Handle remove
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
 * Handle summary
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
 * Handle tree
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
 * Handle describe
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
 * Handle link
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
 * Handle unlink
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
 * Handle links
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
 * Handle scan
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
            content: [{ type: 'text', text: `No ${PRODUCT_NAME} indexes found in ${result.searchPath}\n(scanned ${result.scannedDirs} directories)` }],
        };
    }

    let message = `# ${PRODUCT_NAME} Indexes Found (${result.projects.length})\n\n`;
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
 * Handle files
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
        modifiedSince: args.modified_since as string | undefined,
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
 * Handle note
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
 * Handle session
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
        message += `\n💡 Query last session changes with:\n\`${TOOL_PREFIX}query({ term: "...", modified_since: "${result.sessionInfo.lastSessionStart}", modified_before: "${result.sessionInfo.lastSessionEnd}" })\`\n\n`;
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

/**
 * Handle viewer
 */
async function handleViewer(args: Record<string, unknown>): Promise<{ content: Array<{ type: string; text: string }> }> {
    const path = args.path as string;
    const action = (args.action as string) || 'open';

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    // Check if index directory exists
    const indexPath = join(path, INDEX_DIR);
    if (!existsSync(indexPath)) {
        return {
            content: [{ type: 'text', text: `Error: No ${INDEX_DIR} directory found at ${path}. Run ${TOOL_PREFIX}init first.` }],
        };
    }

    if (action === 'close') {
        const message = stopViewer();
        return {
            content: [{ type: 'text', text: message }],
        };
    }

    try {
        const message = await startViewer(path);
        return {
            content: [{ type: 'text', text: `🖥️ ${message}` }],
        };
    } catch (error) {
        return {
            content: [{ type: 'text', text: `Error starting viewer: ${error instanceof Error ? error.message : String(error)}` }],
        };
    }
}

/**
 * Handle task (single task CRUD + log)
 */
function handleTask(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;
    const action = args.action as TaskAction;

    if (!path || !action) {
        return {
            content: [{ type: 'text', text: 'Error: path and action parameters are required' }],
        };
    }

    const result = task({
        path,
        action,
        id: args.id as number | undefined,
        title: args.title as string | undefined,
        description: args.description as string | undefined,
        priority: args.priority as 1 | 2 | 3 | undefined,
        status: args.status as 'backlog' | 'active' | 'done' | 'cancelled' | undefined,
        tags: args.tags as string | undefined,
        source: args.source as string | undefined,
        sort_order: args.sort_order as number | undefined,
        note: args.note as string | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    const priorityLabel: Record<number, string> = { 1: '🔴 high', 2: '🟡 medium', 3: '⚪ low' };

    switch (result.action) {
        case 'create':
        case 'update': {
            const t = result.task!;
            let msg = `✓ Task #${t.id} ${result.action === 'create' ? 'created' : 'updated'}\n\n`;
            msg += `**${t.title}**\n`;
            msg += `Priority: ${priorityLabel[t.priority]} | Status: ${t.status}\n`;
            if (t.description) msg += `Description: ${t.description}\n`;
            if (t.tags) msg += `Tags: ${t.tags}\n`;
            if (t.source) msg += `Source: ${t.source}\n`;
            return { content: [{ type: 'text', text: msg.trimEnd() }] };
        }
        case 'read': {
            const t = result.task!;
            let msg = `# Task #${t.id}: ${t.title}\n\n`;
            msg += `Priority: ${priorityLabel[t.priority]} | Status: ${t.status}\n`;
            if (t.description) msg += `Description: ${t.description}\n`;
            if (t.tags) msg += `Tags: ${t.tags}\n`;
            if (t.source) msg += `Source: ${t.source}\n`;
            msg += `Created: ${new Date(t.created_at).toISOString()}\n`;
            if (t.completed_at) msg += `Completed: ${new Date(t.completed_at).toISOString()}\n`;
            if (result.log && result.log.length > 0) {
                msg += `\n## Log (${result.log.length})\n`;
                for (const entry of result.log) {
                    msg += `- [${new Date(entry.created_at).toISOString()}] ${entry.note}\n`;
                }
            }
            return { content: [{ type: 'text', text: msg.trimEnd() }] };
        }
        case 'delete':
            return { content: [{ type: 'text', text: `✓ Task #${args.id} deleted` }] };
        case 'log': {
            const t = result.task!;
            let msg = `✓ Log added to Task #${t.id}: ${t.title}\n\n`;
            msg += `## Log (${result.log!.length})\n`;
            for (const entry of result.log!) {
                msg += `- [${new Date(entry.created_at).toISOString()}] ${entry.note}\n`;
            }
            return { content: [{ type: 'text', text: msg.trimEnd() }] };
        }
        default:
            return { content: [{ type: 'text', text: 'Unknown action' }] };
    }
}

/**
 * Handle tasks (list/filter)
 */
function handleTasks(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const path = args.path as string;

    if (!path) {
        return {
            content: [{ type: 'text', text: 'Error: path parameter is required' }],
        };
    }

    const result = tasks({
        path,
        status: args.status as 'backlog' | 'active' | 'done' | 'cancelled' | undefined,
        priority: args.priority as 1 | 2 | 3 | undefined,
        tag: args.tag as string | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.tasks.length === 0) {
        return {
            content: [{ type: 'text', text: 'No tasks found.' }],
        };
    }

    const priorityIcon: Record<number, string> = { 1: '🔴', 2: '🟡', 3: '⚪' };
    let msg = `# Task Backlog (${result.total})\n\n`;

    // Group by status
    const byStatus: Record<string, TaskRow[]> = { active: [], backlog: [], done: [], cancelled: [] };
    for (const t of result.tasks) {
        byStatus[t.status].push(t);
    }

    for (const [status, items] of Object.entries(byStatus)) {
        if (items.length === 0) continue;
        msg += `## ${status.charAt(0).toUpperCase() + status.slice(1)} (${items.length})\n`;
        for (const t of items) {
            msg += `- ${priorityIcon[t.priority]} **#${t.id}** ${t.title}`;
            if (t.tags) msg += ` [${t.tags}]`;
            msg += '\n';
        }
        msg += '\n';
    }

    return {
        content: [{ type: 'text', text: msg.trimEnd() }],
    };
}

/**
 * Handle screenshot
 */
function handleScreenshot(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const result = screenshot({
        mode: args.mode as ScreenshotMode | undefined,
        window_title: args.window_title as string | undefined,
        monitor: args.monitor as number | undefined,
        delay: args.delay as number | undefined,
        filename: args.filename as string | undefined,
        save_path: args.save_path as string | undefined,
        x: args.x as number | undefined,
        y: args.y as number | undefined,
        width: args.width as number | undefined,
        height: args.height as number | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    let message = `Screenshot captured!\n\n`;
    message += `**File:** ${result.file_path}\n`;
    message += `**Mode:** ${result.mode}\n`;
    if (result.monitor !== undefined) {
        message += `**Monitor:** ${result.monitor}\n`;
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}

/**
 * Handle windows listing
 */
function handleWindows(args: Record<string, unknown>): { content: Array<{ type: string; text: string }> } {
    const result = listWindows({
        filter: args.filter as string | undefined,
    });

    if (!result.success) {
        return {
            content: [{ type: 'text', text: `Error: ${result.error}` }],
        };
    }

    if (result.windows.length === 0) {
        let msg = 'No windows found.';
        if (args.filter) msg += ` (filter: "${args.filter}")`;
        return {
            content: [{ type: 'text', text: msg }],
        };
    }

    let message = `# Open Windows (${result.windows.length})\n\n`;

    for (const w of result.windows) {
        message += `- **${w.title}**`;
        if (w.process_name) message += ` (${w.process_name})`;
        message += ` [PID: ${w.pid}]\n`;
    }

    return {
        content: [{ type: 'text', text: message.trimEnd() }],
    };
}
