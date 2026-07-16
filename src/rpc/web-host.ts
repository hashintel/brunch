import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRunDetail, petrinautStreamPathForRun } from '../executor/observer-read.js';
import { composePetrinautLauncherUrl, resolvePetrinautUrl } from '../executor/petrinaut/launcher-url.js';
import type { WorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import {
  assertExclusiveWebHostOptions,
  createReadOnlyRpcHandlers,
  createWebSidecarRpcHandlers,
  type WebHostAuthorityOptions,
} from './handlers.js';
import { createProductUpdatePublisher, type ProductUpdatePublisher } from './product-updates.js';
import { createPetrinautStreamHost, petrinautStreamRunId } from './web-host/petrinaut-stream.js';
import type { WebSessionEventSource } from './websocket.js';
import { attachWebRpcTransport, isWebRpcUpgradeHandled, type WebRpcTransport } from './websocket.js';

type WebHostBaseOptions = {
  cwd: string;
  port?: number;
  hostname?: string;
  coordinator?: WorkspaceSessionCoordinator;
  webAssetRoot?: string;
  productUpdates?: ProductUpdatePublisher;
  sessionEvents?: WebSessionEventSource;
};

export type WebHostOptions = WebHostBaseOptions & WebHostAuthorityOptions;

export interface RunningWebHost {
  url: string;
  close(): Promise<void>;
}

const MISSING_WEB_BUNDLE_MESSAGE =
  'Brunch web bundle is missing. Run npm run build:web before starting the web sidecar.';

export async function startWebHost(options: WebHostOptions): Promise<RunningWebHost> {
  assertExclusiveWebHostOptions(options);
  void options.cwd;
  const webAssetRoot = options.webAssetRoot ?? defaultWebAssetRoot();
  const petrinautStreams = createPetrinautStreamHost(options.cwd);
  const server = createServer((request, response) => {
    if (request.method === 'GET' && isPetrinautLaunchRequest(request.url)) {
      void servePetrinautLaunch(response, options.cwd, request.url, request.headers.host);
      return;
    }

    if (request.method === 'GET' && isPetrinautStreamRequest(request.url)) {
      void petrinautStreams.serve(response, request.url, request.headers.origin);
      return;
    }

    if (request.method === 'GET' && isSpaFallbackRequest(request.url)) {
      serveIndexHtml(response, webAssetRoot);
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
  const rpcTransports: WebRpcTransport[] = [];
  if (options.coordinator) {
    const productUpdates = options.productUpdates ?? createProductUpdatePublisher();
    rpcTransports.push(
      attachWebRpcTransport({
        server,
        path: '/rpc',
        handlers: options.hostedSession
          ? createWebSidecarRpcHandlers({
              coordinator: options.coordinator,
              cwd: options.cwd,
              productUpdates,
              hostedSession: options.hostedSession,
            })
          : createReadOnlyRpcHandlers({
              coordinator: options.coordinator,
              cwd: options.cwd,
              productUpdates,
            }),
        productUpdates,
        ...(options.sessionEvents ? { sessionEvents: options.sessionEvents } : {}),
      }),
    );

    if (
      !options.hostedSession &&
      (options.sessionTurnDriver || options.sessionExchangeAnswer || options.sessionOpenAsks)
    ) {
      rpcTransports.push(
        attachWebRpcTransport({
          server,
          path: '/rpc/driver',
          handlers: createWebSidecarRpcHandlers({
            coordinator: options.coordinator,
            cwd: options.cwd,
            productUpdates,
            ...(options.sessionTurnDriver ? { sessionTurnDriver: options.sessionTurnDriver } : {}),
            ...(options.sessionExchangeAnswer
              ? { sessionExchangeAnswer: options.sessionExchangeAnswer }
              : {}),
            ...(options.sessionOpenAsks ? { sessionOpenAsks: options.sessionOpenAsks } : {}),
          }),
          productUpdates,
          ...(options.sessionEvents ? { sessionEvents: options.sessionEvents } : {}),
        }),
      );
    }
  }

  server.on('upgrade', (request, socket) => {
    if (!isWebRpcUpgradeHandled(request)) {
      socket.destroy();
    }
  });

  const hostname = options.hostname ?? '127.0.0.1';
  await listen(server, options.port ?? 0, hostname);
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Expected Brunch web host to listen on a TCP address');
  }

  return {
    url: `http://${hostname}:${address.port}`,
    async close() {
      await Promise.all(rpcTransports.map((transport) => transport.close()));
      petrinautStreams.closeAll();
      await close(server);
    },
  };
}

async function servePetrinautLaunch(
  response: ServerResponse,
  cwd: string,
  requestUrl: string | undefined,
  host: string | undefined,
): Promise<void> {
  const runId = petrinautStreamRunId(requestUrl);
  if (runId === undefined) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Missing runId');
    return;
  }
  const resolved = resolvePetrinautUrl({ env: process.env });
  if ('error' in resolved) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Petrinaut URL not configured');
    return;
  }
  const detail = await readRunDetail(cwd, runId).catch(() => undefined);
  if (detail === undefined || 'unreadable' in detail || detail.petrinautReplayExport === undefined) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Petrinaut stream not available');
    return;
  }
  const safeHost = safeLoopbackHostHeader(host);
  if (safeHost === undefined) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Invalid Host header');
    return;
  }

  response.writeHead(302, {
    location: composePetrinautLauncherUrl({
      petrinautUrl: resolved.url,
      runId,
      streamUrl: `http://${safeHost}${petrinautStreamPathForRun(runId)}`,
    }),
    'cache-control': 'no-store',
  });
  response.end();
}

function safeLoopbackHostHeader(host: string | undefined): string | undefined {
  if (host === undefined || host.trim().length === 0) return undefined;
  try {
    const parsed = new URL(`http://${host}`);
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '[::1]'
      ? parsed.host
      : undefined;
  } catch {
    return undefined;
  }
}

function isPetrinautStreamRequest(requestUrl: string | undefined): boolean {
  if (!requestUrl) return false;
  try {
    return new URL(requestUrl, 'http://brunch.local').pathname === '/petrinaut/stream';
  } catch {
    return false;
  }
}

function isPetrinautLaunchRequest(requestUrl: string | undefined): boolean {
  if (!requestUrl) return false;
  try {
    return new URL(requestUrl, 'http://brunch.local').pathname === '/petrinaut/launch';
  } catch {
    return false;
  }
}

function defaultWebAssetRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dist-web');
}

function isSpaFallbackRequest(requestUrl: string | undefined): boolean {
  if (!requestUrl) {
    return false;
  }
  let pathname: string;
  try {
    pathname = new URL(requestUrl, 'http://brunch.local').pathname;
  } catch {
    return false;
  }
  return (
    pathname === '/' ||
    pathname.startsWith('/spec/') ||
    pathname.startsWith('/session/') ||
    pathname === '/runs' ||
    pathname.startsWith('/runs/')
  );
}

function serveIndexHtml(response: ServerResponse, webAssetRoot: string): void {
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
