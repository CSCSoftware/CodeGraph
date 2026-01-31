/**
 * AiDex Setup - Auto-register as MCP server in AI clients
 *
 * Supports: Claude Code, Claude Desktop, Cursor, Windsurf
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

// ============================================================
// Types
// ============================================================

interface ClientInfo {
    name: string;
    configPath: string;
    detectDir: string;  // directory that indicates the client is installed
}

interface SetupResult {
    client: string;
    status: 'registered' | 'removed' | 'skipped' | 'error';
    configPath: string;
    message?: string;
}

// ============================================================
// MCP Server Entry
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

    // Claude Code
    clients.push({
        name: 'Claude Code',
        configPath: join(home, '.claude', 'settings.json'),
        detectDir: join(home, '.claude')
    });

    // Claude Desktop
    if (plat === 'win32') {
        const appData = process.env.APPDATA || join(home, 'AppData', 'Roaming');
        clients.push({
            name: 'Claude Desktop',
            configPath: join(appData, 'Claude', 'claude_desktop_config.json'),
            detectDir: join(appData, 'Claude')
        });
    } else if (plat === 'darwin') {
        clients.push({
            name: 'Claude Desktop',
            configPath: join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
            detectDir: join(home, 'Library', 'Application Support', 'Claude')
        });
    } else {
        clients.push({
            name: 'Claude Desktop',
            configPath: join(home, '.config', 'Claude', 'claude_desktop_config.json'),
            detectDir: join(home, '.config', 'Claude')
        });
    }

    // Cursor
    clients.push({
        name: 'Cursor',
        configPath: join(home, '.cursor', 'mcp.json'),
        detectDir: join(home, '.cursor')
    });

    // Windsurf
    clients.push({
        name: 'Windsurf',
        configPath: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
        detectDir: join(home, '.codeium', 'windsurf')
    });

    return clients;
}

// ============================================================
// Config Read/Write
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
// Setup / Unsetup
// ============================================================

export function setupMcpClients(): void {
    const clients = getClients();
    const results: SetupResult[] = [];
    let registered = 0;

    console.log('\nAiDex MCP Server Registration');
    console.log('==============================\n');

    for (const client of clients) {
        // Check if client is installed (detect directory exists)
        if (!existsSync(client.detectDir)) {
            results.push({ client: client.name, status: 'skipped', configPath: client.configPath });
            console.log(`  - ${client.name} (not installed)`);
            continue;
        }

        // Read existing config or start with empty object
        let data: Record<string, unknown>;
        if (existsSync(client.configPath)) {
            const config = readJsonConfig(client.configPath);
            if (!config.success || !config.data) {
                results.push({ client: client.name, status: 'error', configPath: client.configPath, message: config.error });
                console.log(`  ✗ ${client.name} (${config.error})`);
                continue;
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
            results.push({ client: client.name, status: 'error', configPath: client.configPath, message: writeResult.error });
            console.log(`  ✗ ${client.name} (${writeResult.error})`);
            continue;
        }

        registered++;
        results.push({ client: client.name, status: 'registered', configPath: client.configPath });
        console.log(`  ✓ ${client.name} (${client.configPath})`);
    }

    console.log(`\nRegistered AiDex with ${registered} client(s).\n`);

    if (registered > 0) {
        console.log('Restart your AI client(s) to activate AiDex.\n');
    }
}

export function unsetupMcpClients(): void {
    const clients = getClients();
    let removed = 0;

    console.log('\nAiDex MCP Server Unregistration');
    console.log('================================\n');

    for (const client of clients) {
        if (!existsSync(client.configPath)) {
            console.log(`  - ${client.name} (not installed)`);
            continue;
        }

        const config = readJsonConfig(client.configPath);
        if (!config.success || !config.data) {
            console.log(`  ✗ ${client.name} (${config.error})`);
            continue;
        }

        const data = config.data as Record<string, unknown>;
        const servers = data.mcpServers as Record<string, unknown> | undefined;

        if (!servers || !servers.aidex) {
            console.log(`  - ${client.name} (not registered)`);
            continue;
        }

        delete servers.aidex;

        const writeResult = writeJsonConfig(client.configPath, data);
        if (!writeResult.success) {
            console.log(`  ✗ ${client.name} (${writeResult.error})`);
            continue;
        }

        removed++;
        console.log(`  ✓ Removed from ${client.name}`);
    }

    console.log(`\nUnregistered AiDex from ${removed} client(s).\n`);
}
