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
  agentStreamTail: [],
  agentStreamTotal: 0,
  verifyStreamTail: [],
  verifyStreamTotal: 0,
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
    expect(screen.getByText('x3')).toBeTruthy();
    expect(screen.queryByText('Now I')).toBeNull();
    expect(screen.getByText('Raw Worker stream events')).toBeTruthy();
  });

  it('renders projected requirement statuses when present', async () => {
    window.history.pushState(null, '', '/runs/run-1');
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        run: {
          ...runDetail,
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
          ],
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('REQ1')).toBeTruthy();
    expect(screen.getByText('passed')).toBeTruthy();
    expect(screen.getByText('unverified')).toBeTruthy();
    expect(screen.getByText('no criterion witness')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'view in graph' })[0]?.getAttribute('href')).toBe('/spec/1');
    expect(screen.getAllByRole('link', { name: 'view slice log' })[0]?.getAttribute('href')).toBe(
      '#slice-task-1',
    );
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
            { event: 'run_ready' },
            { event: 'slice_started', sliceId: 'task-1' },
            { event: 'slice_execution_requested', sliceId: 'task-1' },
            { event: 'slice_agent_result', sliceId: 'task-1' },
            { event: 'slice_test_result', sliceId: 'task-1', status: 'failed' },
            { event: 'slice_completed', sliceId: 'task-1' },
          ],
          reportsTotal: 6,
        },
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('task-1')).toBeTruthy();
    expect(screen.getByText('started -> requested -> agent -> verify failed -> completed')).toBeTruthy();
    expect(screen.getByText('Raw events')).toBeTruthy();
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
