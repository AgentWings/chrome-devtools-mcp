/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {logger} from '../logger.js';
import {StdioServerTransport} from '../third_party/index.js';
import type {McpServer} from '../third_party/index.js';

/**
 * Runs the MCP server using STDIO transport
 * Used for local development and CLI usage
 * @param {McpServer} server - MCP server instance to connect
 * @returns {Promise<void>}
 */
export async function runStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger('Chrome DevTools MCP Server connected via STDIO');
  logDisclaimers();
}

/**
 * Logs security disclaimers
 * @private
 */
function logDisclaimers(): void {
  console.error(
    `chrome-devtools-mcp exposes content of the browser instance to the MCP clients allowing them to inspect,
debug, and modify any data in the browser or DevTools.
Avoid sharing sensitive or personal information that you do not want to share with MCP clients.`,
  );
}
