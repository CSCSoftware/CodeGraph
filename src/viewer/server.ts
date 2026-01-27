/**
 * CodeGraph Viewer - Local HTTP Server with WebSocket
 * Opens an interactive project tree in the browser
 *
 * Features:
 * - Tab-based navigation (Code/All files, Overview/Code view)
 * - Session change indicators (modified/new files)
 * - Syntax highlighting with highlight.js
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { exec } from 'child_process';
import path from 'path';
import { existsSync, readFileSync } from 'fs';
import chokidar, { FSWatcher } from 'chokidar';
import { openDatabase, createQueries } from '../db/index.js';
import { update as updateIndex } from '../commands/update.js';
import type Database from 'better-sqlite3';

const PORT = 3333;

let server: ReturnType<typeof createServer> | null = null;
let wss: WebSocketServer | null = null;
let fileWatcher: FSWatcher | null = null;

interface ViewerMessage {
    type: 'getTree' | 'getSignature' | 'getFileContent';
    mode?: 'code' | 'all';  // Tree mode
    path?: string;
    file?: string;
}

interface TreeNode {
    name: string;
    path: string;
    type: 'dir' | 'file';
    fileType?: string;  // code, config, doc, asset, test, other
    children?: TreeNode[];
    stats?: {
        items: number;
        methods: number;
        types: number;
    };
    status?: 'modified' | 'new' | 'unchanged';  // Session change status
}

interface SessionChangeInfo {
    modified: Set<string>;
    new: Set<string>;
}

export async function startViewer(projectPath: string): Promise<string> {
    // Check if already running
    if (server) {
        return `Viewer already running at http://localhost:${PORT}`;
    }

    const dbPath = path.join(projectPath, '.codegraph', 'index.db');
    const db = openDatabase(dbPath, true); // readonly for queries
    const sqlite = db.getDb();
    const queries = createQueries(db);
    const projectRoot = path.resolve(projectPath);
    const absoluteProjectPath = path.resolve(projectPath); // For updateIndex

    // Track files changed - initialize with DB session changes, then add live changes
    const dbSessionChanges = detectSessionChanges(sqlite);
    const viewerSessionChanges: SessionChangeInfo = {
        modified: new Set(dbSessionChanges.modified),
        new: new Set(dbSessionChanges.new)
    };

    console.error('[Viewer] Session changes from DB:', viewerSessionChanges.modified.size, 'modified,', viewerSessionChanges.new.size, 'new');

    const app = express();
    server = createServer(app);
    wss = new WebSocketServer({ server });

    // File watcher for live reload
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const pendingChanges: Set<string> = new Set();  // Files changed since last broadcast

    const broadcastTreeUpdate = async () => {
        if (!wss) return;

        // Re-index changed files before refreshing the tree
        if (pendingChanges.size > 0) {
            console.error('[Viewer] Re-indexing', pendingChanges.size, 'changed file(s)');
            for (const changedFile of pendingChanges) {
                // Convert absolute path to relative path
                const relativePath = path.relative(projectRoot, changedFile).replace(/\\/g, '/');
                try {
                    // updateIndex opens its own DB connection with write access
                    const result = updateIndex({ path: absoluteProjectPath, file: relativePath });
                    console.error('[Viewer] Re-indexed:', relativePath, result.success ? '✓' : '✗');
                    // Track as modified in viewer session
                    viewerSessionChanges.modified.add(relativePath);
                } catch (err) {
                    console.error('[Viewer] Failed to re-index:', relativePath, err);
                }
            }
            pendingChanges.clear();
        }

        // Build fresh trees for both modes using viewer session tracking
        const freshDb = openDatabase(dbPath, true);
        const codeTree = await buildTree(freshDb.getDb(), projectPath, 'code', viewerSessionChanges);
        const allTree = await buildTree(freshDb.getDb(), projectPath, 'all', viewerSessionChanges);
        freshDb.close();

        // Broadcast to all connected clients
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: 'refresh', codeTree, allTree }));
            }
        });

        console.error('[Viewer] Broadcast tree update to', wss.clients.size, 'clients');
    };

    // Use chokidar for reliable cross-platform file watching
    fileWatcher = chokidar.watch(projectRoot, {
        ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/.codegraph/**',
            '**/build/**',
            '**/dist/**'
        ],
        ignoreInitial: true,
        persistent: true
    });

    fileWatcher.on('ready', () => {
        console.error('[Viewer] Chokidar ready, watching for changes');
    });

    fileWatcher.on('error', (error: unknown) => {
        console.error('[Viewer] Chokidar error:', error);
    });

    fileWatcher.on('all', (event: string, filePath: string) => {
        console.error('[Viewer] Chokidar event:', event, filePath);

        // Track changed files for re-indexing (only for change/add events on code files)
        if ((event === 'change' || event === 'add') && /\.(ts|tsx|js|jsx|cs|rs|py|c|cpp|h|hpp|java|go|php|rb)$/i.test(filePath)) {
            pendingChanges.add(filePath);
        }

        // Debounce: wait 500ms after last change before broadcasting
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            console.error('[Viewer] Broadcasting after debounce');
            broadcastTreeUpdate();
        }, 500);
    });

    console.error('[Viewer] Initializing chokidar for', projectRoot);

    // Serve static HTML
    app.get('/', (req, res) => {
        res.send(getViewerHTML(projectPath));
    });

    // Debug endpoint to manually trigger refresh
    app.get('/refresh', async (req, res) => {
        await broadcastTreeUpdate();
        res.send('Refresh triggered');
    });

    // WebSocket handling
    wss.on('connection', (ws: WebSocket) => {
        console.error('[Viewer] Client connected');

        ws.on('message', async (data: Buffer) => {
            try {
                const msg: ViewerMessage = JSON.parse(data.toString());

                if (msg.type === 'getTree') {
                    const mode = msg.mode || 'code';
                    const tree = await buildTree(sqlite, projectPath, mode, viewerSessionChanges);
                    ws.send(JSON.stringify({ type: 'tree', mode, data: tree }));
                }
                else if (msg.type === 'getSignature' && msg.file) {
                    const signature = await getFileSignature(sqlite, msg.file);
                    ws.send(JSON.stringify({ type: 'signature', file: msg.file, data: signature }));
                }
                else if (msg.type === 'getFileContent' && msg.file) {
                    const content = getFileContent(projectRoot, msg.file);
                    ws.send(JSON.stringify({ type: 'fileContent', file: msg.file, data: content }));
                }
            } catch (err) {
                console.error('[Viewer] Error:', err);
                ws.send(JSON.stringify({ type: 'error', message: String(err) }));
            }
        });

        ws.on('close', () => {
            console.error('[Viewer] Client disconnected');
        });

        // Send initial tree (code files only)
        buildTree(sqlite, projectPath, 'code', viewerSessionChanges).then(tree => {
            ws.send(JSON.stringify({ type: 'tree', mode: 'code', data: tree }));
        });
    });

    return new Promise((resolve, reject) => {
        server!.listen(PORT, () => {
            const url = `http://localhost:${PORT}`;
            console.error(`[Viewer] Server running at ${url}`);

            // Open browser
            openBrowser(url);

            resolve(`Viewer opened at ${url}`);
        });

        server!.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
                resolve(`Port ${PORT} already in use - viewer may already be running at http://localhost:${PORT}`);
            } else {
                reject(err);
            }
        });
    });
}

export function stopViewer(): string {
    if (server) {
        fileWatcher?.close();
        fileWatcher = null;
        wss?.close();
        server.close();
        server = null;
        wss = null;
        return 'Viewer stopped';
    }
    return 'Viewer was not running';
}

function openBrowser(url: string) {
    const platform = process.platform;
    let cmd: string;

    if (platform === 'win32') {
        cmd = `start "" "${url}"`;
    } else if (platform === 'darwin') {
        cmd = `open "${url}"`;
    } else {
        cmd = `xdg-open "${url}"`;
    }

    exec(cmd, (err) => {
        if (err) console.error('[Viewer] Failed to open browser:', err);
    });
}

/**
 * Detect files changed in the current session
 * Uses last_indexed timestamps vs session start time
 */
