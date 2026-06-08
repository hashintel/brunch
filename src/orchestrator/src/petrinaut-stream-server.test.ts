import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PetrinautEvent } from './petrinaut-events.js';
import type { SdcpnFile } from './petrinaut-sdcpn.js';
import {
  type BrunchExecutionExportFrame,
  createPetrinautStreamBus,
  type PetrinautStreamBus,
} from './petrinaut-stream-bus.js';
import { createPetrinautStreamServer, type PetrinautStreamServer } from './petrinaut-stream-server.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sdcpnFile: SdcpnFile = {
  version: 1,
  meta: { generator: 'brunch', generatorVersion: '0.2.0' },
  title: 'stream-server-fixture',
  places: [
    { id: 'src', name: 'Src', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
    { id: 'dst', name: 'Dst', colorId: null, dynamicsEnabled: false, differentialEquationId: null },
  ],
  transitions: [
    {
      id: 't-move',
      name: 'TMove',
      inputArcs: [{ placeId: 'src', weight: 1, type: 'standard' }],
      outputArcs: [{ placeId: 'dst', weight: 1 }],
      lambdaType: 'predicate',
      lambdaCode: '',
      transitionKernelCode: '',
    },
  ],
  types: [],
  differentialEquations: [],
  parameters: [],
  scenarios: [],
  metrics: [],
};

const initialMarking: PetrinautEvent = {
  kind: 'initial_marking',
  ts: '2026-06-02T00:00:00.000Z',
  runId: 'run-srv',
  marking: { src: [{ id: 'tk-a' }] },
};
const firing: PetrinautEvent = {
  kind: 'transition_fired',
  ts: '2026-06-02T00:00:00.100Z',
  runId: 'run-srv',
  transitionName: 't-move',
  input: { src: [{ id: 'tk-a' }] },
  output: { dst: [{ id: 'tk-b' }] },
};
const terminal: PetrinautEvent = {
  kind: 'net_halted',
  ts: '2026-06-02T00:00:00.200Z',
  runId: 'run-srv',
};

// ---------------------------------------------------------------------------
// Per-test server setup — real http.createServer + listen(0), no mocks.
// ---------------------------------------------------------------------------

type Ctx = {
  bus: PetrinautStreamBus;
  server: PetrinautStreamServer;
  streamUrl: string;
};

const ctx: Partial<Ctx> = {};

beforeEach(async () => {
  const bus = createPetrinautStreamBus({ runId: 'run-srv', sdcpnFile });
  const server = createPetrinautStreamServer({ bus });
  const { streamUrl } = await server.start();
  ctx.bus = bus;
  ctx.server = server;
  ctx.streamUrl = streamUrl;
});

afterEach(async () => {
  await ctx.server?.stop();
});

// ---------------------------------------------------------------------------
// SSE parsing helper — splits a raw text/event-stream body into frame objects.
// ---------------------------------------------------------------------------

type ParsedSseFrame = { event: string; data: unknown };

function parseSse(body: string): ParsedSseFrame[] {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.trim().length > 0)
    .map((chunk) => {
      const lines = chunk.split('\n');
      let event = '';
      let dataLine = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.slice('event:'.length).trim();
        else if (line.startsWith('data:')) dataLine = line.slice('data:'.length).trim();
      }
      return { event, data: dataLine ? JSON.parse(dataLine) : undefined };
    });
}

async function readEntireStream(url: string, signal?: AbortSignal): Promise<ParsedSseFrame[]> {
  const res = await fetch(url, { signal });
  const text = await res.text();
  return parseSse(text);
}

// ---------------------------------------------------------------------------
// Response shape + wire conformance
// ---------------------------------------------------------------------------

