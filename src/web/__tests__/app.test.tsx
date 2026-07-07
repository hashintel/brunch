// @vitest-environment jsdom

import { QueryClient } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { GraphSlice, NodeNeighborhood } from '../../graph/queries.js';
import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import { BrunchWebApp, createBrunchWebRuntime } from '../app.js';
import type { RunTraceIndex } from '../queries/execute.js';
import { graphNodeNeighborhoodQueryOptions, graphOverviewQueryOptions } from '../queries/graph.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcClient, WebSocketRpcNotificationListener } from '../rpc-client.js';
import { invalidateBrunchUpdate } from '../subscriptions/brunch-updates.js';

interface RpcCall {
  method: string;
  params?: unknown;
}

const readyState: WorkspaceState = {
  status: 'ready',
  cwd: '/tmp/brunch-project',
  spec: { id: 1, title: 'Web spec' },
  session: { id: 'session-1', file: '/tmp/session.jsonl' },
  chrome: {},
};

const selectSpecState: WorkspaceState = {
  status: 'select_spec',
  cwd: '/tmp/brunch-project',
  spec: null,
  chrome: {},
};
const selectedSpecWithoutSessionState: WorkspaceState = {
  status: 'select_spec',
  cwd: '/tmp/brunch-project',
  spec: { id: 2, title: 'Spec without session' },
  chrome: {},
};

const emptySelectionState = {
  status: 'select_spec',
  requiresSelection: true,
  cwd: '/tmp/brunch-project',
  currentSpec: null,
  currentSessionFile: null,
  needsNewSpec: true,
  specs: [],
  unavailableSessions: [],
};

const populatedSelectionState = {
  ...emptySelectionState,
  needsNewSpec: false,
  specs: [
    { spec: { id: 1, title: 'Web spec' }, sessions: [] },
    { spec: { id: 2, title: 'Second spec' }, sessions: [] },
  ],
};

const emptyGraphOverview = {
  nodes: [],
  edges: [],
  lsn: 0,
} satisfies GraphSlice;

