/**
 * MCP Server implementation for CodeGraph
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { registerTools, handleToolCall } from './tools.js';

export function createServer() {
    const server = new Server(
        {
            name: 'codegraph',
            version: '0.1.0',
        },
        {
            capabilities: {
                tools: {},
            },
        }
    );

    // Register tool list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: registerTools(),
        };
    });

    // Register tool call handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        return handleToolCall(request.params.name, request.params.arguments ?? {});
    });

    return {
        async start() {
            const transport = new StdioServerTransport();
            await server.connect(transport);
            console.error('CodeGraph MCP server started');
        },
    };
}
