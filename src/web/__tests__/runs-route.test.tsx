// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import { BrunchWebApp, createBrunchWebRuntime } from '../app.js';
import type { RunDetail, RunListEntry } from '../queries/execute.js';
import type { WebSocketRpcClient, WebSocketRpcNotificationListener } from '../rpc-client.js';

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

const runEntries: RunListEntry[] = [
  {
    runId: 'run-1',
    specId: '1',
    status: 'slice_execution_requested',
    activeSliceId: 's1',
    presence: { worktree: true, reports: true, petri: false, promotion: false },
  },
  { runId: 'run-torn', unreadable: true },
];

const runDetail: RunDetail = {
  runId: 'run-1',
  specId: '1',
  status: 'slice_execution_requested',
  activeSliceId: 's1',
  presence: { worktree: true, reports: true, petri: false, promotion: false },
  planPath: '/plan.yaml',
  reportsTail: [
    { event: 'run_ready' },
    { event: 'slice_started', sliceId: 's1' },
    { event: 'slice_execution_requested', sliceId: 's1' },
  ],
  reportsTotal: 3,
  petriEventsTail: [],
  petriEventsTotal: 0,
  agentStreamTail: [],
  agentStreamTotal: 0,
  verifyStreamTail: [],
  verifyStreamTotal: 0,
  sliceStreamInventory: [],
  sliceProgress: [{ sliceId: 's1', progress: 'started -> requested' }],
  requirements: [],
};

function rpcClient(options?: {
  runs?: RunListEntry[];
  run?: RunDetail | { runId: string; unreadable: true };
  runError?: Error;
  calls?: RpcCall[];
}): WebSocketRpcClient {
  const listeners = new Set<WebSocketRpcNotificationListener>();
  return {
    async request<T>(method: string, params?: unknown): Promise<T> {
      options?.calls?.push(params === undefined ? { method } : { method, params });
      if (method === 'workspace.state') {
        return readyState as T;
      }
      if (method === 'execute.runs') {
        return { runs: options?.runs ?? runEntries } as T;
      }
      if (method === 'execute.run') {
        if (options?.runError) {
          throw options.runError;
        }
        return (options?.run ?? runDetail) as T;
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

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

describe('runs list route', () => {
  it('lists run summaries as links and marks unreadable metadata honestly', async () => {
    window.history.pushState(null, '', '/runs');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) });

    render(<BrunchWebApp runtime={runtime} />);

    const runLink = await screen.findByRole('link', { name: /run-1/u });
    expect(runLink.getAttribute('href')).toBe('/runs/run-1');
    expect(screen.getByText(/unreadable run metadata/iu)).toBeTruthy();
    expect(calls).toContainEqual({ method: 'execute.runs' });
  });

  it('renders an empty state when no runs exist', async () => {
    window.history.pushState(null, '', '/runs');
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ runs: [] }) });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No executor runs.')).toBeTruthy();
  });
});

