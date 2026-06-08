// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceSnapshot } from '../print-snapshot.js';
import { BrunchWebApp, createBrunchWebRuntime } from './app.js';
import type { WebSocketRpcClient, WebSocketRpcNotificationListener } from './rpc-client.js';

interface RpcCall {
  method: string;
  params?: unknown;
}

const readySnapshot: WorkspaceSnapshot = {
  status: 'ready',
  cwd: '/tmp/brunch-project',
  spec: { id: 1, title: 'Web spec' },
  session: { id: 'session-1', file: '/tmp/session.jsonl' },
  chrome: {
    phase: 'elicitation',
    chatMode: 'responding-to-elicitation',
  },
};

const selectSpecSnapshot: WorkspaceSnapshot = {
  status: 'select_spec',
  cwd: '/tmp/brunch-project',
  spec: null,
  chrome: {
    phase: 'select_spec',
    chatMode: 'select-spec',
  },
};
const selectedSpecWithoutSessionSnapshot: WorkspaceSnapshot = {
  status: 'select_spec',
  cwd: '/tmp/brunch-project',
  spec: { id: 2, title: 'Spec without session' },
  chrome: {
    phase: 'select_spec',
    chatMode: 'select-spec',
  },
};

const emptyGraphOverview = {
  nodes: [],
  edges: [],
  nodeCount: 0,
  edgeCount: 0,
  lsn: 0,
};