function detectSessionChanges(db: Database.Database): SessionChangeInfo {
    const changes: SessionChangeInfo = {
        modified: new Set(),
        new: new Set()
    };

    try {
        // Get session start time from metadata
        const sessionStartRow = db.prepare(
            `SELECT value FROM metadata WHERE key = 'last_session_start'`
        ).get() as { value: string } | undefined;

        if (!sessionStartRow) {
            // No session tracking yet - all files are "unchanged"
            return changes;
        }

        const sessionStart = parseInt(sessionStartRow.value, 10);

        // Find files indexed AFTER session start (not AT session start)
        // This ensures a fresh re-index doesn't mark everything as modified
        const recentlyIndexed = db.prepare(`
            SELECT path, last_indexed,
                   (SELECT COUNT(*) FROM lines l WHERE l.file_id = f.id) as line_count
            FROM files f
            WHERE last_indexed > ?
        `).all(sessionStart) as Array<{ path: string; last_indexed: number; line_count: number }>;

        for (const file of recentlyIndexed) {
            // Heuristic: if file has very few lines, it might be new
            // But we can't really distinguish new vs modified without more metadata
            // For now, mark all recently indexed files as "modified"
            changes.modified.add(file.path);
        }
    } catch {
        // Silently fail
    }

    return changes;
}