describe('run detail route', () => {
  it('renders crank status, honest running indicator, reports timeline, and presence flags', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) });

    render(<BrunchWebApp runtime={runtime} />);

    // The crank status renders in the header and again as the matching timeline event.
    expect(await screen.findAllByText('slice_execution_requested')).toHaveLength(2);
    expect(screen.getByText(/agent running/iu)).toBeTruthy();
    expect(screen.getByText('run_ready')).toBeTruthy();
    expect(screen.getByText('slice_started')).toBeTruthy();
    expect(screen.getByText(/3 of 3 events/u)).toBeTruthy();
    expect(screen.getByText('No requirements projected.')).toBeTruthy();
    expect(screen.getByText('No worker stream yet.')).toBeTruthy();
    expect(screen.getByText('No verify stream yet.')).toBeTruthy();
    expect(screen.getByText('worktree')).toBeTruthy();
    expect(screen.getByText('petri')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'execute.run', params: { runId: 'run-1' } });
  });

  it('renders older run detail payloads that omit evidence arrays', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const sparseRun = {
      runId: 'run-1',
      specId: '1',
      status: 'worktree_created',
      presence: { worktree: true, reports: false, petri: false, promotion: false },
      planPath: '/plan.yaml',
    } as RunDetail;
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ run: sparseRun }) });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('worktree_created')).toBeTruthy();
    expect(screen.getByText('No requirements projected.')).toBeTruthy();
    expect(screen.getByText('No worker stream yet.')).toBeTruthy();
    expect(screen.getByText('No verify stream yet.')).toBeTruthy();
    expect(screen.getAllByText(/0 of 0 events/u)).toHaveLength(3);
  });

  it('renders the raw petri net payload in a collapsed block when present', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'petri_exported',
          petriNet: { places: [{ id: 'petri-place-1' }] },
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri net (raw)')).toBeTruthy();
    expect(screen.getByText(/petri-place-1/u)).toBeTruthy();
  });

  it('renders the derived Petrinaut replay export summary when present', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'worktree_created',
          petrinautStreamPath: '/petrinaut/stream?runId=run-1',
          petrinautLaunchPath: '/petrinaut/launch?runId=run-1',
          petrinautReplayExport: {
            definition: {
              version: 1,
              meta: { generator: 'brunch', generatorVersion: 'executor-topology-v1' },
              title: 'Executor run run-1',
              places: [
                { id: 'run:created', name: 'RunCreated' },
                { id: 'run:worktree_created', name: 'RunWorktreeCreated' },
              ],
              transitions: [
                {
                  id: 'worktree_create',
                  name: 'worktree_create',
                  inputArcs: [{ placeId: 'run:created', weight: 1, type: 'standard' }],
                  outputArcs: [{ placeId: 'run:worktree_created', weight: 1 }],
                },
              ],
            },
            initialState: { 'run:created': 1 },
            transitionFirings: [
              {
                transitionId: 'worktree_create',
                input: { 'run:created': 1 },
                output: { 'run:worktree_created': 1 },
                ts: '2026-07-14T12:00:00.000Z',
              },
            ],
          },
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petrinaut replay export')).toBeTruthy();
    expect(screen.getByText('2 places • 1 transitions • 1 firings')).toBeTruthy();
    expect(screen.getByText('1 initially marked places')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'SSE replay endpoint' }).getAttribute('href')).toBe(
      '/petrinaut/stream?runId=run-1',
    );
    expect(screen.getByRole('link', { name: 'Open in Petrinaut' }).getAttribute('href')).toBe(
      '/petrinaut/launch?runId=run-1',
    );
  });

  it('renders the derived Petri projection separately from the raw net', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'promotion_prepared',
          petriProjection: {
            claimedTransitionIds: ['slice_start:task-1', 'slice_start:task-2'],
            currentMarking: { 'run:promotion_prepared': 1 },
            firedTransitionCount: 18,
            terminalEventKind: 'net_completed',
          },
          petriProjectionSource: 'snapshot',
          petriNet: { places: [{ id: 'petri-place-1' }] },
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri projection (derived)')).toBeTruthy();
    expect(screen.getByText(/run:promotion_prepared/u)).toBeTruthy();
    expect(screen.getByText(/18 fired transitions/u)).toBeTruthy();
    expect(screen.getByText(/claimed: slice_start:task-1, slice_start:task-2/u)).toBeTruthy();
    expect(screen.getByText(/source: snapshot/u)).toBeTruthy();
    expect(screen.getByText('Petri net (raw)')).toBeTruthy();
  });

  it('renders the current Petri ready frontier when execute.run returns dependency-ready steps', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'reports_initialized',
          petriReadySteps: [
            { kind: 'slice_start', sliceId: 'task-1', epicId: 'frontier-1', derivedFrom: ['REQ1'] },
            { kind: 'slice_start', sliceId: 'task-3', epicId: 'frontier-2', derivedFrom: ['REQ3'] },
          ],
          petriBlockedSteps: [
            {
              kind: 'slice_start',
              sliceId: 'task-2',
              epicId: 'frontier-1',
              derivedFrom: ['REQ2'],
              blockers: [{ kind: 'dependency', sliceId: 'task-1' }],
            },
          ],
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri frontier (derived)')).toBeTruthy();
    expect(screen.getByText(/slice_start:task-1 \(frontier-1\) ← REQ1/u)).toBeTruthy();
    expect(screen.getByText(/slice_start:task-3 \(frontier-2\) ← REQ3/u)).toBeTruthy();
    expect(screen.getByText(/slice_start:task-2 \(frontier-1\) ← REQ2 blocked by task-1/u)).toBeTruthy();
  });

  it('renders active-slice blockers when another dependency-ready slice cannot start yet', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'slice_started',
          activeSliceId: 'task-1',
          petriReadySteps: [{ kind: 'slice_execute', sliceId: 'task-1', derivedFrom: ['REQ1'] }],
          petriBlockedSteps: [
            {
              kind: 'slice_start',
              sliceId: 'task-2',
              blockers: [{ kind: 'active_slice', sliceId: 'task-1' }],
            },
          ],
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri frontier (derived)')).toBeTruthy();
    expect(screen.getByText(/slice_execute:task-1 ← REQ1/u)).toBeTruthy();
    expect(screen.getByText(/slice_start:task-2 blocked by active slice task-1/u)).toBeTruthy();
  });

  it('renders authority-unreadable framing without stale ready work', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'reports_initialized',
          petriReadySteps: [],
          petriBlockedSteps: [
            { kind: 'authority_unreadable', blockers: [{ kind: 'parallel_authority_unreadable' }] },
            {
              kind: 'slice_start',
              sliceId: 'task-1',
              blockers: [{ kind: 'parallel_authority_unreadable' }],
            },
          ],
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri frontier (derived)')).toBeTruthy();
    expect(screen.getByText(/authority_unreadable blocked by parallel authority unreadable/u)).toBeTruthy();
    expect(screen.getByText(/slice_start:task-1 blocked by parallel authority unreadable/u)).toBeTruthy();
    expect(screen.queryByText(/ready:/u)).toBeNull();
  });

  it('renders a stale-snapshot note when replay replaced a mismatched persisted marking snapshot', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'promotion_prepared',
          petriProjection: {
            currentMarking: { 'run:promotion_prepared': 1 },
            firedTransitionCount: 18,
            terminalEventKind: 'net_completed',
          },
          petriProjectionSource: 'replay',
          petriProjectionReplayReason: 'snapshot_stale',
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri projection (derived)')).toBeTruthy();
    expect(screen.getByText(/source: replay/u)).toBeTruthy();
    expect(
      screen.getByText(/persisted marking snapshot no longer matches current lifecycle facts/u),
    ).toBeTruthy();
  });

  it('renders a missing-snapshot note when replay replaced an absent or unreadable persisted marking snapshot', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          status: 'promotion_prepared',
          petriProjection: {
            currentMarking: { 'run:promotion_prepared': 1 },
            firedTransitionCount: 18,
            terminalEventKind: 'net_completed',
          },
          petriProjectionSource: 'replay',
          petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
        } as RunDetail,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Petri projection (derived)')).toBeTruthy();
    expect(screen.getByText(/source: replay/u)).toBeTruthy();
    expect(screen.getByText(/no readable persisted marking snapshot was available/u)).toBeTruthy();
  });

  it('shows the stale-snapshot note immediately from a live execute.run cache patch before refetch settles', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const refetch = deferred<RunDetail>();
    let executeRunRequests = 0;
    const listeners = new Set<WebSocketRpcNotificationListener>();
    const client = {
      async request<T>(method: string, params?: unknown): Promise<T> {
        if (method === 'workspace.state') {
          return readyState as T;
        }
        if (method === 'execute.runs') {
          return { runs: runEntries } as T;
        }
        if (method === 'execute.run') {
          expect(params).toEqual({ runId: 'run-1' });
          executeRunRequests += 1;
          if (executeRunRequests === 1) {
            return {
              ...runDetail,
              status: 'promotion_prepared',
              petriProjection: {
                claimedTransitionIds: ['slice_start:t1'],
                currentMarking: { 'run:promotion_prepared': 1 },
                firedTransitionCount: 18,
                terminalEventKind: 'net_completed',
              },
              petriProjectionSource: 'snapshot',
            } as T;
          }
          return (await refetch.promise) as T;
        }
        throw new Error(`unexpected RPC method ${method}`);
      },
      subscribe(listener: WebSocketRpcNotificationListener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: vi.fn(),
    } as WebSocketRpcClient;
    const runtime = createBrunchWebRuntime({ rpcClient: client });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/source: snapshot/u)).toBeTruthy();
    expect(screen.getByText(/claimed: slice_start:t1/u)).toBeTruthy();
    expect(listeners.size).toBeGreaterThan(0);

    await act(async () => {
      for (const listener of listeners) {
        listener({
          jsonrpc: '2.0',
          method: 'brunch.updated',
          params: {
            topics: ['execute.run'],
            updates: [
              {
                topic: 'execute.run',
                runId: 'run-1',
                petriProjection: {
                  currentMarking: { 'run:promotion_prepared': 1 },
                  firedTransitionCount: 18,
                  terminalEventKind: 'net_completed',
                  terminalTs: '2026-07-14T12:00:00.000Z',
                  failedSliceIds: [],
                },
                petriProjectionSource: 'replay',
                petriProjectionReplayReason: 'snapshot_stale',
              },
            ],
          },
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/source: replay/u)).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/persisted marking snapshot no longer matches current lifecycle facts/u),
      ).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByText(/claimed: slice_start:t1/u)).toBeNull();
    });

    refetch.resolve({
      ...runDetail,
      status: 'promotion_prepared',
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_stale',
    });
  });

  it('shows the missing-snapshot note immediately from a live execute.run cache patch before refetch settles', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const refetch = deferred<RunDetail>();
    let executeRunRequests = 0;
    const listeners = new Set<WebSocketRpcNotificationListener>();
    const client = {
      async request<T>(method: string, params?: unknown): Promise<T> {
        if (method === 'workspace.state') {
          return readyState as T;
        }
        if (method === 'execute.runs') {
          return { runs: runEntries } as T;
        }
        if (method === 'execute.run') {
          expect(params).toEqual({ runId: 'run-1' });
          executeRunRequests += 1;
          if (executeRunRequests === 1) {
            return {
              ...runDetail,
              status: 'promotion_prepared',
              petriProjection: {
                currentMarking: { 'run:promotion_prepared': 1 },
                firedTransitionCount: 18,
                terminalEventKind: 'net_completed',
              },
              petriProjectionSource: 'snapshot',
            } as T;
          }
          return (await refetch.promise) as T;
        }
        throw new Error(`unexpected RPC method ${method}`);
      },
      subscribe(listener: WebSocketRpcNotificationListener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: vi.fn(),
    } as WebSocketRpcClient;
    const runtime = createBrunchWebRuntime({ rpcClient: client });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/source: snapshot/u)).toBeTruthy();
    expect(listeners.size).toBeGreaterThan(0);

    await act(async () => {
      for (const listener of listeners) {
        listener({
          jsonrpc: '2.0',
          method: 'brunch.updated',
          params: {
            topics: ['execute.run'],
            updates: [
              {
                topic: 'execute.run',
                runId: 'run-1',
                petriProjectionSource: 'replay',
                petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
              },
            ],
          },
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/source: replay/u)).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText(/no readable persisted marking snapshot was available/u)).toBeTruthy();
    });

    refetch.resolve({
      ...runDetail,
      status: 'promotion_prepared',
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'replay',
      petriProjectionReplayReason: 'snapshot_missing_or_unreadable',
    });
  });

  it('clears a replay note immediately when a later live execute.run snapshot hint sets replay reason to null', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const refetch = deferred<RunDetail>();
    let executeRunRequests = 0;
    const listeners = new Set<WebSocketRpcNotificationListener>();
    const client = {
      async request<T>(method: string, params?: unknown): Promise<T> {
        if (method === 'workspace.state') {
          return readyState as T;
        }
        if (method === 'execute.runs') {
          return { runs: runEntries } as T;
        }
        if (method === 'execute.run') {
          expect(params).toEqual({ runId: 'run-1' });
          executeRunRequests += 1;
          if (executeRunRequests === 1) {
            return {
              ...runDetail,
              status: 'promotion_prepared',
              petriProjection: {
                currentMarking: { 'run:promotion_prepared': 1 },
                firedTransitionCount: 18,
                terminalEventKind: 'net_completed',
              },
              petriProjectionSource: 'replay',
              petriProjectionReplayReason: 'snapshot_stale',
            } as T;
          }
          return (await refetch.promise) as T;
        }
        throw new Error(`unexpected RPC method ${method}`);
      },
      subscribe(listener: WebSocketRpcNotificationListener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      close: vi.fn(),
    } as WebSocketRpcClient;
    const runtime = createBrunchWebRuntime({ rpcClient: client });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/source: replay/u)).toBeTruthy();
    expect(
      screen.getByText(/persisted marking snapshot no longer matches current lifecycle facts/u),
    ).toBeTruthy();
    expect(listeners.size).toBeGreaterThan(0);

    await act(async () => {
      for (const listener of listeners) {
        listener({
          jsonrpc: '2.0',
          method: 'brunch.updated',
          params: {
            topics: ['execute.run'],
            updates: [
              {
                topic: 'execute.run',
                runId: 'run-1',
                petriProjectionSource: 'snapshot',
                petriProjectionReplayReason: null,
              },
            ],
          },
        });
      }
    });

    await waitFor(() => {
      expect(screen.getByText(/source: snapshot/u)).toBeTruthy();
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/persisted marking snapshot no longer matches current lifecycle facts/u),
      ).toBeNull();
    });

    refetch.resolve({
      ...runDetail,
      status: 'promotion_prepared',
      petriProjection: {
        currentMarking: { 'run:promotion_prepared': 1 },
        firedTransitionCount: 18,
        terminalEventKind: 'net_completed',
      },
      petriProjectionSource: 'snapshot',
    });
  });

  it('renders normalized worker stream events when present', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          agentStreamTail: [
            {
              event: 'agent_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 's1',
              sequence: 0,
              kind: 'status',
              message: 'worker worker starting',
            },
            {
              event: 'agent_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 's1',
              sequence: 1,
              kind: 'message',
              message: 'Created src/types.ts',
            },
          ],
          agentStreamTotal: 2,
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/Worker stream — showing 2 of 2 events/u)).toBeTruthy();
    expect(screen.getByText('Created src/types.ts')).toBeTruthy();
  });

  it('collapses noisy worker stream repeats while keeping raw events available', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          agentStreamTail: [
            {
              event: 'agent_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 'task-8',
              sequence: 10,
              kind: 'message',
              message: 'Now I',
            },
            {
              event: 'agent_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 'task-8',
              sequence: 11,
              kind: 'message',
              message: "Now I'll write the result file to report completion.",
            },
            {
              event: 'agent_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 'task-8',
              sequence: 12,
              kind: 'message',
              message:
                "Now I'll write the result file to report completion.\n\n**Slice task-8** (frontier-1)",
            },
          ],
          agentStreamTotal: 3,
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(
      await screen.findByText((_, element) =>
        Boolean(
          element?.tagName === 'P' &&
          element.textContent ===
            "Now I'll write the result file to report completion.\n\nSlice task-8 (frontier-1)",
        ),
      ),
    ).toBeTruthy();
    expect(screen.queryByText('x3')).toBeNull();
    expect(screen.queryByText('Now I')).toBeNull();
    expect(screen.getByText('Raw Worker stream events')).toBeTruthy();
  });

  it('renders projected requirement statuses when present', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          sliceProgress: [
            { sliceId: 'task-1', progress: 'completed' },
            { sliceId: 'task-2', progress: 'completed' },
          ],
          requirements: [
            {
              requirementId: 'REQ1',
              content: 'Build the type root.',
              status: 'passed',
              sliceIds: ['task-1'],
              completedSliceIds: ['task-1'],
              failedSliceIds: [],
              missingVerificationSliceIds: [],
              criterionIds: ['AC1'],
            },
            {
              requirementId: 'REQ2',
              content: 'Build the command surface.',
              status: 'unverified',
              sliceIds: ['task-2'],
              completedSliceIds: ['task-2'],
              failedSliceIds: [],
              missingVerificationSliceIds: [],
              criterionIds: [],
            },
            {
              requirementId: 'REQ3',
              content: 'Build the active parallel member.',
              status: 'running',
              sliceIds: ['task-3'],
              completedSliceIds: [],
              failedSliceIds: [],
              missingVerificationSliceIds: [],
              criterionIds: ['AC3'],
            },
          ],
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('REQ1')).toBeTruthy();
    expect(screen.getByText('passed')).toBeTruthy();
    expect(screen.getByText('unverified')).toBeTruthy();
    expect(screen.getByText('running')).toBeTruthy();
    expect(screen.getByText('no criterion witness')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'view in graph' })[0]?.getAttribute('href')).toBe('/spec/1');
    expect(screen.getAllByRole('link', { name: 'view slice log' })[0]?.getAttribute('href')).toBe(
      '#slice-task-1',
    );
  });

  it('links failed multi-slice requirements to the failed slice log', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          sliceProgress: [
            { sliceId: 'task-1', progress: 'completed' },
            { sliceId: 'task-2', progress: 'verify failed' },
          ],
          requirements: [
            {
              requirementId: 'REQ1',
              content: 'Build the type root.',
              status: 'failed',
              sliceIds: ['task-1', 'task-2'],
              completedSliceIds: ['task-1'],
              failedSliceIds: ['task-2'],
              missingVerificationSliceIds: [],
              criterionIds: ['AC1'],
            },
          ],
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('REQ1')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'view slice log' }).getAttribute('href')).toBe('#slice-task-2');
  });

  it('renders normalized verify stream events when present', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          verifyStreamTail: [
            {
              event: 'verify_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 's1',
              sequence: 0,
              kind: 'status',
              message: 'npm run verify started',
            },
            {
              event: 'verify_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 's1',
              sequence: 1,
              kind: 'stdout',
              message: 'tests passed',
            },
          ],
          verifyStreamTotal: 2,
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/Verify stream — showing 2 of 2 events/u)).toBeTruthy();
    expect(screen.getByText('tests passed')).toBeTruthy();
  });

  it('renders verify failures first and strips ANSI escape codes', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          verifyStreamTail: [
            {
              event: 'verify_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 'task-8',
              sequence: 0,
              kind: 'stdout',
              message: '\u001b[32m✓\u001b[39m src/types.test.ts (3 tests)',
            },
            {
              event: 'verify_stream',
              runId: 'run-1',
              epicId: 'frontier-1',
              sliceId: 'task-8',
              sequence: 1,
              kind: 'stderr',
              message:
                '\u001b[41m FAIL \u001b[49m src/app/__tests__/brunch-tui.test.ts\nError: missing cli.js',
            },
          ],
          verifyStreamTotal: 2,
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Verify failures')).toBeTruthy();
    expect(screen.getAllByText(/FAIL\s+src\/app\/__tests__\/brunch-tui.test.ts/u).length).toBeGreaterThan(0);
    expect(document.body.textContent).not.toContain('\u001b[');
    expect(screen.getByText('Raw Verify stream events')).toBeTruthy();
  });

  it('groups lifecycle reports by slice progression while preserving raw events', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          reportsTail: [
            { event: 'slice_test_result', sliceId: 'task-1', status: 'failed' },
            { event: 'slice_completed', sliceId: 'task-1' },
          ],
          reportsTotal: 6,
          sliceProgress: [
            {
              sliceId: 'task-1',
              progress: 'started -> requested -> agent -> verify failed -> completed',
            },
          ],
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('task-1')).toBeTruthy();
    expect(screen.getByText('started -> requested -> agent -> verify failed -> completed')).toBeTruthy();
    expect(screen.getByText('Raw events')).toBeTruthy();
  });

  it('omits slice-log links when no full-log slice progress anchor exists', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
          sliceProgress: [],
          requirements: [
            {
              requirementId: 'REQ1',
              content: 'Build the type root.',
              status: 'pending',
              sliceIds: ['task-missing'],
              completedSliceIds: [],
              failedSliceIds: [],
              missingVerificationSliceIds: [],
              criterionIds: [],
            },
          ],
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('REQ1')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'view slice log' })).toBeNull();
  });

  it('omits the petri block when the payload is absent', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient() });

    render(<BrunchWebApp runtime={runtime} />);

    await screen.findByText('run_ready');
    expect(screen.queryByText('Petri net (raw)')).toBeNull();
  });

  it('shows the verify indicator while the test run is pending', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ run: { ...runDetail, status: 'agent_result_ingested' } }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/verify running/iu)).toBeTruthy();
  });

  it('marks a run with unreadable metadata instead of rendering stale detail', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ run: { runId: 'run-1', unreadable: true } }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/unreadable run metadata/iu)).toBeTruthy();
  });

  it('surfaces an unknown run as a load error, not a crash', async () => {
    window.history.pushState(null, '', '/runs/run-x');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ runError: new Error('Unknown runId') }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/could not be loaded/iu)).toBeTruthy();
    expect(screen.getByText(/Unknown runId/u)).toBeTruthy();
  });
});
