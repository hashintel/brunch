import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { createRpcHandlers } from './handlers.js';
import { createProductUpdatePublisher, type ProductUpdatePublisher } from './product-updates.js';
import { attachWebRpcTransport } from './websocket.js';

export interface WebHostOptions {
  cwd: string;
  port?: number;
  hostname?: string;
  coordinator?: WorkspaceSessionCoordinator;
  webAssetRoot?: string;
  productUpdates?: ProductUpdatePublisher;
}

export interface RunningWebHost {
  url: string;
  close(): Promise<void>;
}

const MISSING_WEB_BUNDLE_MESSAGE =
  'Brunch web bundle is missing. Run npm run build:web before starting web mode.';

export async function startWebHost(options: WebHostOptions): Promise<RunningWebHost> {
  void options.cwd;
  const webAssetRoot = options.webAssetRoot ?? defaultWebAssetRoot();
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/') {
      void readFile(resolve(webAssetRoot, 'index.html')).then(
        (asset) => {
          response.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store',
          });
          response.end(asset);
        },
        () => {
          response.writeHead(500, {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-store',
          });
          response.end(MISSING_WEB_BUNDLE_MESSAGE);
        },
      );
      return;
    }

    if (request.method === 'GET' && request.url?.startsWith('/assets/')) {
      const assetPath = resolveAssetRequest(webAssetRoot, request.url);
      if (!assetPath) {
        response.writeHead(404, {
          'content-type': 'text/plain; charset=utf-8',
        });
        response.end('Not found');
        return;
      }

      void readFile(assetPath.file).then(
        (asset) => {
          response.writeHead(200, {
            'content-type': contentTypeForAsset(assetPath.relativePath),
            'cache-control': 'no-store',
          });
          response.end(asset);
        },
        () => {
          response.writeHead(404, {
            'content-type': 'text/plain; charset=utf-8',
          });
          response.end('Not found');
        },
      );
      return;
    }

    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
  });
  let rpcTransport: ReturnType<typeof attachWebRpcTransport> | null = null;
  if (options.coordinator) {
    const productUpdates = options.productUpdates ?? createProductUpdatePublisher();
    rpcTransport = attachWebRpcTransport({
      server,
      path: '/rpc',
      handlers: createRpcHandlers({
        coordinator: options.coordinator,
        cwd: options.cwd,
        productUpdates,
      }),
      productUpdates,
    });
  }

  const hostname = options.hostname ?? '127.0.0.1';
  await listen(server, options.port ?? 0, hostname);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected Brunch web host to listen on a TCP address');
  }

  return {
    url: `http://${hostname}:${address.port}`,
    async close() {
      await rpcTransport?.close();
      await close(server);
    },
  };
}

function defaultWebAssetRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist-web');
}

interface ResolvedAssetRequest {
  file: string;
  relativePath: string;
}

function resolveAssetRequest(webAssetRoot: string, requestUrl: string): ResolvedAssetRequest | null {
  let pathname: string;
  try {
    pathname = new URL(requestUrl, 'http://brunch.local').pathname;
  } catch {
    return null;
  }

  let suffix: string;
  try {
    suffix = decodeURIComponent(pathname.slice('/assets/'.length));
  } catch {
    return null;
  }

  if (suffix.length === 0 || suffix.startsWith('/') || /^[a-zA-Z]:/u.test(suffix)) {
    return null;
  }

  const assetRoot = resolve(webAssetRoot, 'assets');
  const file = resolve(assetRoot, suffix);
  if (file !== assetRoot && !file.startsWith(`${assetRoot}${sep}`)) {
    return null;
  }

  return { file, relativePath: `assets/${suffix}` };
}

function contentTypeForAsset(relativePath: string): string {
  if (relativePath.endsWith('.js')) {
    return 'text/javascript; charset=utf-8';
  }
  if (relativePath.endsWith('.css')) {
    return 'text/css; charset=utf-8';
  }
  return 'application/octet-stream';
}

function listen(server: Server, port: number, hostname: string): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, hostname, () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}