async function buildTree(
    db: Database.Database,
    projectPath: string,
    mode: 'code' | 'all',
    sessionChanges: SessionChangeInfo
): Promise<TreeNode> {
    let files: Array<{ path: string; items: number; methods: number; types: number; fileType?: string }>;

    if (mode === 'code') {
        // Only indexed code files (original behavior)
        files = db.prepare(`
            SELECT f.path,
                   COUNT(DISTINCT o.item_id) as items,
                   (SELECT COUNT(*) FROM methods m WHERE m.file_id = f.id) as methods,
                   (SELECT COUNT(*) FROM types t WHERE t.file_id = f.id) as types
            FROM files f
            LEFT JOIN lines l ON l.file_id = f.id
            LEFT JOIN occurrences o ON o.line_id = l.id
            GROUP BY f.id
            ORDER BY f.path
        `).all() as Array<{ path: string; items: number; methods: number; types: number }>;
    } else {
        // All project files from project_files table
        const projectFiles = db.prepare(`
            SELECT path, type as fileType FROM project_files WHERE type != 'dir' ORDER BY path
        `).all() as Array<{ path: string; fileType: string }>;

        // Get stats for indexed files
        const statsMap = new Map<string, { items: number; methods: number; types: number }>();
        const indexedStats = db.prepare(`
            SELECT f.path,
                   COUNT(DISTINCT o.item_id) as items,
                   (SELECT COUNT(*) FROM methods m WHERE m.file_id = f.id) as methods,
                   (SELECT COUNT(*) FROM types t WHERE t.file_id = f.id) as types
            FROM files f
            LEFT JOIN lines l ON l.file_id = f.id
            LEFT JOIN occurrences o ON o.line_id = l.id
            GROUP BY f.id
        `).all() as Array<{ path: string; items: number; methods: number; types: number }>;

        for (const stat of indexedStats) {
            statsMap.set(stat.path, { items: stat.items, methods: stat.methods, types: stat.types });
        }

        files = projectFiles.map(f => ({
            path: f.path,
            fileType: f.fileType,
            items: statsMap.get(f.path)?.items || 0,
            methods: statsMap.get(f.path)?.methods || 0,
            types: statsMap.get(f.path)?.types || 0
        }));
    }

    const root: TreeNode = {
        name: path.basename(projectPath),
        path: '',
        type: 'dir',
        children: []
    };

    for (const file of files) {
        const parts = file.path.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const currentPath = parts.slice(0, i + 1).join('/');

            let child = current.children?.find(c => c.name === part);

            if (!child) {
                child = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'dir',
                    fileType: isFile ? file.fileType : undefined,
                    children: isFile ? undefined : [],
                    stats: isFile ? { items: file.items, methods: file.methods, types: file.types } : undefined,
                    status: isFile ? getFileStatus(file.path, sessionChanges) : undefined
                };
                current.children?.push(child);
            }

            current = child;
        }
    }

    // Sort: directories first, then alphabetically
    sortTree(root);
    return root;
}

