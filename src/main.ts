/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {parseArguments} from './cli.js';
import {loadConfig} from './config.js';
import {saveLogsToFile} from './logger.js';
import {createServer} from './server.js';
import {runStdioTransport, startHttpTransport} from './transport/index.js';

// If moved update release-please config
// x-release-please-start-version
const VERSION = '0.10.1';
// x-release-please-end

/**
 * Main entry point for Chrome DevTools MCP Server
 *
 * Transport selection logic:
 * 1. --port flag or PORT env var triggers HTTP transport
 * 2. Default: STDIO for local development and Claude Desktop integration
 */
async function main(): Promise<void> {
  try {
    const args = parseArguments(VERSION);
    const config = loadConfig(args, VERSION);
    const logFile = config.logFile ? saveLogsToFile(config.logFile) : undefined;

    // Determine transport mode
    const shouldUseHttp = config.port || process.env.PORT;

    if (shouldUseHttp) {
      // HTTP transport for cloud deployment and web integration
      startHttpTransport(config, () => createServer(config, logFile));
    } else {
      // STDIO transport for local development and Claude Desktop
      const server = createServer(config, logFile);
      await runStdioTransport(server);
    }
  } catch (error) {
    console.error('Fatal error running Chrome DevTools MCP server:', error);
    process.exit(1);
  }
}

// Run the server
await main();
