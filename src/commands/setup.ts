/**
 * AiDex Setup - Auto-register as MCP server in AI clients
 *
 * Supports: Claude Code (via CLI), Claude Desktop, Cursor, Windsurf
 * Also installs CLAUDE.md instructions for Claude Code/Desktop.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir, platform } from 'os';
import { execSync } from 'child_process';

// ============================================================
// Types
// ============================================================

interface JsonClientInfo {
    type: 'json';
    name: string;
    configPath: string;
    detectDir: string;
}

interface CliClientInfo {
    type: 'cli';
    name: string;
    detectCmd: string;
    addCmd: string[];
    removeCmd: string[];
}

type ClientInfo = JsonClientInfo | CliClientInfo;

// ============================================================
// MCP Server Entry (for JSON-based clients)
// ============================================================

const AIDEX_MCP_ENTRY = {
    command: 'aidex',
    args: [] as string[]
};

// ============================================================
// CLAUDE.md Instructions Block
// ============================================================

const CLAUDE_MD_START = '<!-- AIDEX-START -->';
const CLAUDE_MD_END = '<!-- AIDEX-END -->';

const CLAUDE_MD_BLOCK = `${CLAUDE_MD_START}
## AiDex - Persistent Code Index (MCP Server)

AiDex provides fast, precise code search through a pre-built index. **Always prefer AiDex over Grep/Glob for code searches.**

### Auto-Init Rule

**At the start of every session, check if \`.aidex/\` exists in the project directory.**
- If \`.aidex/\` does NOT exist → **automatically run \`aidex_init\`** to create the index. Do not ask, just do it.
- If \`.aidex/\` exists → use AiDex tools for all code searches.

### When to Use AiDex (instead of Grep/Glob)

| Task | Do NOT use | Use instead |
|------|-----------|-------------|
| Find a function/class/variable | \`Grep pattern="name"\` | \`aidex_query term="name"\` |
| See all methods in a file | \`Read entire_file.cs\` | \`aidex_signature file="..."\` |
| Explore multiple files | Multiple Read calls | \`aidex_signatures pattern="src/**"\` |
| Project overview | Many Glob/Read calls | \`aidex_summary\` + \`aidex_tree\` |
| What changed recently? | \`git log\` + Read | \`aidex_query term="X" modified_since="2h"\` |

### Available Tools

| Tool | Purpose |
|------|---------|
| \`aidex_init\` | Index a project (creates \`.aidex/\`) |
| \`aidex_query\` | Search by term (exact/contains/starts_with) |
| \`aidex_signature\` | Get one file's classes + methods |
| \`aidex_signatures\` | Get signatures for multiple files (glob) |
| \`aidex_update\` | Re-index a single changed file |
| \`aidex_summary\` | Project overview with entry points |
| \`aidex_tree\` | File tree with statistics |
| \`aidex_files\` | List project files by type |
| \`aidex_session\` | Start session, detect external changes |
| \`aidex_note\` | Read/write session notes |
| \`aidex_viewer\` | Open interactive project tree in browser |

### Why AiDex over Grep?

- **~50 tokens** per search vs 2000+ with Grep
- **Identifiers only** - no noise from comments/strings
- **Persistent** - index survives between sessions
- **Structure-aware** - knows methods, classes, types
${CLAUDE_MD_END}`;

// ============================================================
// Client Detection
// ============================================================

function getClients(): ClientInfo[] {
    const home = homedir();
    const plat = platform();
    const clients: ClientInfo[] = [];

    // Claude Code - uses its own CLI for MCP management
    clients.push({
        type: 'cli',
        name: 'Claude Code',
        detectCmd: 'claude --version',
        addCmd: ['claude', 'mcp', 'add', '--scope', 'user', 'aidex', '--', 'aidex'],
        removeCmd: ['claude', 'mcp', 'remove', '--scope', 'user', 'aidex']
    });

    // Claude Desktop - JSON config
    if (plat === 'win32') {
        const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
        clients.push({
            type: 'json',
            name: 'Claude Desktop',
            configPath: join(appData, 'Claude', 'claude_desktop_config.json'),
            detectDir: join(appData, 'Claude')
        });
    } else if (plat === 'darwin') {
        clients.push({
            type: 'json',
            name: 'Claude Desktop',
            configPath: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
            detectDir: join(home, 'Library', 'Application Support', 'Claude')
        });
    } else {
        clients.push({
            type: 'json',
            name: 'Claude Desktop',
            configPath: join(home, '.config', 'Claude', 'claude_desktop_config.json'),
            detectDir: join(home, '.config', 'Claude')
        });
    }

    // Cursor - JSON config
    clients.push({
        type: 'json',
        name: 'Cursor',
        configPath: join(home, '.cursor', 'mcp.json'),
        detectDir: join(home, '.cursor')
    });

    // Windsurf - JSON config
    clients.push({
        type: 'json',
        name: 'Windsurf',
        configPath: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        detectDir: join(home, '.codeium', 'windsurf')
    });

    return clients;
}

// ============================================================
// CLI helpers
// ============================================================

function isCmdAvailable(cmd: string): boolean {
    try {
        execSync(cmd, { stdio: 'pipe', timeout: 5000 });
        return true;
    } catch {
        return false;
    }
}

function runCmd(args: string[]): { success: boolean; output?: string; error?: string } {
    try {
        const output = execSync(args.join(' '), { stdio: 'pipe', timeout: 10000 }).toString().trim();
        return { success: true, output };
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { success: false, error: msg };
    }
}

// ============================================================
// JSON Config Read/Write
// ============================================================

function readJsonConfig(filePath: string): { success: boolean; data?: Record<string, unknown>; error?: string } {
    try {
        const content = readFileSync(filePath, 'utf8');
        return { success: true, data: JSON.parse(content) };
    } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return { success: false, error: 'not found' };
        }
        if (err instanceof SyntaxError) {
            return { success: false, error: `invalid JSON: ${err.message}` };
        }
        return { success: false, error: String(err) };
    }
}

function writeJsonConfig(filePath: string, data: Record<string, unknown>): { success: boolean; error?: string } {
    try {
        const content = JSON.stringify(data, null, 2) + '\n';
        writeFileSync(filePath, content, 'utf8');
        return { success: true };
    } catch (err: unknown) {
        return { success: false, error: String(err) };
    }
}

// ============================================================
// CLAUDE.md Management
// ============================================================

function getClaudeMdPath(): string {
    return join(homedir(), '.claude', 'CLAUDE.md');
}

function installClaudeMd(): { success: boolean; action: string } {
    const mdPath = getClaudeMdPath();
    const dir = dirname(mdPath);

    // Ensure directory exists
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }

    let content = '';
    if (existsSync(mdPath)) {
        content = readFileSync(mdPath, 'utf8');

        // Already has AiDex block? Replace it
        if (content.includes(CLAUDE_MD_START)) {
            const regex = new RegExp(`${CLAUDE_MD_START}[\\s\\S]*?${CLAUDE_MD_END}`, 'g');
            content = content.replace(regex, CLAUDE_MD_BLOCK);
            writeFileSync(mdPath, content, 'utf8');
            return { success: true, action: 'updated' };
        }

        // Append to existing file
        content = content.trimEnd() + '\n\n' + CLAUDE_MD_BLOCK + '\n';
        writeFileSync(mdPath, content, 'utf8');
        return { success: true, action: 'appended' };
    }

    // Create new file
    writeFileSync(mdPath, CLAUDE_MD_BLOCK + '\n', 'utf8');
    return { success: true, action: 'created' };
}

function uninstallClaudeMd(): { success: boolean; removed: boolean } {
    const mdPath = getClaudeMdPath();

    if (!existsSync(mdPath)) {
        return { success: true, removed: false };
    }

    let content = readFileSync(mdPath, 'utf8');

    if (!content.includes(CLAUDE_MD_START)) {
        return { success: true, removed: false };
    }

    const regex = new RegExp(`\\n?\\n?${CLAUDE_MD_START}[\\s\\S]*?${CLAUDE_MD_END}\\n?`, 'g');
    content = content.replace(regex, '').trim();

    if (content.length === 0) {
        // File would be empty, but don't delete it - might have been user-created
        writeFileSync(mdPath, '', 'utf8');
    } else {
        writeFileSync(mdPath, content + '\n', 'utf8');
    }

    return { success: true, removed: true };
}

// ============================================================
// Setup
// ============================================================

function setupCliClient(client: CliClientInfo): { status: string; registered: boolean } {
    if (!isCmdAvailable(client.detectCmd)) {
        return { status: `  - ${client.name} (not installed)`, registered: false };
    }

    const result = runCmd(client.addCmd);
    if (result.success) {
        return { status: `  ✓ ${client.name}`, registered: true };
    }

    // "already exists" is not an error
    if (result.error && result.error.includes('already exists')) {
        return { status: `  ✓ ${client.name} (already registered)`, registered: true };
    }

    return { status: `  ✗ ${client.name} (${result.error})`, registered: false };
}

function setupJsonClient(client: JsonClientInfo): { status: string; registered: boolean } {
    if (!existsSync(client.detectDir)) {
        return { status: `  - ${client.name} (not installed)`, registered: false };
    }

    let data: Record<string, unknown>;
    if (existsSync(client.configPath)) {
        const config = readJsonConfig(client.configPath);
        if (!config.success || !config.data) {
            return { status: `  ✗ ${client.name} (${config.error})`, registered: false };
        }
        data = config.data;
    } else {
        data = {};
    }

    if (!data.mcpServers || typeof data.mcpServers !== 'object') {
        data.mcpServers = {};
    }
    (data.mcpServers as Record<string, unknown>).aidex = { ...AIDEX_MCP_ENTRY };

    const writeResult = writeJsonConfig(client.configPath, data);
    if (!writeResult.success) {
        return { status: `  ✗ ${client.name} (${writeResult.error})`, registered: false };
    }

    return { status: `  ✓ ${client.name} (${client.configPath})`, registered: true };
}

export function setupMcpClients(): void {
    const clients = getClients();
    let registered = 0;

    console.log('\nAiDex MCP Server Registration');
    console.log('==============================\n');

    // Register with AI clients
    console.log('  MCP Servers:');
    for (const client of clients) {
        const result = client.type === 'cli'
            ? setupCliClient(client)
            : setupJsonClient(client);

        console.log(result.status);
        if (result.registered) registered++;
    }

    // Install CLAUDE.md instructions
    console.log('\n  AI Instructions:');
    const mdResult = installClaudeMd();
    const mdPath = getClaudeMdPath();
    if (mdResult.success) {
        console.log(`  ✓ CLAUDE.md (${mdResult.action}: ${mdPath})`);
    }

    console.log(`\nRegistered AiDex with ${registered} client(s).\n`);

    if (registered > 0) {
        console.log('Restart your AI client(s) to activate AiDex.\n');
    }
}

// ============================================================
// Unsetup
// ============================================================

function unsetupCliClient(client: CliClientInfo): { status: string; removed: boolean } {
    if (!isCmdAvailable(client.detectCmd)) {
        return { status: `  - ${client.name} (not installed)`, removed: false };
    }

    const result = runCmd(client.removeCmd);
    if (result.success) {
        return { status: `  ✓ Removed from ${client.name}`, removed: true };
    } else {
        return { status: `  - ${client.name} (not registered)`, removed: false };
    }
}

function unsetupJsonClient(client: JsonClientInfo): { status: string; removed: boolean } {
    if (!existsSync(client.detectDir)) {
        return { status: `  - ${client.name} (not installed)`, removed: false };
    }

    if (!existsSync(client.configPath)) {
        return { status: `  - ${client.name} (not registered)`, removed: false };
    }

    const config = readJsonConfig(client.configPath);
    if (!config.success || !config.data) {
        return { status: `  ✗ ${client.name} (${config.error})`, removed: false };
    }

    const data = config.data as Record<string, unknown>;
    const servers = data.mcpServers as Record<string, unknown> | undefined;

    if (!servers || !servers.aidex) {
        return { status: `  - ${client.name} (not registered)`, removed: false };
    }

    delete servers.aidex;

    const writeResult = writeJsonConfig(client.configPath, data);
    if (!writeResult.success) {
        return { status: `  ✗ ${client.name} (${writeResult.error})`, removed: false };
    }

    return { status: `  ✓ Removed from ${client.name}`, removed: true };
}

export function unsetupMcpClients(): void {
    const clients = getClients();
    let removed = 0;

    console.log('\nAiDex MCP Server Unregistration');
    console.log('================================\n');

    // Unregister from AI clients
    console.log('  MCP Servers:');
    for (const client of clients) {
        const result = client.type === 'cli'
            ? unsetupCliClient(client)
            : unsetupJsonClient(client);

        console.log(result.status);
        if (result.removed) removed++;
    }

    // Remove CLAUDE.md instructions
    console.log('\n  AI Instructions:');
    const mdResult = uninstallClaudeMd();
    if (mdResult.removed) {
        console.log(`  ✓ Removed AiDex block from CLAUDE.md`);
    } else {
        console.log(`  - CLAUDE.md (no AiDex block found)`);
    }

    console.log(`\nUnregistered AiDex from ${removed} client(s).\n`);
}
