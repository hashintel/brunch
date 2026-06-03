// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
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
  ],
  edges: [],
  nodeCount: 1,
  edgeCount: 0,
  lsn: 1,
};
function rpcClient(options?: {
  snapshot?: WorkspaceSnapshot;
  graphOverview?: typeof emptyGraphOverview | typeof populatedGraphOverview;
  calls?: RpcCall[];
  listeners?: Set<WebSocketRpcNotificationListener>;
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
    close: vi.fn(),
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

  it('renders selected session identity without requesting transcript display', async () => {
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Attached session: session-1')).toBeTruthy();
    expect(screen.getByText('Spec 1')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls).not.toContainEqual(expect.objectContaining({ method: 'session.transcriptDisplay' }));
  });

  it('loads the spec route through Query-backed graph RPC options', async () => {
    window.history.pushState(null, '', '/spec/1');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Graph overview')).toBeTruthy();
    expect(screen.getByText('Spec A requirement')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 1 } });
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
    expect(calls).not.toContainEqual({
      method: 'session.transcriptDisplay',
      params: { sessionId: 'session-1', specId: 1 },
    });
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
    expect(screen.getByText('No graph nodes yet.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 2 } });
    expect(calls).not.toContainEqual(expect.objectContaining({ method: 'session.transcriptDisplay' }));
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
    const client = rpcClient();
    const runtime = createBrunchWebRuntime({ rpcClient: client });

    runtime.dispose();

    expect(client.close).toHaveBeenCalledOnce();
  });
});
