import { existsSync } from 'node:fs';
import type { Server } from 'node:http';
import { join } from 'node:path';

import type { Express } from 'express';

import { resolveBrunchProject } from './project.js';

const DEFAULT_BACKEND_PORT = 3000;

function normalizeConfiguredValue(value: string | undefined): string | null {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}

export function loadLocalEnvFile(cwd: string): void {
  const envFilePath = join(cwd, '.env');
  if (!existsSync(envFilePath)) {
    return;
  }

  process.loadEnvFile(envFilePath);
}

function parsePort(value: string, source: 'BRUNCH_PORT' | 'PORT'): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error(`Invalid ${source} value: ${value}`);
  }

  return port;
}

export function resolveConfiguredDbPath(configuredPath: string | undefined, cwd: string): string {
  const normalizedPath = configuredPath?.trim();
  return normalizedPath ? normalizedPath : resolveBrunchProject(cwd).dbPath;
}

export function resolveBackendPort(
  env: NodeJS.ProcessEnv = process.env,
  defaultPort: number = DEFAULT_BACKEND_PORT,
): number {
  const configuredPort = normalizeConfiguredValue(env.BRUNCH_PORT);
  if (configuredPort) {
    return parsePort(configuredPort, 'BRUNCH_PORT');
  }

  const fallbackPort = normalizeConfiguredValue(env.PORT);
  if (fallbackPort) {
    return parsePort(fallbackPort, 'PORT');
  }

  return defaultPort;
}

export function getBackendProxyTarget(
  env: NodeJS.ProcessEnv = process.env,
  defaultPort: number = DEFAULT_BACKEND_PORT,
): string {
  return `http://localhost:${resolveBackendPort(env, defaultPort)}`;
}

export async function listenOnLocalhost(
  app: Express,
  port: number,
): Promise<{ server: Server; port: number; url: string }> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const handleError = (error: Error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    const server = app.listen(port, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => {
          handleError(new Error('Failed to determine the bound server port'));
        });
        return;
      }

      server.off('error', handleError);
      if (!settled) {
        settled = true;
        resolve({ server, port: address.port, url: `http://localhost:${address.port}` });
      }
    });

    server.once('error', handleError);
  });
}

export async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}
