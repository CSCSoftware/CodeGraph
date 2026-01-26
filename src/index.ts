/**
 * CodeGraph - MCP Server Entry Point
 *
 * Provides persistent code indexing for Claude Code.
 *
 * Usage:
 *   node build/index.js              - Start MCP server (default)
 *   node build/index.js scan <path>  - Scan for .codegraph directories
 */

import { createServer } from './server/mcp-server.js';
import { scan } from './commands/index.js';

async function main() {
    const args = process.argv.slice(2);

    // CLI mode: scan
    if (args[0] === 'scan') {
        const searchPath = args[1];
        if (!searchPath) {
            console.error('Usage: codegraph scan <path>');
            process.exit(1);
        }

        const result = scan({ path: searchPath });

        if (!result.success) {
            console.error(`Error: ${result.error}`);
            process.exit(1);
        }

        console.log(`\nCodeGraph Indexes Found: ${result.projects.length}`);
        console.log(`Scanned: ${result.scannedDirs} directories\n`);

        if (result.projects.length === 0) {
            console.log('No indexed projects found.');
        } else {
            for (const proj of result.projects) {
                console.log(`${proj.name}`);
                console.log(`  Path: ${proj.path}`);
                console.log(`  Files: ${proj.files} | Items: ${proj.items} | Methods: ${proj.methods} | Types: ${proj.types}`);
                console.log(`  Last indexed: ${proj.lastIndexed}`);
                console.log();
            }
        }

        return;
    }

    // Default: Start MCP server
    const server = createServer();
    await server.start();
}

main().catch((error) => {
    console.error('Failed to start CodeGraph:', error);
    process.exit(1);
});
