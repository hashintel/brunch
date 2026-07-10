import { readFile } from 'node:fs/promises';
import { createServer, type Server, type ServerResponse } from 'node:http';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readRunDetail, petrinautStreamPathForRun } from '../executor/observer-read.js';
import { subscribePetriEvents } from '../executor/petri-events.js';
import { composePetrinautLauncherUrl, resolvePetrinautUrl } from '../executor/petrinaut/launcher-url.js';
import { serializePetrinautSseFrame, serializePetrinautSseFrames } from '../executor/petrinaut/sse.js';
import {
  projectPetrinautStreamFrames,
  type PetrinautStreamFrame,
  type PetrinautTerminalState,
} from '../executor/petrinaut/stream-frames.js';
import type { WorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { createReadOnlyRpcHandlers, createWebSidecarRpcHandlers } from './handlers.js';
import type { SessionTurnDriver } from './methods/session-driver.js';
import type { SessionExchangeAnswerHandle } from './methods/session-exchange-answer.js';
import { createProductUpdatePublisher, type ProductUpdatePublisher } from './product-updates.js';
import type { SessionEventRelay } from './session-event-relay.js';
import { attachWebRpcTransport, isWebRpcUpgradeHandled, type WebRpcTransport } from './websocket.js';

export interface WebHostOptions {
  cwd: string;
  port?: number;
  hostname?: string;
  coordinator?: WorkspaceSessionCoordinator;
  webAssetRoot?: string;
  productUpdates?: ProductUpdatePublisher;
  sessionEvents?: SessionEventRelay;
  sessionTurnDriver?: SessionTurnDriver;
  sessionExchangeAnswer?: SessionExchangeAnswerHandle;
}

export interface RunningWebHost {
  url: string;
  close(): Promise<void>;
}

const MISSING_WEB_BUNDLE_MESSAGE =
  'Brunch web bundle is missing. Run npm run build:web before starting the web sidecar.';

export async function startWebHost(options: WebHostOptions): Promise<RunningWebHost> {
  void options.cwd;
  const webAssetRoot = options.webAssetRoot ?? defaultWebAssetRoot();
  const server = createServer((request, response) => {
    if (request.method === 'GET' && isPetrinautLaunchRequest(request.url)) {
      void servePetrinautLaunch(response, options.cwd, request.url, request.headers.host);
      return;
    }

    if (request.method === 'GET' && isPetrinautStreamRequest(request.url)) {
      void servePetrinautStream(response, options.cwd, request.url);
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
        handlers: createReadOnlyRpcHandlers({
          coordinator: options.coordinator,
          cwd: options.cwd,
          productUpdates,
        }),
        productUpdates,
        ...(options.sessionEvents ? { sessionEvents: options.sessionEvents } : {}),
      }),
    );

    if (options.sessionTurnDriver || options.sessionExchangeAnswer) {
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
  if (detail === undefined || 'unreadable' in detail || detail.petrinautLiveExport === undefined) {
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

async function servePetrinautStream(
  response: ServerResponse,
  cwd: string,
  requestUrl: string | undefined,
): Promise<void> {
  const runId = petrinautStreamRunId(requestUrl);
  if (runId === undefined) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Missing runId');
    return;
  }
  const detail = await readRunDetail(cwd, runId).catch(() => undefined);
  if (detail === undefined || 'unreadable' in detail || detail.petrinautLiveExport === undefined) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Petrinaut stream not available');
    return;
  }

  response.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'access-control-allow-origin': '*',
  });
  const terminal = petrinautTerminalFromDetail(detail);
  const initialFrames = projectPetrinautStreamFrames({
    liveExport: detail.petrinautLiveExport,
    ...(terminal === undefined ? {} : { terminal }),
  });
  response.write(serializePetrinautSseFrames(initialFrames));
  if (terminal !== undefined) {
    response.end();
    return;
  }

  let sentFiringCount = detail.petrinautLiveExport.transitionFirings.length;
  let terminalSent = false;
  let sendQueue = Promise.resolve();
  const unsubscribe = subscribePetriEvents({
    cwd,
    runId,
    listener: () => {
      sendQueue = sendQueue.then(() =>
        sendNewPetrinautFrames({
          response,
          cwd,
          runId,
          sentFiringCount,
          terminalSent,
          onSent: (state) => {
            sentFiringCount = state.sentFiringCount;
            terminalSent = state.terminalSent;
          },
        }).catch(() => {
          // A failed observer refresh must not poison later event delivery attempts.
        }),
      );
    },
  });
  response.on('close', unsubscribe);
}

async function sendNewPetrinautFrames(args: {
  readonly response: ServerResponse;
  readonly cwd: string;
  readonly runId: string;
  readonly sentFiringCount: number;
  readonly terminalSent: boolean;
  readonly onSent: (state: { readonly sentFiringCount: number; readonly terminalSent: boolean }) => void;
}): Promise<void> {
  if (args.response.writableEnded) return;
  const detail = await readRunDetail(args.cwd, args.runId).catch(() => undefined);
  if (detail === undefined || 'unreadable' in detail || detail.petrinautLiveExport === undefined) return;
  const terminal = petrinautTerminalFromDetail(detail);
  const frames = projectPetrinautStreamFrames({
    liveExport: detail.petrinautLiveExport,
    ...(terminal === undefined ? {} : { terminal }),
  });
  const nextFrames = newPetrinautFrames(frames, args.sentFiringCount, args.terminalSent);
  for (const frame of nextFrames) args.response.write(serializePetrinautSseFrame(frame));
  const sentFiringCount = detail.petrinautLiveExport.transitionFirings.length;
  const terminalSent = args.terminalSent || nextFrames.some((frame) => frame.kind === 'terminal');
  args.onSent({ sentFiringCount, terminalSent });
  if (terminalSent && !args.response.writableEnded) args.response.end();
}

function newPetrinautFrames(
  frames: readonly PetrinautStreamFrame[],
  sentFiringCount: number,
  terminalSent: boolean,
): readonly PetrinautStreamFrame[] {
  let seenFirings = 0;
  const next: PetrinautStreamFrame[] = [];
  for (const frame of frames) {
    if (frame.kind === 'transition_firing') {
      if (seenFirings >= sentFiringCount) next.push(frame);
      seenFirings += 1;
    } else if (frame.kind === 'terminal' && !terminalSent) {
      next.push(frame);
    }
  }
  return next;
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

function petrinautStreamRunId(requestUrl: string | undefined): string | undefined {
  if (!requestUrl) return undefined;
  try {
    const runId = new URL(requestUrl, 'http://brunch.local').searchParams.get('runId')?.trim();
    return runId && runId.length > 0 ? runId : undefined;
  } catch {
    return undefined;
  }
}

function petrinautTerminalFromDetail(detail: {
  readonly petriProjection?: { readonly terminalEventKind?: string; readonly haltedReason?: string };
}): { readonly state: PetrinautTerminalState; readonly reason?: string } | undefined {
  switch (detail.petriProjection?.terminalEventKind) {
    case 'net_completed':
      return { state: 'completed' };
    case 'net_halted':
      return {
        state: 'halted',
        ...(detail.petriProjection.haltedReason === undefined
          ? {}
          : { reason: detail.petriProjection.haltedReason }),
      };
    case 'net_deadlocked':
      return { state: 'deadlocked' };
    default:
      return undefined;
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
    pathname === '/' || pathname.startsWith('/spec/') || pathname === '/runs' || pathname.startsWith('/runs/')
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
