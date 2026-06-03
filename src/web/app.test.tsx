// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceSnapshot } from '../print-snapshot.js';
import type { TranscriptDisplayProjection } from '../session/elicitation-exchange.js';
import { BrunchWebApp, createBrunchWebRuntime } from './app.js';
import type {
  WebSocketRpcClient,
  WebSocketRpcNotification,
  WebSocketRpcNotificationListener,
} from './rpc-client.js';

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

const readyProjection: TranscriptDisplayProjection = {
  rows: [
    { id: 'prompt-1', role: 'prompt', text: 'Choose the better framing.' },
    { id: 'assistant-1', role: 'assistant', text: 'What should we build?' },
    { id: 'user-1', role: 'user', text: 'A read-only dashboard.' },
  ],
};

function rpcClient(options?: {
  snapshot?: WorkspaceSnapshot;
  projection?: TranscriptDisplayProjection | (() => TranscriptDisplayProjection);
  graphOverview?: typeof emptyGraphOverview | typeof populatedGraphOverview;
  projectionError?: Error;
  calls?: RpcCall[];
  listeners?: Set<WebSocketRpcNotificationListener>;
}): WebSocketRpcClient {
  const snapshot = options?.snapshot ?? readySnapshot;
  const projection = options?.projection ?? readyProjection;
  const calls = options?.calls;
  const listeners = options?.listeners ?? new Set();
  return {
    async request<T>(method: string, params?: unknown): Promise<T> {
      calls?.push(params === undefined ? { method } : { method, params });
      if (method === 'workspace.snapshot') {
        return snapshot as T;
      }
      if (method === 'session.transcriptDisplay') {
        if (options?.projectionError) {
          throw options.projectionError;
        }
        return (typeof projection === 'function' ? projection() : projection) as T;
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

function emitNotification(
  listeners: Set<WebSocketRpcNotificationListener>,
  notification: WebSocketRpcNotification,
): void {
  for (const listener of listeners) {
    listener(notification);
  }
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

  it('requests the selected session projection explicitly', async () => {
    const calls: RpcCall[] = [];
    const runtime = createBrunchWebRuntime({ rpcClient: rpcClient({ calls }) });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('Choose the better framing.')).toBeTruthy();
    expect(screen.getByText('What should we build?')).toBeTruthy();
    expect(screen.getByText('A read-only dashboard.')).toBeTruthy();
    expect(screen.getByLabelText('prompt message')).toBeTruthy();
    expect(calls).toContainEqual({ method: 'workspace.snapshot' });
    expect(calls).toContainEqual({
      method: 'session.transcriptDisplay',
      params: { sessionId: 'session-1', specId: 1 },
    });
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

  it('renders an empty transcript display state', async () => {
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({ projection: { rows: [] } }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No transcript messages yet.')).toBeTruthy();
  });

  it('refetches selected session transcript when the RPC client reports a product update', async () => {
    const listeners = new Set<WebSocketRpcNotificationListener>();
    let projection: TranscriptDisplayProjection = { rows: [] };
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        listeners,
        projection: () => projection,
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText('No transcript messages yet.')).toBeTruthy();

    projection = {
      rows: [
        {
          id: 'prompt-2',
          role: 'prompt',
          text: 'Is this a new product or feature from scratch?',
        },
      ],
    };
    emitNotification(listeners, {
      jsonrpc: '2.0',
      method: 'brunch.updated',
      params: { topics: ['session.transcriptDisplay'] },
    });

    await waitFor(() =>
      expect(screen.getByText('Is this a new product or feature from scratch?')).toBeTruthy(),
    );
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

  it('renders read-only session projection errors', async () => {
    const runtime = createBrunchWebRuntime({
      rpcClient: rpcClient({
        projectionError: new Error('Brunch session transcript is non-linear'),
      }),
    });

    render(<BrunchWebApp runtime={runtime} />);

    expect(
      await screen.findByText('Transcript unavailable: Brunch session transcript is non-linear'),
    ).toBeTruthy();
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
