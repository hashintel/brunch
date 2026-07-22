import { createServer, type ServerResponse } from 'node:http';

export interface CapturedOptimizationRequest {
  readonly body: unknown;
  aborted: boolean;
}

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
    response.writeHead(200, { 'content-type': 'application/x-ndjson' });
    const name = record(body) && typeof body['name'] === 'string' ? body['name'] : '';
    writeEvent(response, { type: 'started', requestedTrials: 2 });
    if (name.includes('cancel')) return;
    if (name.includes('failure')) {
      writeEvent(response, {
        type: 'error',
        code: 'deterministic_failure',
        message: 'Deterministic optimizer failure',
        retryable: false,
      });
      response.end();
      return;
    }
    const best = { trial: 0, parameters: { rate: 4 }, objective: 12 };
    writeEvent(response, {
      type: 'trial',
      trial: 0,
      parameters: { rate: 4 },
      objective: 12,
      state: 'complete',
      best,
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    writeEvent(response, {
      type: 'trial',
      trial: 1,
      parameters: { rate: 6 },
      objective: 10,
      state: 'complete',
      best,
    });
    writeEvent(response, {
      type: 'complete',
      requestedTrials: 2,
      completedTrials: 2,
      prunedTrials: 0,
      failedTrials: 0,
      best,
    });
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
      for (const response of openResponses) response.destroy();
      await new Promise<void>((resolveClose, reject) => {
        server.close((error) => (error === undefined ? resolveClose() : reject(error)));
      });
    },
  };
}

function writeEvent(response: ServerResponse, event: unknown): void {
  response.write(`${JSON.stringify(event)}\n`);
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