describe('createPetrinautStreamServer — GET /stream wire conformance', () => {
  it('returns 200 with SSE response headers', async () => {
    // Publish terminal up front so the response closes immediately.
    ctx.bus!.publish(initialMarking);
    ctx.bus!.publish(terminal);

    const res = await fetch(ctx.streamUrl!);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/^text\/event-stream/);
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('connection')).toBe('keep-alive');
    await res.text(); // drain
  });

  it('serializes each frame as one `event: <kind>\\ndata: <json>\\n\\n` block', async () => {
    ctx.bus!.publish(initialMarking);
    ctx.bus!.publish(firing);
    ctx.bus!.publish(terminal);

    const frames = await readEntireStream(ctx.streamUrl!);
    expect(frames.map((f) => f.event)).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'terminal',
    ]);

    // Each data payload parses as JSON whose shape matches the variant.
    expect(frames[0]!.data).toHaveProperty('version');
    expect(frames[0]!.data).toHaveProperty('places');
    expect(frames[0]!.data).toHaveProperty('transitions');
    expect(frames[1]!.data).toEqual({ src: 1 });
    expect(frames[2]!.data).toMatchObject({ transitionId: 't-move', ts: '2026-06-02T00:00:00.100Z' });
    expect(frames[3]!.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Replay-on-connect — late connections still get the full timeline.
// ---------------------------------------------------------------------------

describe('createPetrinautStreamServer — replay on connect', () => {
  it('a connection opened after the bus has terminated receives the full back-buffer then closes', async () => {
    for (const e of [initialMarking, firing, terminal]) ctx.bus!.publish(e);

    const frames = await readEntireStream(ctx.streamUrl!);
    expect(frames.map((f) => f.event)).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'terminal',
    ]);
  });

  it('a connection opened mid-stream sees replay first, then live frames, then terminal', async () => {
    ctx.bus!.publish(initialMarking);
    ctx.bus!.publish(firing);

    // Start the request; do not await yet — publish more, then await full body.
    const responsePromise = fetch(ctx.streamUrl!).then((r) => r.text());
    // Give the request a moment to attach.
    await new Promise((resolve) => setImmediate(resolve));
    ctx.bus!.publish({
      kind: 'transition_fired',
      ts: '2026-06-02T00:00:00.150Z',
      runId: 'run-srv',
      transitionName: 't-move',
      input: { dst: [{ id: 'tk-b' }] },
      output: { src: [{ id: 'tk-c' }] },
    });
    ctx.bus!.publish(terminal);

    const frames = parseSse(await responsePromise);
    expect(frames.map((f) => f.event)).toEqual([
      'definition',
      'initial_state',
      'transition_firing',
      'transition_firing',
      'terminal',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Concurrent connections
// ---------------------------------------------------------------------------

describe('createPetrinautStreamServer — concurrent connections', () => {
  it('two concurrent connections each see the full ordered frame sequence independently', async () => {
    for (const e of [initialMarking, firing, terminal]) ctx.bus!.publish(e);

    const [a, b] = await Promise.all([readEntireStream(ctx.streamUrl!), readEntireStream(ctx.streamUrl!)]);
    const expected = ['definition', 'initial_state', 'transition_firing', 'terminal'];
    expect(a.map((f) => f.event)).toEqual(expected);
    expect(b.map((f) => f.event)).toEqual(expected);
  });
});

// ---------------------------------------------------------------------------
// Disconnect → unsubscribe
// ---------------------------------------------------------------------------

describe('createPetrinautStreamServer — disconnect unsubscribes', () => {
  it('client AbortController.abort() before terminal removes the subscriber so the bus has no leak', async () => {
    ctx.bus!.publish(initialMarking);

    const ac = new AbortController();
    const fetchPromise = fetch(ctx.streamUrl!, { signal: ac.signal });
    const res = await fetchPromise;
    // Begin consuming the body so the server actually has the connection open.
    const reader = res.body!.getReader();
    await reader.read(); // first chunk

    // Server now has one active connection.
    expect(ctx.server!.connectionCount()).toBe(1);

    ac.abort();
    // Wait for the server to observe close.
    await new Promise<void>((resolve) => {
      const start = Date.now();
      const tick = (): void => {
        if (ctx.server!.connectionCount() === 0 || Date.now() - start > 1000) resolve();
        else setTimeout(tick, 10);
      };
      tick();
    });
    expect(ctx.server!.connectionCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

describe('createPetrinautStreamServer — routing', () => {
  it('returns 404 for any path other than /stream', async () => {
    const base = ctx.streamUrl!.replace('/stream', '');
    const res = await fetch(`${base}/anything-else`);
    expect(res.status).toBe(404);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
    await res.text();
  });

  it('OPTIONS /stream returns 204 with CORS headers', async () => {
    const res = await fetch(ctx.streamUrl!, { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/GET/);
    expect(res.headers.get('access-control-allow-methods')).toMatch(/OPTIONS/);
  });

  it('GET /stream carries Access-Control-Allow-Origin: *', async () => {
    ctx.bus!.publish(initialMarking);
    ctx.bus!.publish(terminal);
    const res = await fetch(ctx.streamUrl!);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    await res.text();
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('createPetrinautStreamServer — lifecycle', () => {
  it('start() resolves with { host, port, streamUrl } where host is 127.0.0.1 and port is non-zero', async () => {
    // Already started in beforeEach; re-derive from streamUrl.
    const url = new URL(ctx.streamUrl!);
    expect(url.hostname).toBe('127.0.0.1');
    expect(Number(url.port)).toBeGreaterThan(0);
    expect(url.pathname).toBe('/stream');
  });

  it('start() rejects if called twice', async () => {
    await expect(ctx.server!.start()).rejects.toThrow(/already started/i);
  });

  it('stop() is idempotent', async () => {
    await ctx.server!.stop();
    await expect(ctx.server!.stop()).resolves.toBeUndefined();
  });

  it('stop() ends any in-flight responses and closes the server', async () => {
    ctx.bus!.publish(initialMarking);
    // Open a connection but do not let the bus terminate.
    const res = await fetch(ctx.streamUrl!);
    const reader = res.body!.getReader();
    await reader.read(); // first chunk arrives (definition + initial_state replay)

    await ctx.server!.stop();
    // The reader should now end cleanly (server closed the response).
    const result = await reader.read();
    expect(result.done).toBe(true);
  });
});

// Type-level pin so the test compiles against the exported types.
type _PinFrame = BrunchExecutionExportFrame;
