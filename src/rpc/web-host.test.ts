import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { openWorkspaceGraphRuntime } from '../graph/workspace-store.js';
import { assistantMessage, userMessage } from '../probes/test-helpers.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../session/workspace-session-coordinator.js';
import { createProductUpdatePublisher } from './product-updates.js';
import { startWebHost } from './web-host.js';

function text(response: Response): Promise<string> {
  return response.text();
}

async function rawGet(url: string, path: string): Promise<Response> {
  const base = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: base.hostname,
        port: base.port,
        method: 'GET',
        path,
      },
      (res) => {
        const chunks: Uint8Array[] = [];
        res.on('data', (chunk: Uint8Array) => chunks.push(chunk));
        res.on('end', () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              ...(res.statusCode !== undefined ? { status: res.statusCode } : {}),
              headers: res.headers as Record<string, string>,
            }),
          );
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function builtWebAssets(): Promise<string> {
  const assetRoot = await mkdtemp(join(tmpdir(), 'brunch-web-assets-'));
  await mkdir(join(assetRoot, 'assets'));
  await writeFile(
    join(assetRoot, 'index.html'),
    '<!doctype html><title>Brunch</title><main id="root" data-built-shell="true"></main><script type="module" src="/assets/brunch-web.js"></script>',
  );
  await writeFile(join(assetRoot, 'assets', 'brunch-web.js'), "console.log('built web')");
  return assetRoot;
}

