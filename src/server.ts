/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {WriteStream} from 'node:fs';

import type {Channel} from './browser.js';
import {ensureBrowserConnected, ensureBrowserLaunched} from './browser.js';
import type {Config} from './config.js';
import {logger} from './logger.js';
import {McpContext} from './McpContext.js';
import {McpResponse} from './McpResponse.js';
import {Mutex} from './Mutex.js';
import {
  McpServer,
  type CallToolResult,
  SetLevelRequestSchema,
} from './third_party/index.js';
import {ToolCategory} from './tools/categories.js';
import * as consoleTools from './tools/console.js';
import * as emulationTools from './tools/emulation.js';
import * as inputTools from './tools/input.js';
import * as networkTools from './tools/network.js';
import * as pagesTools from './tools/pages.js';
import * as performanceTools from './tools/performance.js';
import * as screenshotTools from './tools/screenshot.js';
import * as scriptTools from './tools/script.js';
import * as snapshotTools from './tools/snapshot.js';
import type {ToolDefinition} from './tools/ToolDefinition.js';

/**
 * Creates a new MCP server instance
 * @param {Config} config - Server configuration
 * @param {WriteStream} logFile - Optional log file stream
 * @returns {McpServer} Configured MCP server instance
 */
export function createServer(config: Config, logFile?: WriteStream): McpServer {
  const server = new McpServer(
    {
      name: 'chrome_devtools',
      title: 'Chrome DevTools MCP server',
      version: config.version,
    },
    {capabilities: {logging: {}}},
  );

  server.server.setRequestHandler(SetLevelRequestSchema, () => {
    return {};
  });

  let context: McpContext;
  const toolMutex = new Mutex();

  async function getContext(): Promise<McpContext> {
    const extraArgs: string[] = (config.chromeArg ?? []).map(String);
    if (config.proxyServer) {
      extraArgs.push(`--proxy-server=${config.proxyServer}`);
    }
    const devtools = config.experimentalDevtools ?? false;
    const browser =
      config.browserUrl || config.wsEndpoint
        ? await ensureBrowserConnected({
            browserURL: config.browserUrl,
            wsEndpoint: config.wsEndpoint,
            wsHeaders: config.wsHeaders,
            devtools,
          })
        : await ensureBrowserLaunched({
            headless: config.headless,
            executablePath: config.executablePath,
            channel: config.channel as Channel,
            isolated: config.isolated,
            logFile,
            viewport: config.viewport,
            args: extraArgs,
            acceptInsecureCerts: config.acceptInsecureCerts,
            devtools,
          });

    if (context?.browser !== browser) {
      context = await McpContext.from(browser, logger, {
        experimentalDevToolsDebugging: devtools,
        experimentalIncludeAllPages: config.experimentalIncludeAllPages,
      });
    }
    return context;
  }

  function registerTool(tool: ToolDefinition): void {
    if (
      tool.annotations.category === ToolCategory.EMULATION &&
      config.categoryEmulation === false
    ) {
      return;
    }
    if (
      tool.annotations.category === ToolCategory.PERFORMANCE &&
      config.categoryPerformance === false
    ) {
      return;
    }
    if (
      tool.annotations.category === ToolCategory.NETWORK &&
      config.categoryNetwork === false
    ) {
      return;
    }
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.schema,
        annotations: tool.annotations,
      },
      async (params): Promise<CallToolResult> => {
        const guard = await toolMutex.acquire();
        try {
          logger(`${tool.name} request: ${JSON.stringify(params, null, '  ')}`);
          const context = await getContext();
          logger(`${tool.name} context: resolved`);
          await context.detectOpenDevToolsWindows();
          const response = new McpResponse();
          await tool.handler(
            {
              params,
            },
            response,
            context,
          );
          try {
            const content = await response.handle(tool.name, context);
            return {
              content,
            };
          } catch (error) {
            const errorText =
              error instanceof Error ? error.message : String(error);

            return {
              content: [
                {
                  type: 'text',
                  text: errorText,
                },
              ],
              isError: true,
            };
          }
        } catch (err) {
          const error = err as Error;
          logger(`${tool.name} error: ${error.message}`);
          throw err;
        } finally {
          guard.dispose();
        }
      },
    );
  }

  const tools = [
    ...Object.values(consoleTools),
    ...Object.values(emulationTools),
    ...Object.values(inputTools),
    ...Object.values(networkTools),
    ...Object.values(pagesTools),
    ...Object.values(performanceTools),
    ...Object.values(screenshotTools),
    ...Object.values(scriptTools),
    ...Object.values(snapshotTools),
  ] as ToolDefinition[];

  tools.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  for (const tool of tools) {
    registerTool(tool);
  }

  return server;
}
