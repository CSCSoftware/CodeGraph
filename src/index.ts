/**
 * CodeGraph - MCP Server Entry Point
 *
 * Provides persistent code indexing for Claude Code.
 */

import { createServer } from './server/mcp-server.js';

async function main() {
    const server = createServer();
    await server.start();
}

main().catch((error) => {
    console.error('Failed to start CodeGraph server:', error);
    process.exit(1);
});