describe('web host', () => {
  it('serves built Vite index.html as the native Brunch HTML shell', async () => {
    const assetRoot = await builtWebAssets();
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      const response = await fetch(host.url);
      const html = await text(response);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(html).toContain('data-built-shell="true"');
      expect(html).toContain('/assets/brunch-web.js');
      expect(html).not.toContain('pi-web-ui');
    } finally {
      await host.close();
    }
  });

  it('serves index.html for client-side spec routes as an SPA fallback', async () => {
    const assetRoot = await builtWebAssets();
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      const response = await fetch(`${host.url}/spec/42`);
      const html = await text(response);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(html).toContain('data-built-shell="true"');
    } finally {
      await host.close();
    }
  });

  it('serves built Vite JavaScript assets', async () => {
    const assetRoot = await builtWebAssets();
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      const response = await fetch(`${host.url}/assets/brunch-web.js`);
      const body = await text(response);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/javascript');
      expect(body).toContain("console.log('built web')");
    } finally {
      await host.close();
    }
  });

  it('rejects asset traversal without reading outside the web asset root', async () => {
    const assetRoot = await builtWebAssets();
    await writeFile(join(assetRoot, 'secret.txt'), 'outside asset root');
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      const traversal = await rawGet(host.url, '/assets/../secret.txt');
      const encodedTraversal = await rawGet(host.url, '/assets/%2e%2e/secret.txt');
      const absoluteLike = await rawGet(host.url, '/assets/%2Ftmp/secret.txt');

      expect(traversal.status).toBe(404);
      expect(await text(traversal)).not.toContain('outside asset root');
      expect(encodedTraversal.status).toBe(404);
      expect(await text(encodedTraversal)).not.toContain('outside asset root');
      expect(absoluteLike.status).toBe(404);
    } finally {
      await host.close();
    }
  });

  it('returns an explicit build-web error when the web bundle is missing', async () => {
    const assetRoot = await mkdtemp(join(tmpdir(), 'brunch-web-assets-missing-'));
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      const response = await fetch(host.url);
      const body = await text(response);

      expect(response.status).toBe(500);
      expect(body).toContain('npm run build:web');
    } finally {
      await host.close();
    }
  });

  it('serves a native Brunch HTML shell on an ephemeral port', async () => {
    const assetRoot = await builtWebAssets();
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      const response = await fetch(host.url);
      const html = await text(response);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(html).toContain('Brunch');
      expect(html).not.toContain('pi-web-ui');
    } finally {
      await host.close();
    }
  });

  it('serves workspace and session JSON-RPC over WebSocket using shared handlers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-'));
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).createSetupSession({
      specTitle: 'Web spec',
    });
    workspace.session.manager.appendMessage(assistantMessage('Question'));
    workspace.session.manager.appendMessage(userMessage('Answer'));
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    try {
      const state = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 1,
        method: 'workspace.state',
      });
      const exchanges = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 2,
        method: 'session.exchanges',
      });

      expect(state).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        result: { status: 'ready', spec: { title: 'Web spec' } },
      });
      expect(exchanges).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          status: 'ready',
          exchanges: [{ promptEntryIds: [expect.any(String)] }],
        },
      });
    } finally {
      await host.close();
    }
  });

  it('serves explicit session projection over WebSocket', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-explicit-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const first = await coordinator.createSetupSession({
      specTitle: 'Explicit web spec',
    });
    first.session.manager.appendMessage(assistantMessage('First question'));
    first.session.manager.appendCustomMessageEntry(
      'brunch.elicitation_prompt',
      'Pick an explicit session direction.',
      true,
    );
    first.session.manager.appendMessage(userMessage('First answer'));
    await coordinator.createSetupSessionForCurrentSpec();
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    try {
      const response = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 14,
        method: 'session.exchanges',
        params: { sessionId: first.session.id, specId: first.spec.id },
      });

      expect(response).toMatchObject({
        jsonrpc: '2.0',
        id: 14,
        result: {
          status: 'ready',
          exchanges: [{ promptEntryIds: expect.arrayContaining([expect.any(String)]) }],
        },
      });
    } finally {
      await host.close();
    }
  });

  it('exposes the web sidecar as a read-only RPC attachment surface', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-read-only-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({
      specTitle: 'Read-only web spec',
    });
    workspace.session.manager.appendMessage(assistantMessage('Question'));
    workspace.session.manager.appendMessage(userMessage('Answer'));
    const graph = await openWorkspaceGraphRuntime(cwd);
    const commit = graph.commandExecutor.commitGraph({
      specId: workspace.spec.id,
      nodes: [{ ref: 'goal', plane: 'intent', kind: 'goal', title: 'Visible goal' }],
      edges: [],
    });
    if (commit.status !== 'success') throw new Error('failed to seed graph');
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    try {
      const discovery = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 16,
        method: 'rpc.discover',
      });
      expect(discovery).toMatchObject({
        jsonrpc: '2.0',
        id: 16,
        result: {
          methods: expect.arrayContaining([
            expect.objectContaining({ method: 'workspace.state' }),
            expect.objectContaining({ method: 'workspace.selectionState' }),
            expect.objectContaining({ method: 'session.pendingExchange' }),
            expect.objectContaining({ method: 'session.exchanges' }),
            expect.objectContaining({ method: 'graph.overview' }),
            expect.objectContaining({ method: 'graph.nodeNeighborhood' }),
          ]),
        },
      });
      const discoveredMethods = (
        discovery as { result: { methods: Array<{ method: string }> } }
      ).result.methods.map((method) => method.method);
      expect(discoveredMethods).not.toContain('workspace.activate');
      expect(discoveredMethods).not.toContain('session.triggerExchange');
      expect(discoveredMethods).not.toContain('session.submitExchangeResponse');

      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 17,
          method: 'workspace.activate',
          params: { decision: { action: 'continue' } },
        }),
      ).resolves.toEqual({
        jsonrpc: '2.0',
        id: 17,
        error: { code: -32601, message: 'Method not found' },
      });
      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 18,
          method: 'session.triggerExchange',
        }),
      ).resolves.toEqual({
        jsonrpc: '2.0',
        id: 18,
        error: { code: -32601, message: 'Method not found' },
      });
      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 19,
          method: 'session.submitExchangeResponse',
          params: { exchangeId: 'missing', answer: { text: 'nope' } },
        }),
      ).resolves.toEqual({
        jsonrpc: '2.0',
        id: 19,
        error: { code: -32601, message: 'Method not found' },
      });

      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 20,
          method: 'graph.overview',
          params: { specId: workspace.spec.id },
        }),
      ).resolves.toMatchObject({
        jsonrpc: '2.0',
        id: 20,
        result: { nodes: [expect.objectContaining({ title: 'Visible goal' })] },
      });
      const sessionText = await readFile(workspace.session.file, 'utf8');
      expect(sessionText).not.toContain('deterministic-grounding-choice');
    } finally {
      await host.close();
    }
  });

  it('rejects sidecar structured-exchange mutations without publishing product updates', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-live-'));
    await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Live web spec',
    });
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    const observer = await openWebSocket(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    const actor = await openWebSocket(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    try {
      const actorResponse = nextWebSocketMessage(actor);

      actor.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 21,
          method: 'session.triggerExchange',
        }),
      );

      await expect(actorResponse).resolves.toEqual({
        jsonrpc: '2.0',
        id: 21,
        error: { code: -32601, message: 'Method not found' },
      });
      expect(observer.readyState).toBe(WebSocket.OPEN);
    } finally {
      observer.close();
      actor.close();
      await host.close();
    }
  });

  it('broadcasts product update bus events to attached web observers without a request mutation path', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-bus-'));
    await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Live bus spec',
    });
    const productUpdates = createProductUpdatePublisher();
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
      productUpdates,
    });
    const observer = await openWebSocket(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    try {
      const notification = nextWebSocketMessage(observer);
      productUpdates.publish({ topic: 'graph.overview', specId: 1, lsn: 7 });

      await expect(notification).resolves.toEqual({
        jsonrpc: '2.0',
        method: 'brunch.updated',
        params: {
          topics: ['graph.overview'],
          updates: [{ topic: 'graph.overview', specId: 1, lsn: 7 }],
        },
      });
    } finally {
      observer.close();
      await host.close();
    }
  });

  it('multiplexes two JSON-RPC requests over one WebSocket', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-multiplex-'));
    await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Multiplex spec',
    });
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    try {
      const responses = await websocketRpcBatch(host.url, [
        { jsonrpc: '2.0', id: 10, method: 'workspace.state' },
        { jsonrpc: '2.0', id: 11, method: 'workspace.state' },
      ]);

      expect(responses).toHaveLength(2);
      expect(responses).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ jsonrpc: '2.0', id: 10 }),
          expect.objectContaining({ jsonrpc: '2.0', id: 11 }),
        ]),
      );
    } finally {
      await host.close();
    }
  });

  it('returns a parse error for malformed WebSocket JSON without killing the host', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-malformed-'));
    await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Malformed spec',
    });
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    try {
      const response = await websocketRaw(host.url, 'not json');

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error' },
      });
      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 12,
          method: 'workspace.state',
        }),
      ).resolves.toMatchObject({ jsonrpc: '2.0', id: 12 });
    } finally {
      await host.close();
    }
  });

  it('returns an internal error for WebSocket handler failures', async () => {
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      coordinator: throwingCoordinator(),
    });
    try {
      const response = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 13,
        method: 'workspace.state',
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 13,
        error: { code: -32603, message: 'Internal error' },
      });
    } finally {
      await host.close();
    }
  });

  it('continues delivering product updates after a failed WebSocket request', async () => {
    const productUpdates = createProductUpdatePublisher();
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      coordinator: throwingCoordinator(),
      productUpdates,
    });
    const observer = await openWebSocket(`${host.url.replace(/^http/u, 'ws')}/rpc`);
    try {
      const failedResponse = nextWebSocketMessage(observer);
      observer.send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 14,
          method: 'workspace.state',
        }),
      );

      await expect(failedResponse).resolves.toEqual({
        jsonrpc: '2.0',
        id: 14,
        error: { code: -32603, message: 'Internal error' },
      });

      const notification = nextWebSocketMessage(observer);
      productUpdates.publish({ topic: 'graph.overview', specId: 1, lsn: 8 });

      await expect(notification).resolves.toMatchObject({
        jsonrpc: '2.0',
        method: 'brunch.updated',
      });
    } finally {
      observer.close();
      await host.close();
    }
  });

  it('rejects non-rpc WebSocket upgrade paths', async () => {
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      coordinator: throwingCoordinator(),
    });
    try {
      await expect(openWebSocket(`${host.url.replace(/^http/u, 'ws')}/not-rpc`)).rejects.toThrow(
        'WebSocket failed to open',
      );
    } finally {
      await host.close();
    }
  });

  it('propagates the non-linear transcript JSON-RPC error over WebSocket', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-branch-'));
    const workspace = await createWorkspaceSessionCoordinator({
      cwd,
    }).createSetupSession({
      specTitle: 'Branch spec',
    });
    const manager = SessionManager.open(workspace.session.file);
    manager.appendMessage(assistantMessage('Abandoned prompt'));
    manager.appendMessage(userMessage('Abandoned answer'));
    manager.resetLeaf();
    manager.appendMessage(assistantMessage('Active prompt'));
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
    });
    try {
      const response = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 4,
        method: 'session.exchanges',
      });

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 4,
        error: {
          code: -32002,
          message: 'Selected Brunch session transcript is non-linear',
        },
      });
    } finally {
      await host.close();
    }
  });

  it('does not expose product read endpoints over HTTP GET', async () => {
    const host = await startWebHost({ cwd: '/tmp/brunch-project', port: 0 });
    try {
      const response = await fetch(`${host.url}/workspace.state`);

      expect(response.status).toBe(404);
    } finally {
      await host.close();
    }
  });
});

