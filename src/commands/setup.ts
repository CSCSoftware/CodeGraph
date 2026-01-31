/**
 * AiDex Setup - Auto-register as MCP server in AI clients
 *
 * Supports: Claude Code (via CLI), Claude Desktop, Cursor, Windsurf
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
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
// Setup
// ============================================================

function setupCliClient(client: CliClientInfo): { status: string; registered: boolean } {
    if (!isCmdAvailable(client.detectCmd)) {
        return { status: `  - ${client.name} (not installed)`, registered: false };
    }

    const result = runCmd(client.addCmd);
    if (result.success) {
        return { status: `  ✓ ${client.name}`, registered: true };
    } else {
        return { status: `  ✗ ${client.name} (${result.error})`, registered: false };
    }
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

    for (const client of clients) {
        const result = client.type === 'cli'
            ? setupCliClient(client)
            : setupJsonClient(client);

        console.log(result.status);
        if (result.registered) registered++;
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

    for (const client of clients) {
        const result = client.type === 'cli'
            ? unsetupCliClient(client)
            : unsetupJsonClient(client);

        console.log(result.status);
        if (result.removed) removed++;
    }

    console.log(`\nUnregistered AiDex from ${removed} client(s).\n`);
}