function getFileStatus(filePath: string, changes: SessionChangeInfo): 'modified' | 'new' | 'unchanged' {
    if (changes.modified.has(filePath)) return 'modified';
    if (changes.new.has(filePath)) return 'new';
    return 'unchanged';
}

function sortTree(node: TreeNode) {
    if (node.children) {
        node.children.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        node.children.forEach(sortTree);
    }
}

async function getFileSignature(db: Database.Database, filePath: string): Promise<object> {
    const file = db.prepare(`SELECT id FROM files WHERE path = ?`).get(filePath) as { id: number } | undefined;

    if (!file) {
        return { error: 'File not found in index' };
    }

    const signature = db.prepare(`SELECT header_comments FROM signatures WHERE file_id = ?`).get(file.id) as { header_comments: string } | undefined;
    const methods = db.prepare(`
        SELECT prototype, line_number, visibility, is_static, is_async
        FROM methods WHERE file_id = ? ORDER BY line_number
    `).all(file.id) as Array<{ prototype: string; line_number: number; visibility: string; is_static: number; is_async: number }>;
    const types = db.prepare(`
        SELECT name, kind, line_number
        FROM types WHERE file_id = ? ORDER BY line_number
    `).all(file.id) as Array<{ name: string; kind: string; line_number: number }>;

    return {
        header: signature?.header_comments || null,
        methods: methods.map(m => ({
            prototype: m.prototype,
            line: m.line_number,
            visibility: m.visibility,
            static: !!m.is_static,
            async: !!m.is_async
        })),
        types: types.map(t => ({
            name: t.name,
            kind: t.kind,
            line: t.line_number
        }))
    };
}

/**
 * Get file content for the Code tab
 */
function getFileContent(projectRoot: string, filePath: string): { content: string; language: string } | { error: string } {
    const fullPath = path.join(projectRoot, filePath);

    if (!existsSync(fullPath)) {
        return { error: 'File not found' };
    }

    try {
        const content = readFileSync(fullPath, 'utf-8');
        const language = getLanguageFromExtension(filePath);
        return { content, language };
    } catch (err) {
        return { error: `Failed to read file: ${err}` };
    }
}

/**
 * Map file extension to highlight.js language identifier
 */
function getLanguageFromExtension(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.mjs': 'javascript',
        '.cjs': 'javascript',
        '.cs': 'csharp',
        '.rs': 'rust',
        '.py': 'python',
        '.pyw': 'python',
        '.c': 'c',
        '.h': 'c',
        '.cpp': 'cpp',
        '.cc': 'cpp',
        '.cxx': 'cpp',
        '.hpp': 'cpp',
        '.hxx': 'cpp',
        '.java': 'java',
        '.go': 'go',
        '.php': 'php',
        '.rb': 'ruby',
        '.rake': 'ruby',
        '.json': 'json',
        '.xml': 'xml',
        '.html': 'html',
        '.htm': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.less': 'less',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.md': 'markdown',
        '.sql': 'sql',
        '.sh': 'bash',
        '.bash': 'bash',
        '.bat': 'batch',
        '.ps1': 'powershell',
        '.toml': 'toml',
        '.ini': 'ini',
        '.cfg': 'ini'
    };
    return langMap[ext] || 'plaintext';
}

