/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {randomUUID} from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';

import type {Config} from '../config.js';
import {logger} from '../logger.js';
import {StreamableHTTPServerTransport} from '../third_party/index.js';
import type {McpServer} from '../third_party/index.js';

/** Session storage for HTTP connections */
interface Session {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

const sessions = new Map<string, Session>();

/**
 * Factory function for creating server instances
 * Each HTTP session gets its own server instance
 * @param {Function} createServer - Function that creates a new McpServer instance
 * @returns {McpServer} New server instance
 */
export type ServerFactory = () => McpServer;

/**
 * Starts the HTTP transport server
 * @param {Config} config - Server configuration
 * @param {ServerFactory} serverFactory - Function to create new server instances
 */
export function startHttpTransport(
  config: Config,
  serverFactory: ServerFactory,
): void {
  const httpServer = createServer();

  httpServer.on('request', async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    switch (url.pathname) {
      case '/mcp':
        await handleMcpRequest(req, res, serverFactory);
        break;
      case '/health':
        handleHealthCheck(res);
        break;
      default:
        handleNotFound(res);
    }
  });

  const port = config.port || 3000;
  const host = config.isProduction ? '0.0.0.0' : 'localhost';

  httpServer.listen(port, host, () => {
    logServerStart(config, port);
  });
}

/**
 * Handles MCP protocol requests
 * @param {IncomingMessage} req - HTTP request
 * @param {ServerResponse} res - HTTP response
 * @param {ServerFactory} serverFactory - Server factory function
 * @returns {Promise<void>}
 * @private
 */
async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  serverFactory: ServerFactory,
): Promise<void> {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      res.statusCode = 404;
      res.end('Session not found');
      return;
    }
    return await session.transport.handleRequest(req, res);
  }

  if (req.method === 'POST') {
    await createNewSession(req, res, serverFactory);
    return;
  }

  res.statusCode = 400;
  res.end('Invalid request');
}

/**
 * Creates a new MCP session for HTTP transport
 * @param {IncomingMessage} req - HTTP request
 * @param {ServerResponse} res - HTTP response
 * @param {ServerFactory} serverFactory - Server factory function
 * @returns {Promise<void>}
 * @private
 */
async function createNewSession(
  req: IncomingMessage,
  res: ServerResponse,
  serverFactory: ServerFactory,
): Promise<void> {
  const serverInstance = serverFactory();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: sessionId => {
      sessions.set(sessionId, {transport, server: serverInstance});
      logger(`New session created: ${sessionId}`);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
      logger(`Session closed: ${transport.sessionId}`);
    }
  };

  try {
    await serverInstance.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    logger(`HTTP connection error: ${error}`);
    res.statusCode = 500;
    res.end('Internal server error');
  }
}

/**
 * Handles health check endpoint
 * @param {ServerResponse} res - HTTP response
 * @private
 */
function handleHealthCheck(res: ServerResponse): void {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.end(
    JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    }),
  );
}

/**
 * Handles 404 Not Found responses
 * @param {ServerResponse} res - HTTP response
 * @private
 */
function handleNotFound(res: ServerResponse): void {
  res.writeHead(404, {'Content-Type': 'text/plain'});
  res.end('Not Found');
}

/**
 * Logs server startup information
 * @param {Config} config - Server configuration
 * @param {number} port - Server port
 * @private
 */
function logServerStart(config: Config, port: number): void {
  const displayUrl = config.isProduction
    ? `Port ${port}`
    : `http://localhost:${port}`;

  logger(`Chrome DevTools MCP Server listening on ${displayUrl}`);

  if (!config.isProduction) {
    console.error('\nPut this in your client config:');
    console.error(
      JSON.stringify(
        {
          mcpServers: {
            'chrome-devtools': {
              url: `http://localhost:${port}/mcp`,
            },
          },
        },
        null,
        2,
      ),
    );
    console.error('\nEndpoints:');
    console.error(`  - MCP: http://localhost:${port}/mcp`);
    console.error(`  - Health: http://localhost:${port}/health`);
  }
}
