import { createServer, type ServerResponse } from 'node:http';

export interface CapturedOptimizationRequest {
  readonly body: unknown;
  aborted: boolean;
}

/**
 * Deterministic Petrinaut Opt stand-in that speaks the upstream Optuna SSE
 * contract decoded by `@local/petrinaut-optimizer-client`.
 *
 * Request `name` steers the branch:
 * - includes `failure` → terminal `event: error`
 * - includes `cancel` → hold the stream open (no terminal event)
 * - otherwise → two COMPLETE trials + `event: done`
 */
export async function startDeterministicFakeOptimizer(): Promise<{
  readonly origin: string;
  readonly requests: CapturedOptimizationRequest[];
  readonly close: () => Promise<void>;
}> {
  const requests: CapturedOptimizationRequest[] = [];
  const openResponses = new Set<ServerResponse>();
  const server = createServer(async (request, response) => {
    if (request.method !== 'POST' || request.url !== '/optimize/all') {
      response.writeHead(404).end('Not found');
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      response.writeHead(400).end('invalid JSON');
      return;
    }
    const captured: CapturedOptimizationRequest = { body, aborted: false };
    requests.push(captured);
    openResponses.add(response);
    const markAborted = () => {
      if (!response.writableEnded) captured.aborted = true;
      openResponses.delete(response);
    };
    request.on('aborted', markAborted);
    response.on('close', markAborted);
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    const name = record(body) && typeof body['name'] === 'string' ? body['name'] : '';
    if (name.includes('cancel')) return;
    if (name.includes('failure')) {
      writeEvent(response, { message: 'Deterministic optimizer failure' }, 'error');
      response.end();
      return;
    }
    writeEvent(response, {
      step: 0,
      params: { rate: 4 },
      metric: 12,
      state: 'COMPLETE',
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    writeEvent(response, {
      step: 1,
      params: { rate: 6 },
      metric: 10,
      state: 'COMPLETE',
    });
    writeEvent(response, {}, 'done');
    response.end();
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('fake optimizer has no TCP address');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    requests,
    close: async () => {
      for (const open of openResponses) open.destroy();
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error === undefined ? resolveClose() : reject(error)));
      });
    },
  };
}

function writeEvent(response: ServerResponse, event: unknown, name?: 'done' | 'error'): void {
  response.write(`${name === undefined ? '' : `event: ${name}\n`}data: ${JSON.stringify(event)}\n\n`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
