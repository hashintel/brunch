import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { appendPetriEvent } from '../../executor/petri-events.js';
import { runDirPath, runMetadataPath } from '../../executor/run.js';
import { runCreateOnlyMutation } from '../../graph/__tests__/support/create-only-mutation.js';
import { openWorkspaceGraphRuntime } from '../../graph/workspace-store.js';
import { assistantMessage, userMessage } from '../../probes/test-helpers.js';
import {
  createWorkspaceSessionCoordinator,
  type WorkspaceSessionCoordinator,
} from '../../session/workspace-session-coordinator.js';
import { createProductUpdatePublisher } from '../product-updates.js';
import { startWebHost } from '../web-host.js';

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

async function rawGetWithHost(url: string, path: string, host: string): Promise<Response> {
  const base = new URL(url);
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: base.hostname,
        port: base.port,
        method: 'GET',
        path,
        headers: { Host: host },
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

function parseSse(body: string): Array<{ event: string; data: unknown }> {
  return body
    .split('\n\n')
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      const lines = chunk.split('\n');
      const event = lines.find((line) => line.startsWith('event: '))?.slice('event: '.length) ?? '';
      const data = lines.find((line) => line.startsWith('data: '))?.slice('data: '.length) ?? '';
      return { event, data: data.length === 0 ? undefined : JSON.parse(data) };
    });
}