async function websocketRpc(url: string, request: unknown): Promise<unknown> {
  const [response] = await websocketRpcBatch(url, [request]);
  return response;
}

async function websocketRpcBatch(url: string, requests: readonly unknown[]): Promise<unknown[]> {
  const socket = await openWebSocket(`${url.replace(/^http/u, 'ws')}/rpc`);
  const responses: unknown[] = [];
  try {
    const done = new Promise<unknown[]>((resolve, reject) => {
      socket.addEventListener('message', (event) => {
        responses.push(JSON.parse(String(event.data)) as unknown);
        if (responses.length === requests.length) {
          resolve(responses);
        }
      });
      socket.addEventListener('error', () => reject(new Error('WebSocket error')), { once: true });
    });
    for (const request of requests) {
      socket.send(JSON.stringify(request));
    }
    return await done;
  } finally {
    socket.close();
  }
}

async function websocketRaw(url: string, message: string): Promise<unknown> {
  const socket = await openWebSocket(`${url.replace(/^http/u, 'ws')}/rpc`);
  try {
    const response = new Promise<unknown>((resolve, reject) => {
      socket.addEventListener('message', (event) => resolve(JSON.parse(String(event.data)) as unknown), {
        once: true,
      });
      socket.addEventListener('error', () => reject(new Error('WebSocket error')), { once: true });
    });
    socket.send(message);
    return await response;
  } finally {
    socket.close();
  }
}

function nextWebSocketMessage(socket: WebSocket): Promise<unknown> {
  return new Promise((resolve, reject) => {
    socket.addEventListener('message', (event) => resolve(JSON.parse(String(event.data)) as unknown), {
      once: true,
    });
    socket.addEventListener('error', () => reject(new Error('WebSocket error')), { once: true });
  });
}

function openWebSocket(url: string): Promise<WebSocket> {
  const socket = new WebSocket(url);
  return new Promise<WebSocket>((resolve, reject) => {
    socket.addEventListener('open', () => resolve(socket), { once: true });
    socket.addEventListener('error', () => reject(new Error('WebSocket failed to open')), { once: true });
  });
}

function throwingCoordinator(): WorkspaceSessionCoordinator {
  return {
    ...createWorkspaceSessionCoordinator({ cwd: '/tmp/brunch-project' }),
    async openDefaultWorkspace() {
      throw new Error('boom');
    },
  };
}
