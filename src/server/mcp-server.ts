/**
 * MCP Server implementation for AiDex
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { registerTools, handleToolCall } from './tools.js';
import { PRODUCT_NAME, PRODUCT_NAME_LOWER, PRODUCT_VERSION } from '../constants.js';

export function createServer() {
    const server = new Server(
        {
            name: PRODUCT_NAME_LOWER,
            version: PRODUCT_VERSION,
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
            console.error(`${PRODUCT_NAME} MCP server started`);
        },
    };
}
