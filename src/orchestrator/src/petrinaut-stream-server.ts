// ---------------------------------------------------------------------------
// Ephemeral HTTP/SSE server for the Petrinaut live stream.
//
// Thin transport shell over `createPetrinautStreamBus`. One route —
// `GET /stream` — returns `text/event-stream` and turns every
// `BrunchExecutionExportFrame` published on the bus into one SSE event,
// closing the response immediately after the terminal frame.
//
// Lifecycle:
//   - bind on `127.0.0.1` (localhost only — auth and CORS posture become
//     vacuous because nothing outside this host can connect).
//   - per-connection subscribe-on-open / unsubscribe-on-close; the bus
//     handles replay so a connection opened mid-run synchronously replays
//     the full back-buffer before live frames flow.
//   - `stop()` ends every in-flight response and closes the server.
// `Last-Event-ID` resume / SSE keep-alive comments are deliberately omitted
// for v1: the buffer is the timeline (a reconnect just re-replays), and
// localhost runs finish in seconds-to-minutes — no proxy idle window to
// worry about. Add them when a real Petrinaut client demands either.
// ---------------------------------------------------------------------------

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { BrunchExecutionExportFrame, PetrinautStreamBus } from './petrinaut-stream-bus.js';

export type CreatePetrinautStreamServerOpts = {
  /** Source of frames; built by `createPetrinautStreamBus`. */
  bus: PetrinautStreamBus;
  /** Bind host. Defaults to `127.0.0.1` (localhost-only). */
  host?: string;
  /** Bind port. Defaults to `0` (kernel-chosen ephemeral). */
  port?: number;
};

export type PetrinautStreamServerEndpoint = {
  host: string;
  port: number;
  /** `http://${host}:${port}/stream` — what the SSE client connects to. */
  streamUrl: string;
};

export type PetrinautStreamServer = {
  /** Bind + listen. Rejects if called more than once. */
  start(): Promise<PetrinautStreamServerEndpoint>;
  /** End all in-flight responses and close the server. Idempotent. */
  stop(): Promise<void>;
  /** Number of currently-attached SSE connections — observable for tests / debugging. */
  connectionCount(): number;
};

const STREAM_PATH = '/stream';
const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'Access-Control-Allow-Origin': '*',
};
const CORS_PREFLIGHT_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export function createPetrinautStreamServer(opts: CreatePetrinautStreamServerOpts): PetrinautStreamServer {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 0;
  const bus = opts.bus;

  let server: Server | undefined;
  let started = false;
  let stopped = false;
  // Active SSE responses — tracked so `stop()` can end them and tests can
  // observe disconnect-driven unsubscribe.
  const activeResponses = new Set<ServerResponse>();

  function handleStream(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, SSE_HEADERS);
    activeResponses.add(res);

    // Subscribe to the bus; the bus synchronously replays the full timeline
    // before returning, then any further frames flow through this handler.
    const unsubscribe = bus.subscribe((frame) => {
      // If the response is already closed (client disconnect mid-frame),
      // do nothing — the close-handler below has already torn this down.
      if (res.writableEnded) return;
      res.write(serializeFrame(frame));
      if (frame.kind === 'terminal') {
        res.end();
      }
    });

    const cleanup = (): void => {
      unsubscribe();
      activeResponses.delete(res);
    };
    res.on('close', cleanup);
    // `finish` fires on `res.end()`; `close` covers both clean and abrupt
    // termination so this is the conservative net.
  }

  function handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const url = req.url ?? '';
    // Path-only comparison — query string is fine and ignored for v1.
    const path = url.split('?', 1)[0]!;

    if (req.method === 'OPTIONS' && path === STREAM_PATH) {
      res.writeHead(204, CORS_PREFLIGHT_HEADERS);
      res.end();
      return;
    }
    if (req.method === 'GET' && path === STREAM_PATH) {
      handleStream(req, res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }

  return {
    async start(): Promise<PetrinautStreamServerEndpoint> {
      if (started) throw new Error('createPetrinautStreamServer: already started');
      started = true;
      const srv = createServer(handleRequest);
      server = srv;
      await new Promise<void>((resolve, reject) => {
        srv.once('error', reject);
        srv.listen(port, host, () => {
          srv.off('error', reject);
          resolve();
        });
      });
      const address = srv.address() as AddressInfo;
      return {
        host: address.address,
        port: address.port,
        streamUrl: `http://${address.address}:${address.port}${STREAM_PATH}`,
      };
    },
    async stop(): Promise<void> {
      if (stopped) return;
      stopped = true;
      // End every in-flight response so server.close() can complete.
      for (const res of [...activeResponses]) {
        if (!res.writableEnded) res.end();
      }
      activeResponses.clear();
      if (!server) return;
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
    },
    connectionCount(): number {
      return activeResponses.size;
    },
  };
}

/**
 * Render one frame as a wire-format SSE event. Event name is the frame's
 * `kind`; data is JSON-encoded for every variant except `terminal`, which
 * has no payload beyond the kind itself.
 */
function serializeFrame(frame: BrunchExecutionExportFrame): string {
  switch (frame.kind) {
    case 'definition':
      return `event: definition\ndata: ${JSON.stringify(frame.definition)}\n\n`;
    case 'initial_state':
      return `event: initial_state\ndata: ${JSON.stringify(frame.initialState)}\n\n`;
    case 'transition_firing':
      return `event: transition_firing\ndata: ${JSON.stringify(frame.firing)}\n\n`;
    case 'terminal':
      return `event: terminal\ndata: \n\n`;
  }
}
