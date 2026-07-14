// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SessionPresentationResult } from '../../projections/session/session-presentation.js';
import type { LiveSessionEvent } from '../../session/live-session-host.js';
import { BrunchWebApp, createBrunchWebRuntime } from '../app.js';
import type { WebSocketRpcClient, WebSocketRpcNotificationListener } from '../rpc-client.js';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function fixture() {
  const listeners = new Set<WebSocketRpcNotificationListener>();
  const calls: Array<{ method: string; params?: unknown }> = [];
  let reads = 0;
  const client = {
    async request<T>(method: string, params?: unknown): Promise<T> {
      calls.push({ method, params });
      if (method === 'workspace.state') {
        return {
          status: 'ready',
          cwd: '/tmp',
          spec: { id: 1, title: 'Spec' },
          session: { id: 's1', file: '/tmp/s1.jsonl' },
          chrome: {},
        } as T;
      }
      if (method === 'session.open') return { status: 'opened' } as T;
      if (method === 'session.driveTurn' || method === 'session.answerExchange')
        return { status: 'completed' } as T;
      if (method === 'session.presentation') {
        reads += 1;
        return {
          status: 'ready',
          presentation: {
            target: { specId: 1, sessionId: 's1' },
            cursor: reads > 1 ? 'durable:assistant' : 'durable:user',
            entries: [
              { id: 'u1', cursor: 'durable:user', kind: 'message', role: 'user', text: 'History' },
              ...(reads > 1
                ? [
                    {
                      id: 'a1',
                      cursor: 'durable:assistant',
                      kind: 'message' as const,
                      role: 'assistant' as const,
                      text: 'Hello',
                    },
                  ]
                : []),
            ],
          },
        } satisfies SessionPresentationResult as T;
      }
      throw new Error(`unexpected ${method}`);
    },
    subscribe(listener: WebSocketRpcNotificationListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: vi.fn(),
  } as unknown as WebSocketRpcClient;
  const emit = (event: LiveSessionEvent) => {
    for (const listener of listeners)
      listener({ jsonrpc: '2.0', method: 'brunch.sessionEvent', params: event });
  };
  return { client, calls, emit, reads: () => reads };
}

describe('session route', () => {
  it('hydrates, drives, reduces targeted live state, answers, settles, and recovers durably', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture();
    const runtime = createBrunchWebRuntime({ rpcClient: f.client });
    const rendered = render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/History/u)).toBeTruthy();
    const textarea = screen.getByRole('textbox', { name: 'Message' });
    fireEvent.change(textarea, { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true');
    expect(f.calls.some((call) => call.method === 'session.driveTurn')).toBe(true);

    await act(async () => {
      f.emit({
        target: { specId: 2, sessionId: 'other' },
        seq: 0,
        delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'Wrong' },
      });
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 0,
        delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'Hel' },
      });
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 1,
        delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'lo' },
      });
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 2,
        delta: {
          type: 'ask_opened',
          ask: { exchangeId: 'ask-1', mode: 'text', question: { body: 'Proceed?' } },
        },
      });
    });
    expect(screen.getByText(/Hello/u)).toBeTruthy();
    expect(screen.queryByText(/Wrong/u)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Proceed?' }), { target: { value: 'Yes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(f.calls.some((call) => call.method === 'session.answerExchange')).toBe(true);

    await act(async () => {
      f.emit({ target: { specId: 1, sessionId: 's1' }, seq: 3, delta: { type: 'agent_settled' } });
    });
    await waitFor(() => expect(f.reads()).toBeGreaterThan(1));
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false');
    expect(screen.getByText(/Hello/u)).toBeTruthy();

    rendered.unmount();
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);
    expect(await screen.findByText(/Hello/u)).toBeTruthy();
  });
});