async function writePetrinautReplayRun(
  cwd: string,
  runId: string,
  options: { readonly terminal?: boolean } = {},
): Promise<void> {
  const terminal = options.terminal ?? true;
  const runDir = runDirPath(cwd, runId);
  await mkdir(join(runDir, 'petrinaut'), { recursive: true });
  await writeFile(
    runMetadataPath(cwd, runId),
    `${JSON.stringify({ runId, specId: '42', planPath: '/plan.yaml', status: 'promotion_prepared' })}\n`,
    'utf8',
  );
  await writeFile(
    join(runDir, 'petrinaut', 'net.json'),
    `${JSON.stringify({
      runId,
      transitions: [
        {
          id: 'worktree_create',
          inputArcs: [{ placeId: 'run:created', weight: 1 }],
          outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
        },
      ],
      initialMarking: { 'run:created': 1 },
    })}\n`,
    'utf8',
  );
  await writeFile(
    join(runDir, 'petrinaut', 'net.sdcpn.json'),
    `${JSON.stringify({
      version: 1,
      meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
      title: `Executor run ${runId}`,
      places: [
        {
          id: 'run:created',
          name: 'RunCreated',
          colorId: null,
          dynamicsEnabled: false,
          differentialEquationId: null,
        },
        {
          id: 'run:worktree_created',
          name: 'RunWorktreeCreated',
          colorId: null,
          dynamicsEnabled: false,
          differentialEquationId: null,
        },
      ],
      transitions: [
        {
          id: 'worktree_create',
          name: 'worktree_create',
          inputArcs: [{ placeId: 'run:created', weight: 1, type: 'standard' }],
          outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
          lambdaType: 'predicate',
          lambdaCode: 'export default Lambda(() => true)',
          transitionKernelCode: 'export default TransitionKernel(() => ({}))',
        },
      ],
      types: [],
      differentialEquations: [],
      parameters: [],
      scenarios: [
        {
          id: 'scenario__initial-marking',
          name: 'Initial marking',
          scenarioParameters: [],
          parameterOverrides: {},
          initialState: { type: 'per_place', content: { 'run:created': '1' } },
        },
      ],
      metrics: [],
    })}\n`,
    'utf8',
  );
  await writeFile(
    join(runDir, 'petrinaut', 'events.jsonl'),
    [
      JSON.stringify({
        kind: 'transition_fired',
        runId,
        runStatus: 'worktree_created',
        transitionId: 'worktree_create',
        subnetId: 'run',
        step: 'worktree_create',
        consumed: ['run:created'],
        produced: ['run:worktree_created'],
        fromStatus: 'created',
        toStatus: 'worktree_created',
      }),
      ...(terminal
        ? [JSON.stringify({ kind: 'net_completed', runId, runStatus: 'promotion_prepared' })]
        : []),
      '',
    ].join('\n'),
    'utf8',
  );
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

  it('serves index.html for client-side runs routes as an SPA fallback', async () => {
    const assetRoot = await builtWebAssets();
    const host = await startWebHost({
      cwd: '/tmp/brunch-project',
      port: 0,
      webAssetRoot: assetRoot,
    });
    try {
      for (const path of ['/runs', '/runs/run-1']) {
        const response = await fetch(`${host.url}${path}`);
        const html = await text(response);

        expect(response.status).toBe(200);
        expect(html).toContain('data-built-shell="true"');
      }
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
    const commit = runCreateOnlyMutation(graph.commandExecutor, {
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
      expect(discoveredMethods).not.toContain('session.driveTurn');

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
          method: 'session.driveTurn',
          params: { prompt: 'no driver attached' },
        }),
      ).resolves.toEqual({
        jsonrpc: '2.0',
        id: 20,
        error: { code: -32601, message: 'Method not found' },
      });

      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 21,
          method: 'graph.overview',
          params: { specId: workspace.spec.id },
        }),
      ).resolves.toMatchObject({
        jsonrpc: '2.0',
        id: 21,
        result: { nodes: [expect.objectContaining({ title: 'Visible goal' })] },
      });
      const sessionText = await readFile(workspace.session.file, 'utf8');
      expect(sessionText).not.toContain('deterministic-grounding-choice');
    } finally {
      await host.close();
    }
  });

  it('keeps live sidecar driver methods off observer connections when driver handles exist', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-rpc-driver-authority-'));
    await createWorkspaceSessionCoordinator({ cwd }).createSetupSession({
      specTitle: 'Driver authority web spec',
    });
    const drivenPrompts: string[] = [];
    const host = await startWebHost({
      cwd,
      port: 0,
      coordinator: createWorkspaceSessionCoordinator({ cwd }),
      sessionTurnDriver: {
        async prompt(input) {
          drivenPrompts.push(input.text);
          return { driven: true };
        },
      },
      sessionExchangeAnswer: {
        answerer: {
          submitAnswer() {
            return { submitted: false, reason: 'no_pending_exchange' };
          },
        },
      },
    });
    try {
      const observerDiscovery = await websocketRpc(host.url, {
        jsonrpc: '2.0',
        id: 21,
        method: 'rpc.discover',
      });
      const observerMethods = (
        observerDiscovery as { result: { methods: Array<{ method: string }> } }
      ).result.methods.map((method) => method.method);
      expect(observerMethods).not.toContain('session.driveTurn');
      expect(observerMethods).not.toContain('session.answerExchange');

      await expect(
        websocketRpc(host.url, {
          jsonrpc: '2.0',
          id: 22,
          method: 'session.driveTurn',
          params: { prompt: 'observer must not drive' },
        }),
      ).resolves.toEqual({
        jsonrpc: '2.0',
        id: 22,
        error: { code: -32601, message: 'Method not found' },
      });
      await expect(
        websocketRpc(`${host.url}/rpc/driver`, {
          jsonrpc: '2.0',
          id: 23,
          method: 'session.driveTurn',
          params: { prompt: 'driver may drive' },
        }),
      ).resolves.toEqual({ jsonrpc: '2.0', id: 23, result: { status: 'completed' } });
      expect(drivenPrompts).toEqual(['driver may drive']);

      const driverDiscovery = await websocketRpc(`${host.url}/rpc/driver`, {
        jsonrpc: '2.0',
        id: 24,
        method: 'rpc.discover',
      });
      const driverMethods = (
        driverDiscovery as { result: { methods: Array<{ method: string }> } }
      ).result.methods.map((method) => method.method);
      expect(driverMethods).toEqual(expect.arrayContaining(['session.driveTurn', 'session.answerExchange']));
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

  it('serves artifact-backed Petrinaut SSE replay for a run with derived live export artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-petrinaut-stream-'));
    await writePetrinautReplayRun(cwd, 'run-1');
    const host = await startWebHost({ cwd, port: 0 });
    try {
      const response = await fetch(`${host.url}/petrinaut/stream?runId=run-1`);
      const frames = parseSse(await response.text());

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toMatch(/^text\/event-stream/u);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(frames.map((frame) => frame.event)).toEqual([
        'status',
        'definition',
        'initial_state',
        'transition_firing',
        'transition_firing',
        'terminal',
      ]);
      expect(frames[0]?.data).toEqual({ state: 'completed' });
      expect(frames[2]?.data).toEqual({ 'run:created': 1 });
      expect(frames[3]?.data).toMatchObject({
        transitionId: 'worktree_create',
        input: { 'run:created': 1 },
        output: { 'run:worktree_created': 1 },
      });
      expect(frames[5]?.data).toEqual({ state: 'completed' });
    } finally {
      await host.close();
    }
  });

  it('keeps Petrinaut SSE connections open and streams later in-process Petri events', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-petrinaut-stream-live-'));
    await writePetrinautReplayRun(cwd, 'run-1', { terminal: false });
    const host = await startWebHost({ cwd, port: 0 });
    try {
      const response = await fetch(`${host.url}/petrinaut/stream?runId=run-1`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      const first = await reader.read();
      expect(first.done).toBe(false);
      let body = decoder.decode(first.value);

      await appendPetriEvent({
        cwd,
        runId: 'run-1',
        event: { kind: 'net_completed', runId: 'run-1', runStatus: 'promotion_prepared' },
      });

      for (;;) {
        const next = await reader.read();
        if (next.done) break;
        body += decoder.decode(next.value);
      }
      const frames = parseSse(body);

      expect(frames.map((frame) => frame.event)).toEqual([
        'status',
        'definition',
        'initial_state',
        'transition_firing',
        'transition_firing',
        'terminal',
      ]);
      expect(frames[0]?.data).toEqual({ state: 'running' });
      expect(frames[4]?.data).toMatchObject({ transitionId: 'run:finish', output: { 'run:completed': 1 } });
      expect(frames[5]?.data).toEqual({ state: 'completed' });
    } finally {
      await host.close();
    }
  });

  it('rejects Petrinaut SSE replay without a runId or without derived artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-petrinaut-stream-missing-'));
    const host = await startWebHost({ cwd, port: 0 });
    try {
      const missingRunId = await fetch(`${host.url}/petrinaut/stream`);
      const unavailable = await fetch(`${host.url}/petrinaut/stream?runId=run-missing`);

      expect(missingRunId.status).toBe(400);
      expect(await missingRunId.text()).toBe('Missing runId');
      expect(unavailable.status).toBe(404);
      expect(await unavailable.text()).toBe('Petrinaut stream not available');
    } finally {
      await host.close();
    }
  });

  it('redirects Petrinaut launch requests to the configured launcher with an absolute SSE URL', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-petrinaut-launch-'));
    await writePetrinautReplayRun(cwd, 'run-1');
    const previousPetrinautUrl = process.env.PETRINAUT_URL;
    process.env.PETRINAUT_URL = 'https://petrinaut.example/brunch?theme=dark';
    const host = await startWebHost({ cwd, port: 0 });
    try {
      const response = await fetch(`${host.url}/petrinaut/launch?runId=run-1`, { redirect: 'manual' });
      const location = response.headers.get('location');

      expect(response.status).toBe(302);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(location).toBeTruthy();
      const parsed = new URL(location!);
      expect(parsed.origin).toBe('https://petrinaut.example');
      expect(parsed.pathname).toBe('/brunch');
      expect(parsed.searchParams.get('theme')).toBe('dark');
      expect(parsed.searchParams.get('runId')).toBe('run-1');
      expect(parsed.searchParams.get('sse')).toBe(`${host.url}/petrinaut/stream?runId=run-1`);
    } finally {
      await host.close();
      if (previousPetrinautUrl === undefined) delete process.env.PETRINAUT_URL;
      else process.env.PETRINAUT_URL = previousPetrinautUrl;
    }
  });

  it('rejects Petrinaut launch requests without a runId, configured URL, or stream artifacts', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-petrinaut-launch-missing-'));
    const previousPetrinautUrl = process.env.PETRINAUT_URL;
    delete process.env.PETRINAUT_URL;
    const host = await startWebHost({ cwd, port: 0 });
    try {
      const missingRunId = await fetch(`${host.url}/petrinaut/launch`);
      const missingConfig = await fetch(`${host.url}/petrinaut/launch?runId=run-1`);
      process.env.PETRINAUT_URL = 'file:///tmp/petrinaut.html';
      const invalidConfig = await fetch(`${host.url}/petrinaut/launch?runId=run-1`);
      process.env.PETRINAUT_URL = 'https://petrinaut.example/brunch';
      const unavailable = await fetch(`${host.url}/petrinaut/launch?runId=run-1`);

      expect(missingRunId.status).toBe(400);
      expect(await missingRunId.text()).toBe('Missing runId');
      expect(missingConfig.status).toBe(404);
      expect(await missingConfig.text()).toBe('Petrinaut URL not configured');
      expect(invalidConfig.status).toBe(404);
      expect(await invalidConfig.text()).toBe('Petrinaut URL not configured');
      expect(unavailable.status).toBe(404);
      expect(await unavailable.text()).toBe('Petrinaut stream not available');
    } finally {
      await host.close();
      if (previousPetrinautUrl === undefined) delete process.env.PETRINAUT_URL;
      else process.env.PETRINAUT_URL = previousPetrinautUrl;
    }
  });

  it('rejects Petrinaut launch redirects for non-loopback Host headers', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-web-petrinaut-launch-host-'));
    await writePetrinautReplayRun(cwd, 'run-1');
    const previousPetrinautUrl = process.env.PETRINAUT_URL;
    process.env.PETRINAUT_URL = 'https://petrinaut.example/brunch';
    const host = await startWebHost({ cwd, port: 0 });
    try {
      const response = await rawGetWithHost(host.url, '/petrinaut/launch?runId=run-1', 'evil.example');

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Invalid Host header');
    } finally {
      await host.close();
      if (previousPetrinautUrl === undefined) delete process.env.PETRINAUT_URL;
      else process.env.PETRINAUT_URL = previousPetrinautUrl;
    }
  });
});

async function websocketRpc(url: string, request: unknown): Promise<unknown> {
  const [response] = await websocketRpcBatch(url, [request]);
  return response;
}

async function websocketRpcBatch(url: string, requests: readonly unknown[]): Promise<unknown[]> {
  const parsed = new URL(url);
  const rpcPath = parsed.pathname === '/' ? '/rpc' : parsed.pathname;
  const socket = await openWebSocket(
    `${parsed.protocol === 'https:' ? 'wss' : 'ws'}://${parsed.host}${rpcPath}`,
  );
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