const populatedGraphOverview = {
  nodes: [
    {
      id: 10,
      specId: 1,
      plane: 'intent',
      kind: 'requirement',
      kindOrdinal: 1,
      title: 'Spec A requirement',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
    {
      id: 11,
      specId: 1,
      plane: 'intent',
      kind: 'assumption',
      kindOrdinal: 1,
      title: 'Spec A assumption',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
  ],
  edges: [
    {
      id: 20,
      specId: 1,
      category: 'rationale',
      sourceId: 11,
      targetId: 10,
      stance: 'for',
      basis: 'explicit',
      settlement: 'settled',
      createdAtLsn: 1,
      updatedAtLsn: 1,
    },
  ],
  lsn: 1,
} satisfies GraphSlice;
const foundNeighborhood = {
  selector: { id: 11 },
  status: 'found',
  node: populatedGraphOverview.nodes[1]!,
  related: [populatedGraphOverview.nodes[0]!],
  edges: populatedGraphOverview.edges,
} satisfies NodeNeighborhood;

function rpcClient(options?: {
  state?: WorkspaceState;
  /** Live state read on every workspace.state request; takes precedence over `state`. */
  getState?: () => WorkspaceState;
  selectionState?: unknown;
  graphOverview?: GraphSlice;
  nodeNeighborhood?: NodeNeighborhood;
  runTraceIndex?: RunTraceIndex;
  runTraceIndexError?: Error;
  calls?: RpcCall[];
  listeners?: Set<WebSocketRpcNotificationListener>;
  close?: ReturnType<typeof vi.fn>;
}): WebSocketRpcClient {
  const state = options?.state ?? readyState;
  const calls = options?.calls;
  const listeners = options?.listeners ?? new Set();
  return {
    async request<T>(method: string, params?: unknown): Promise<T> {
      calls?.push(params === undefined ? { method } : { method, params });
      if (method === 'workspace.state') {
        return (options?.getState ? options.getState() : state) as T;
      }
      if (method === 'workspace.selectionState') {
        return (options?.selectionState ?? emptySelectionState) as T;
      }
      if (method === 'session.runtimeState') {
        throw new Error('session.runtimeState is not implemented in this test client');
      }
      if (method === 'graph.overview') {
        return (options?.graphOverview ?? emptyGraphOverview) as T;
      }
      if (method === 'graph.nodeNeighborhood') {
        return (options?.nodeNeighborhood ?? foundNeighborhood) as T;
      }
      if (method === 'execute.runTraceIndex') {
        if (options?.runTraceIndexError) throw options.runTraceIndexError;
        return (options?.runTraceIndex ?? { traces: [] }) as T;
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

const originalScrollToDescriptor = Object.getOwnPropertyDescriptor(window, 'scrollTo');

beforeAll(() => {
  Object.defineProperty(window, 'scrollTo', { configurable: true, value: vi.fn(), writable: true });
});

afterAll(() => {
  if (originalScrollToDescriptor) {
    Object.defineProperty(window, 'scrollTo', originalScrollToDescriptor);
  } else {
    Reflect.deleteProperty(window, 'scrollTo');
  }
});

afterEach(() => {
  cleanup();
  window.history.pushState(null, '', '/');
});

describe('Brunch React web app', () => {
  it('renders the global header and index spec list from workspace state', async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('/tmp/brunch-project')).toBeTruthy();
    expect(screen.getByText('brunch')).toBeTruthy();
    expect(screen.getByText('AI-guided spec elicitation')).toBeTruthy();
    expect(screen.getByText('No specs in this workspace.')).toBeTruthy();
  });

  it('lists workspace specs as links to their spec routes', async () => {
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ selectionState: populatedSelectionState }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    const secondSpecLink = await screen.findByRole('link', { name: /Second spec/u });
    expect(secondSpecLink.getAttribute('href')).toBe('/spec/2');
  });

  it('renders the index without requesting session projections', async () => {
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No specs in this workspace.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.state' });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
  });

  it('loads the spec route through Query-backed graph RPC options', async () => {
    window.history.pushState(null, '', '/spec/1');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Knowledge Graph')).toBeTruthy();
    expect(screen.getByText('Spec A assumption')).toBeTruthy();
    expect(screen.getByText('Spec A requirement')).toBeTruthy();
    expect(screen.getAllByText('Assumptions').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Requirements').length).toBeGreaterThan(0);
  });

  it('renders executor run badges on executable graph nodes', async () => {
    window.history.pushState(null, '', '/spec/1');
    const graphOverview = {
      nodes: [
        populatedGraphOverview.nodes[0]!,
        {
          id: 12,
          specId: 1,
          plane: 'intent',
          kind: 'criterion',
          kindOrdinal: 1,
          title: 'Type root works',
          basis: 'explicit',
          settlement: 'settled',
          createdAtLsn: 1,
          updatedAtLsn: 1,
        },
      ],
      edges: [],
      lsn: 1,
    } satisfies GraphSlice;
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        graphOverview,
        runTraceIndex: {
          traces: [
            {
              nodeCode: 'REQ1',
              runId: 'run-1',
              specId: '1',
              runStatus: 'slice_completed',
              sliceIds: ['task-1'],
              failedSliceIds: ['task-1'],
              completedSliceIds: ['task-1'],
            },
            {
              nodeCode: 'AC1',
              runId: 'run-1',
              specId: '1',
              runStatus: 'slice_completed',
              sliceIds: ['task-1'],
              failedSliceIds: ['task-1'],
              completedSliceIds: ['task-1'],
            },
          ],
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    const runLinks = await screen.findAllByRole('link', { name: /task-1 failed/u });
    expect(runLinks).toHaveLength(2);
    expect(runLinks[0]?.getAttribute('href')).toBe('/runs/run-1');
  });

  it('keeps the spec graph usable when run trace projection is unavailable', async () => {
    window.history.pushState(null, '', '/spec/1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        graphOverview: populatedGraphOverview,
        runTraceIndexError: new Error('Method not found'),
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Knowledge Graph')).toBeTruthy();
    expect(screen.getByText('Spec A requirement')).toBeTruthy();
    expect(screen.queryByText('Something went wrong!')).toBeNull();
  });

  it('derives graph overview counts from GraphSlice arrays without count aliases', async () => {
    window.history.pushState(null, '', '/spec/1');
    const graphOverview = {
      nodes: populatedGraphOverview.nodes,
      edges: populatedGraphOverview.edges,
      lsn: populatedGraphOverview.lsn,
    } satisfies GraphSlice;
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ graphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    const summary = await screen.findByLabelText('Knowledge graph summary');
    expect(summary.textContent).toContain('2 Items');
    expect(summary.textContent).toContain('1 Connection');
  });

  it('keeps graph query options typed to graph-owned RPC shapes', async () => {
    const calls: RpcCall[] = [];
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const rpc = rpcClient({
      calls,
      graphOverview: populatedGraphOverview,
      nodeNeighborhood: foundNeighborhood,
    });

    await expect(client.fetchQuery(graphOverviewQueryOptions(rpc, 1))).resolves.toEqual(
      populatedGraphOverview,
    );
    await expect(client.fetchQuery(graphNodeNeighborhoodQueryOptions(rpc, 1, 11, 2))).resolves.toEqual(
      foundNeighborhood,
    );
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 1 } });
    expect(calls).toContainEqual({
      method: 'graph.nodeNeighborhood',
      params: { specId: 1, nodeId: 11, hops: 2 },
    });
  });

  it('invalidates workspace selection state from product updates and legacy topic arrays', () => {
    const client = new QueryClient();
    const selectionKey = queryKeys.workspace.selectionState();
    client.setQueryData(selectionKey, emptySelectionState);

    invalidateBrunchUpdate(client, {
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: { updates: [{ topic: 'workspace.selectionState' }] },
    });

    expect(client.getQueryCache().find({ queryKey: selectionKey, exact: true })?.state.isInvalidated).toBe(
      true,
    );

    client.setQueryData(selectionKey, emptySelectionState);
    invalidateBrunchUpdate(client, {
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: { topics: ['workspace.selectionState'] },
    });

    expect(client.getQueryCache().find({ queryKey: selectionKey, exact: true })?.state.isInvalidated).toBe(
      true,
    );
  });

  it('refetches workspace selection state after a brunch.updated selection notification', async () => {
    const calls: RpcCall[] = [];
    const listeners = new Set<WebSocketRpcNotificationListener>();
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ calls, listeners, selectionState: populatedSelectionState }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    await screen.findByText('Second spec');
    calls.length = 0;
    for (const listener of listeners) {
      listener({
        jsonrpc: '2.0',
        method: 'brunch.updated',
        params: { updates: [{ topic: 'workspace.selectionState' }] },
      });
    }

    await waitFor(() => expect(calls).toContainEqual({ method: 'workspace.selectionState' }));
  });

  it('invalidates graph overview exactly and graph neighborhoods by selected-node prefix', () => {
    const client = new QueryClient();
    const overviewKey = queryKeys.graph.overview(1);
    const otherOverviewKey = queryKeys.graph.overview(2);
    const matchingNeighborhoodKey = queryKeys.graph.nodeNeighborhood(1, 11, 1);
    const otherNeighborhoodKey = queryKeys.graph.nodeNeighborhood(1, 12, 1);
    client.setQueryData(overviewKey, populatedGraphOverview);
    client.setQueryData(otherOverviewKey, emptyGraphOverview);
    client.setQueryData(matchingNeighborhoodKey, foundNeighborhood);
    client.setQueryData(otherNeighborhoodKey, foundNeighborhood);

    invalidateBrunchUpdate(client, {
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: { updates: [{ topic: 'graph.overview', specId: 1 }] },
    });
    invalidateBrunchUpdate(client, {
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: { updates: [{ topic: 'graph.nodeNeighborhood', specId: 1, nodeId: 11 }] },
    });

    expect(client.getQueryCache().find({ queryKey: overviewKey, exact: true })?.state.isInvalidated).toBe(
      true,
    );
    expect(
      client.getQueryCache().find({ queryKey: otherOverviewKey, exact: true })?.state.isInvalidated,
    ).toBe(false);
    expect(
      client.getQueryCache().find({ queryKey: matchingNeighborhoodKey, exact: true })?.state.isInvalidated,
    ).toBe(true);
    expect(
      client.getQueryCache().find({ queryKey: otherNeighborhoodKey, exact: true })?.state.isInvalidated,
    ).toBe(false);
  });

  it('follows a workspace spec switch when viewing the previously selected spec', async () => {
    window.history.pushState(null, '', '/spec/1');
    const listeners = new Set<WebSocketRpcNotificationListener>();
    let current: WorkspaceState = readyState; // selected spec 1
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ listeners, getState: () => current, graphOverview: populatedGraphOverview }),
    });

    render(<BrunchWebApp runtime={runtime} />);
    expect(await screen.findByText('Spec A requirement')).toBeTruthy();

    current = {
      ...readyState,
      spec: { id: 2, title: 'Second spec' },
      session: { id: 'session-2', file: '/tmp/session-2.jsonl' },
    };
    for (const listener of listeners) {
      listener({
        jsonrpc: '2.0',
        method: 'brunch.updated',
        params: { updates: [{ topic: 'workspace.state', specId: 2, sessionId: 'session-2' }] },
      });
    }

    await waitFor(() => expect(runtime.router.state.location.pathname).toBe('/spec/2'));
  });

  it('stays put on a workspace spec switch when viewing a different spec', async () => {
    window.history.pushState(null, '', '/spec/3');
    const listeners = new Set<WebSocketRpcNotificationListener>();
    let current: WorkspaceState = readyState; // selected spec 1, client browsed elsewhere
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ listeners, getState: () => current }),
    });

    render(<BrunchWebApp runtime={runtime} />);
    await waitFor(() => expect(runtime.router.state.location.pathname).toBe('/spec/3'));

    current = {
      ...readyState,
      spec: { id: 2, title: 'Second spec' },
      session: { id: 'session-2', file: '/tmp/session-2.jsonl' },
    };
    for (const listener of listeners) {
      listener({
        jsonrpc: '2.0',
        method: 'brunch.updated',
        params: { updates: [{ topic: 'workspace.state', specId: 2, sessionId: 'session-2' }] },
      });
    }

    // Web view selection stays client-local: no navigation away from spec 3.
    await waitFor(() =>
      expect(runtime.queryClient.getQueryData(queryKeys.workspace.state())).toMatchObject({
        spec: { id: 2 },
      }),
    );
    expect(runtime.router.state.location.pathname).toBe('/spec/3');
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
    expect(calls).toContainEqual({ method: 'workspace.state' });
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

    expect(await screen.findByText('No knowledge captured yet')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 2 } });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
    expect(calls).not.toContainEqual(expect.objectContaining({ method: 'workspace.activate' }));
  });

  it('loads the spec route without requesting session data when no session is selected', async () => {
    window.history.pushState(null, '', '/spec/2');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        state: selectedSpecWithoutSessionState,
        calls,
        graphOverview: emptyGraphOverview,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Spec without session')).toBeTruthy();
    expect(screen.getByText('No knowledge captured yet')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.state' });
    expect(calls).toContainEqual({ method: 'graph.overview', params: { specId: 2 } });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
  });

  it('does not request session projection when no session is selected', async () => {
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ state: selectSpecState, calls }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No specs in this workspace.')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.state' });
    expect(calls).toContainEqual({ method: 'workspace.selectionState' });
    expect(calls.some((call) => call.method.startsWith('session.'))).toBe(false);
  });

  it('keeps one router and QueryClient across BrunchWebApp re-renders', async () => {
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() });
    const initialRouter = runtime.router;
    const initialQueryClient = runtime.queryClient;
    const { rerender } = render(<BrunchWebApp runtime={runtime} />);
    await screen.findByText('No specs in this workspace.');

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