function getViewerHTML(projectPath: string): string {
    const projectName = path.basename(projectPath);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeGraph Viewer - ${projectName}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/styles/tokyo-night-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.0/highlight.min.js"></script>
    <style>
        :root {
            --bg-primary: #1a1b26;
            --bg-secondary: #24283b;
            --bg-tertiary: #414868;
            --text-primary: #c0caf5;
            --text-secondary: #a9b1d6;
            --text-muted: #565f89;
            --accent: #7aa2f7;
            --accent-green: #9ece6a;
            --accent-orange: #ff9e64;
            --accent-purple: #bb9af7;
            --accent-cyan: #7dcfff;
            --accent-yellow: #e0af68;
            --accent-red: #f7768e;
            --border: #3b4261;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        header {
            background: var(--bg-secondary);
            padding: 12px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 15px;
        }

        header h1 {
            font-size: 1.3em;
            color: var(--accent);
            font-weight: 500;
        }

        header .project-name {
            color: var(--accent-purple);
            font-weight: 600;
        }

        .container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        /* Splitter */
        .splitter {
            width: 6px;
            background: var(--bg-tertiary);
            cursor: col-resize;
            transition: background 0.2s;
            flex-shrink: 0;
        }

        .splitter:hover, .splitter.dragging {
            background: var(--accent);
        }

        /* Panel styles */
        .panel {
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .tree-panel {
            width: 350px;
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
        }

        .detail-panel {
            flex: 1;
        }

        /* Tab bar styles */
        .tab-bar {
            display: flex;
            background: var(--bg-tertiary);
            border-bottom: 1px solid var(--border);
        }

        .tab {
            padding: 10px 20px;
            cursor: pointer;
            color: var(--text-muted);
            border-bottom: 2px solid transparent;
            transition: all 0.2s;
        }

        .tab:hover {
            color: var(--text-secondary);
            background: rgba(122, 162, 247, 0.1);
        }

        .tab.active {
            color: var(--accent);
            border-bottom-color: var(--accent);
        }

        .panel-content {
            flex: 1;
            overflow-y: auto;
            padding: 10px 0;
        }

        .detail-panel .panel-content {
            padding: 20px;
        }

        /* Tree styles */
        .tree-node {
            padding: 6px 10px 6px 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 6px;
            white-space: nowrap;
        }

        .tree-node:hover {
            background: rgba(122, 162, 247, 0.1);
        }

        .tree-node.selected {
            background: rgba(122, 162, 247, 0.2);
        }

        .tree-node .status-icon {
            width: 16px;
            font-size: 11px;
            text-align: center;
            flex-shrink: 0;
        }

        .tree-node .status-icon.modified {
            color: var(--accent-orange);
        }

        .tree-node .status-icon.new {
            color: var(--accent-green);
        }

        .tree-node .status-icon.unchanged {
            color: var(--accent-green);
            opacity: 0.7;
        }

        .tree-node .icon {
            width: 18px;
            text-align: center;
            flex-shrink: 0;
        }

        .tree-node .name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .tree-node .stats {
            font-size: 0.75em;
            color: var(--text-muted);
            margin-left: auto;
            padding-right: 10px;
        }

        .tree-node.dir .icon { color: var(--accent-yellow); }
        .tree-node.file .icon { color: var(--accent-cyan); }
        .tree-node.file.config .icon { color: var(--accent-purple); }
        .tree-node.file.doc .icon { color: var(--accent-green); }
        .tree-node.file.test .icon { color: var(--accent-orange); }

        .tree-children {
            margin-left: 20px;
        }

        .tree-children.collapsed {
            display: none;
        }

        /* Detail panel styles */
        .detail-panel h2 {
            color: var(--accent-purple);
            font-size: 1.2em;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border);
        }

        .detail-panel .file-path {
            color: var(--text-muted);
            font-size: 0.9em;
            margin-bottom: 20px;
        }

        .section {
            margin-bottom: 25px;
        }

        .section h3 {
            color: var(--accent-cyan);
            font-size: 1em;
            margin-bottom: 10px;
        }

        .header-comment {
            background: var(--bg-secondary);
            padding: 15px;
            border-radius: 6px;
            font-family: 'Consolas', 'Fira Code', monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            color: var(--accent-green);
            border-left: 3px solid var(--accent-green);
        }

        .method-list, .type-list {
            list-style: none;
        }

        .method-list li, .type-list li {
            padding: 8px 12px;
            background: var(--bg-secondary);
            margin-bottom: 6px;
            border-radius: 4px;
            font-family: 'Consolas', monospace;
            font-size: 0.85em;
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .method-list .line-num, .type-list .line-num {
            color: var(--text-muted);
            font-size: 0.8em;
            min-width: 40px;
        }

        .method-list .visibility {
            color: var(--accent-purple);
            font-size: 0.75em;
            padding: 2px 6px;
            background: rgba(187, 154, 247, 0.15);
            border-radius: 3px;
        }

        .method-list .modifier {
            color: var(--accent-orange);
            font-size: 0.75em;
        }

        .type-list .kind {
            color: var(--accent-yellow);
            font-size: 0.75em;
            padding: 2px 6px;
            background: rgba(224, 175, 104, 0.15);
            border-radius: 3px;
        }

        .empty-state {
            color: var(--text-muted);
            text-align: center;
            padding: 40px;
        }

        .loading {
            color: var(--text-muted);
            padding: 20px;
            text-align: center;
        }

        /* Code view styles */
        .code-view {
            background: var(--bg-secondary);
            border-radius: 6px;
            overflow: hidden;
        }

        .code-view pre {
            margin: 0;
            padding: 15px;
            overflow-x: auto;
            font-size: 0.85em;
            line-height: 1.5;
        }

        .code-view code {
            font-family: 'Consolas', 'Fira Code', monospace;
        }

        /* Override highlight.js background to match our theme */
        .hljs {
            background: var(--bg-secondary) !important;
        }
    </style>
</head>
<body>
    <header>
        <h1>CodeGraph Viewer</h1>
        <span class="project-name">${projectName}</span>
    </header>

    <div class="container">
        <div class="panel tree-panel" id="treePanel">
            <div class="tab-bar">
                <div class="tab active" data-tab="code">Code</div>
                <div class="tab" data-tab="all">All</div>
            </div>
            <div class="panel-content" id="tree">
                <div class="loading">Loading project tree...</div>
            </div>
        </div>
        <div class="splitter" id="splitter"></div>
        <div class="panel detail-panel">
            <div class="tab-bar">
                <div class="tab active" data-tab="overview">Overview</div>
                <div class="tab" data-tab="source">Code</div>
            </div>
            <div class="panel-content" id="detail">
                <div class="empty-state">
                    <p>Click on a file to view its signature</p>
                </div>
            </div>
        </div>
    </div>

    <script>
        const ws = new WebSocket('ws://localhost:${PORT}');
        let selectedNode = null;
        let currentFile = null;
        let currentTreeMode = 'code';
        let currentDetailTab = 'overview';
        let cachedSignature = null;
        let cachedContent = null;

        ws.onopen = () => {
            console.log('Connected to CodeGraph Viewer');
        };

        let cachedCodeTree = null;
        let cachedAllTree = null;

        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log('📨 Received:', msg.type, msg);

            if (msg.type === 'tree') {
                // Cache the tree for the mode
                if (msg.mode === 'code') cachedCodeTree = msg.data;
                else cachedAllTree = msg.data;
                renderTree(msg.data);
            } else if (msg.type === 'refresh') {
                // Live reload: update cached trees and re-render current mode
                console.log('🔄 Live reload triggered');
                cachedCodeTree = msg.codeTree;
                cachedAllTree = msg.allTree;
                const treeToRender = currentTreeMode === 'code' ? cachedCodeTree : cachedAllTree;
                if (treeToRender) renderTree(treeToRender);
            } else if (msg.type === 'signature') {
                cachedSignature = { file: msg.file, data: msg.data };
                if (currentDetailTab === 'overview') {
                    renderSignature(msg.file, msg.data);
                }
            } else if (msg.type === 'fileContent') {
                cachedContent = { file: msg.file, data: msg.data };
                if (currentDetailTab === 'source') {
                    renderFileContent(msg.file, msg.data);
                }
            }
        };

        // Tab switching - Tree panel
        document.querySelectorAll('.tree-panel .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tree-panel .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentTreeMode = tab.dataset.tab;
                document.getElementById('tree').innerHTML = '<div class="loading">Loading...</div>';
                ws.send(JSON.stringify({ type: 'getTree', mode: currentTreeMode }));
            });
        });

        // Tab switching - Detail panel
        document.querySelectorAll('.detail-panel .tab').forEach(tab => {
            tab.addEventListener('click', () => {
                if (!currentFile) return;

                document.querySelectorAll('.detail-panel .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentDetailTab = tab.dataset.tab;

                if (currentDetailTab === 'overview') {
                    if (cachedSignature && cachedSignature.file === currentFile) {
                        renderSignature(cachedSignature.file, cachedSignature.data);
                    } else {
                        ws.send(JSON.stringify({ type: 'getSignature', file: currentFile }));
                    }
                } else if (currentDetailTab === 'source') {
                    if (cachedContent && cachedContent.file === currentFile) {
                        renderFileContent(cachedContent.file, cachedContent.data);
                    } else {
                        document.getElementById('detail').innerHTML = '<div class="loading">Loading source...</div>';
                        ws.send(JSON.stringify({ type: 'getFileContent', file: currentFile }));
                    }
                }
            });
        });

        function renderTree(node, container = document.getElementById('tree'), depth = 0) {
            if (depth === 0) {
                container.innerHTML = '';
            }

            const div = document.createElement('div');
            div.className = 'tree-node ' + node.type + (node.fileType ? ' ' + node.fileType : '');
            div.style.paddingLeft = (depth * 20 + 10) + 'px';
            div.dataset.path = node.path;
            div.dataset.type = node.type;

            // Status icon (modified/new/unchanged)
            const statusIcon = document.createElement('span');
            statusIcon.className = 'status-icon';
            if (node.status === 'modified') {
                statusIcon.className += ' modified';
                statusIcon.textContent = '✏️';
                statusIcon.title = 'Modified in this session';
            } else if (node.status === 'new') {
                statusIcon.className += ' new';
                statusIcon.textContent = '➕';
                statusIcon.title = 'New in this session';
            } else if (node.status === 'unchanged') {
                statusIcon.className += ' unchanged';
                statusIcon.textContent = '✓';
                statusIcon.title = 'Unchanged';
            }
            div.appendChild(statusIcon);

            // File/folder icon
            const icon = document.createElement('span');
            icon.className = 'icon';
            if (node.type === 'dir') {
                icon.textContent = '📁';
            } else {
                // Different icons for different file types
                const iconMap = {
                    'code': '📄',
                    'config': '⚙️',
                    'doc': '📝',
                    'test': '🧪',
                    'asset': '🖼️',
                    'other': '📄'
                };
                icon.textContent = iconMap[node.fileType] || '📄';
            }

            const name = document.createElement('span');
            name.className = 'name';
            name.textContent = node.name;

            div.appendChild(icon);
            div.appendChild(name);

            if (node.stats && (node.stats.methods > 0 || node.stats.types > 0)) {
                const stats = document.createElement('span');
                stats.className = 'stats';
                stats.textContent = node.stats.methods + 'm ' + node.stats.types + 't';
                div.appendChild(stats);
            }

            div.onclick = (e) => {
                e.stopPropagation();

                if (node.type === 'dir') {
                    const children = div.nextElementSibling;
                    if (children && children.classList.contains('tree-children')) {
                        children.classList.toggle('collapsed');
                        icon.textContent = children.classList.contains('collapsed') ? '📁' : '📂';
                    }
                } else {
                    if (selectedNode) selectedNode.classList.remove('selected');
                    div.classList.add('selected');
                    selectedNode = div;
                    currentFile = node.path;
                    cachedSignature = null;
                    cachedContent = null;

                    // Reset to overview tab
                    currentDetailTab = 'overview';
                    document.querySelectorAll('.detail-panel .tab').forEach(t => t.classList.remove('active'));
                    document.querySelector('.detail-panel .tab[data-tab="overview"]').classList.add('active');

                    ws.send(JSON.stringify({ type: 'getSignature', file: node.path }));
                }
            };

            container.appendChild(div);

            if (node.children && node.children.length > 0) {
                const childContainer = document.createElement('div');
                childContainer.className = 'tree-children';
                container.appendChild(childContainer);

                for (const child of node.children) {
                    renderTree(child, childContainer, depth + 1);
                }
            }
        }

        function renderSignature(filePath, data) {
            const detail = document.getElementById('detail');

            if (data.error) {
                detail.innerHTML = '<div class="empty-state">' + data.error + '</div>';
                return;
            }

            let html = '<h2>' + filePath.split('/').pop() + '</h2>';
            html += '<div class="file-path">' + filePath + '</div>';

            if (data.header) {
                html += '<div class="section"><h3>Header Comments</h3>';
                html += '<div class="header-comment">' + escapeHtml(data.header) + '</div></div>';
            }

            if (data.types && data.types.length > 0) {
                html += '<div class="section"><h3>Types (' + data.types.length + ')</h3>';
                html += '<ul class="type-list">';
                for (const t of data.types) {
                    html += '<li><span class="line-num">:' + t.line + '</span>';
                    html += '<span class="kind">' + t.kind + '</span>';
                    html += '<span>' + escapeHtml(t.name) + '</span></li>';
                }
                html += '</ul></div>';
            }

            if (data.methods && data.methods.length > 0) {
                html += '<div class="section"><h3>Methods (' + data.methods.length + ')</h3>';
                html += '<ul class="method-list">';
                for (const m of data.methods) {
                    html += '<li><span class="line-num">:' + m.line + '</span>';
                    if (m.visibility) html += '<span class="visibility">' + m.visibility + '</span>';
                    if (m.static) html += '<span class="modifier">static</span>';
                    if (m.async) html += '<span class="modifier">async</span>';
                    html += '<span>' + escapeHtml(m.prototype) + '</span></li>';
                }
                html += '</ul></div>';
            }

            if (!data.header && (!data.types || data.types.length === 0) && (!data.methods || data.methods.length === 0)) {
                html += '<div class="empty-state">No signature data for this file</div>';
            }

            detail.innerHTML = html;
        }

        function renderFileContent(filePath, data) {
            const detail = document.getElementById('detail');

            if (data.error) {
                detail.innerHTML = '<div class="empty-state">' + data.error + '</div>';
                return;
            }

            let html = '<h2>' + filePath.split('/').pop() + '</h2>';
            html += '<div class="file-path">' + filePath + '</div>';
            html += '<div class="code-view"><pre><code class="language-' + data.language + '">' + escapeHtml(data.content) + '</code></pre></div>';

            detail.innerHTML = html;

            // Apply syntax highlighting
            detail.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // Splitter functionality
        const splitter = document.getElementById('splitter');
        const treePanel = document.getElementById('treePanel');
        let isDragging = false;

        splitter.addEventListener('mousedown', (e) => {
            isDragging = true;
            splitter.classList.add('dragging');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerRect = document.querySelector('.container').getBoundingClientRect();
            const newWidth = e.clientX - containerRect.left;
            if (newWidth >= 200 && newWidth <= 800) {
                treePanel.style.width = newWidth + 'px';
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                splitter.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            }
        });
    </script>
</body>
</html>`;
}
