/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Channel} from './browser.js';

/**
 * Configuration interface for Chrome DevTools MCP Server
 * @interface Config
 */
export interface Config {
  // Browser connection options
  browserUrl?: string;
  wsEndpoint?: string;
  wsHeaders?: Record<string, string>;

  // Browser launch options
  headless: boolean;
  executablePath?: string;
  channel?: Channel;
  isolated: boolean;
  viewport?: {width: number; height: number};
  chromeArg?: string[];
  proxyServer?: string;
  acceptInsecureCerts?: boolean;

  // Server options
  port?: number;
  version: string;
  logFile?: string;

  // Feature flags
  experimentalDevtools?: boolean;
  experimentalIncludeAllPages?: boolean;

  // Tool categories
  categoryEmulation: boolean;
  categoryPerformance: boolean;
  categoryNetwork: boolean;

  // Environment
  nodeEnv: 'development' | 'production';
  isProduction: boolean;
}

/**
 * Loads configuration from parsed CLI arguments
 * @param {Record<string, unknown>} args - Parsed CLI arguments from yargs
 * @param {string} version - Server version
 * @returns {Config} Configuration object
 */
export function loadConfig(
  args: Record<string, unknown>,
  version: string,
): Config {
  const nodeEnv =
    process.env.NODE_ENV === 'production' ? 'production' : 'development';

  return {
    // Browser connection
    browserUrl: args.browserUrl,
    wsEndpoint: args.wsEndpoint,
    wsHeaders: args.wsHeaders,

    // Browser launch
    headless: args.headless ?? false,
    executablePath: args.executablePath,
    channel: args.channel as Channel | undefined,
    isolated: args.isolated ?? false,
    viewport: args.viewport,
    chromeArg: args.chromeArg,
    proxyServer: args.proxyServer,
    acceptInsecureCerts: args.acceptInsecureCerts,

    // Server
    port: args.port ? parseInt(args.port, 10) : undefined,
    version,
    logFile: args.logFile,

    // Feature flags
    experimentalDevtools: args.experimentalDevtools ?? false,
    experimentalIncludeAllPages: args.experimentalIncludeAllPages ?? false,

    // Tool categories
    categoryEmulation: args.categoryEmulation !== false,
    categoryPerformance: args.categoryPerformance !== false,
    categoryNetwork: args.categoryNetwork !== false,

    // Environment
    nodeEnv,
    isProduction: nodeEnv === 'production',
  };
}