const populatedGraphOverview = {
  nodes: [
    {
      id: 10,
      specId: 1,
      plane: 'intent',
      kind: 'requirement',
      title: 'Spec A requirement',
      basis: 'explicit',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
    {
      id: 11,
      specId: 1,
      plane: 'intent',
      kind: 'assumption',
      title: 'Spec A assumption',
      basis: 'explicit',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
  ],
  edges: [
    {
      id: 20,
      specId: 1,
      category: 'support',
      sourceId: 11,
      targetId: 10,
      stance: 'supports',
      basis: 'explicit',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
  ],
  nodeCount: 2,
  edgeCount: 1,
  lsn: 1,
};
function rpcClient(options?: {
  snapshot?: WorkspaceSnapshot;
  graphOverview?: typeof emptyGraphOverview | typeof populatedGraphOverview;
  calls?: RpcCall[];
  listeners?: Set<WebSocketRpcNotificationListener>;
  close?: ReturnType<typeof vi.fn>;
}): WebSocketRpcClient {
  const snapshot = options?.snapshot ?? readySnapshot;
  const calls = options?.calls;
  const listeners = options?.listeners ?? new Set();
  return {
    async request<T>(method: string, params?: unknown): Promise<T> {
      calls?.push(params === undefined ? { method } : { method, params });
      if (method === 'workspace.snapshot') {
        return snapshot as T;
      }
      if (method === 'session.runtimeState') {
        throw new Error('session.runtimeState is not implemented in this test client');
      }
      if (method === 'graph.overview') {
        return (options?.graphOverview ?? emptyGraphOverview) as T;
      }
      throw new Error(`unexpected RPC method ${method}`);
    },
    subscribe(listener: WebSocketRpcNotificationListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: options?.close ?? vi.fn(),
  } as unknown as WebSocketRpcClient;
}

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

describe('Brunch React web app', () => {
  it('renders workspace chrome from workspace.snapshot via the RPC client', async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('/tmp/brunch-project')).toBeTruthy();
    expect(screen.getByText('Web spec')).toBeTruthy();
    expect(screen.getByText('session-1')).toBeTruthy();
    expect(screen.getByText('elicitation')).toBeTruthy();
    expect(screen.getByText('responding-to-elicitation')).toBeTruthy();
  });

  it('renders selected session identity without requesting session projections', async () => {
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Attached session: session-1')).toBeTruthy();
    expect(screen.getByText('Spec 1')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
  });

  it('loads the spec route through Query-backed graph RPC options', async () => {
    window.history.pushState(null, '', '/spec/1');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Graph overview')).toBeTruthy();
    expect(screen.getByText('Spec A assumption')).toBeTruthy();
    expect(screen.getAllByText('intent / assumption').length).toBeGreaterThan(0);
    expect(screen.getAllByText('intent / requirement').length).toBeGreaterThan(0);
    expect(screen.getByText('support: 1')).toBeTruthy();
    fireEvent.click(screen.getAllByText('Focus node')[0]!);
    expect(screen.getByText('Focused read pending: graph.nodeNeighborhood(1, 11, 1)')).toBeTruthy();
  });

  it('invalidates the exact selected-spec graph overview query on graph notifications', async () => {
    window.history.pushState(null, '', '/spec/1');
    const calls: RpcCall[] = [];
    const listeners = new Set<WebSocketRpcNotificationListener>();
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, listeners, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Spec A requirement')).toBeTruthy();
    calls.length = 0;
    for (const listener of listeners) {
      listener({
        jsonrpc: '2.0',
        method: 'brunch.updated',
        params: { updates: [{ topic: 'graph.overview', specId: 1 }] },
      });
    }

    await waitFor(() => expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 1 } }));
    expect(screen.getByText('Spec A requirement')).toBeTruthy();
    expect(calls).toEqual([{ method: 'graph.overview', params: { specId: 1 } }]);
  });

  it('ignores malformed product update entries instead of broadly invalidating graph reads', async () => {
    window.history.pushState(null, '', '/spec/1');
    const calls: RpcCall[] = [];
    const listeners = new Set<WebSocketRpcNotificationListener>();
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, listeners, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Spec A requirement')).toBeTruthy();
    calls.length = 0;
    for (const listener of listeners) {
      listener({
        jsonrpc: '2.0',
        method: 'brunch.updated',
        params: { updates: [{ topic: 'graph.overview' }] },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(calls).toEqual([]);
  });

  it('rejects malformed spec route params before requesting a graph overview', async () => {
    window.history.pushState(null, '', '/spec/not-a-spec-id');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Invalid spec id.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls.some((call) => call.method === 'graph.overview')).toBe(false);
  });

  it('treats the spec route as client-local view state without borrowing the TUI session transcript', async () => {
    window.history.pushState(null, '', '/spec/2');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        calls,
        graphOverview: emptyGraphOverview,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No session is attached for viewed Spec 2.')).toBeTruthy();
    expect(screen.getByText('The TUI is active in Spec 1/session-1.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 2 } });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
    expect(calls).not.toContainEqual(expect.objectContaining({ method: 'workspace.activate' }));
  });

  it('loads the spec route without requesting session data when no session is selected', async () => {
    window.history.pushState(null, '', '/spec/2');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        snapshot: selectedSpecWithoutSessionSnapshot,
        calls,
        graphOverview: emptyGraphOverview,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Spec without session')).toBeTruthy();
    expect(screen.getByText('No graph nodes yet. LSN 0; 0 nodes; 0 edges.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 2 } });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
  });

  it('does not request session projection when no session is selected', async () => {
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ snapshot: selectSpecSnapshot, calls }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No Brunch session selected.')).toBeTruthy();
    expect(calls).toEqual([{ method: 'workspace.snapshot' }]);
  });

  it('keeps one router and QueryClient across BrunchWebApp re-renders', async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() });
    const initialRouter = runtime.router;
    const initialQueryClient = runtime.queryClient;
    const { rerender } = render(<BrunchWebApp runtime={runtime} />);
    await screen.findAllByText('Web spec');

    rerender(<BrunchWebApp runtime={runtime} />);

    expect(runtime.router).toBe(initialRouter);
    expect(runtime.queryClient).toBe(initialQueryClient);
  });

  it('disposes the root-owned RPC client', () => {
    const close = vi.fn();
    const client = rpcClient({ close });
    const runtime = createBrunchWebRuntime({ rpcClient: client });

    runtime.dispose();

    expect(close).toHaveBeenCalledOnce();
  });
});
