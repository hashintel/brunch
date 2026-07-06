// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
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
    expect(screen.getByText('worktree')).toBeTruthy();
    expect(screen.getByText('petri')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'execute.run', params: { runId: 'run-1' } });
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
