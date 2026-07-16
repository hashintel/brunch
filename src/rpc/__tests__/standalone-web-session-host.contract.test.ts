import { describe, expect, it, vi } from 'vitest';

import type { LiveSessionEvent, LiveSessionHost } from '../../session/live-session-host.js';
import { createWebSidecarRpcHandlers } from '../handlers.js';
import { createLiveSessionEventFrame, liveSessionEventSchema } from '../live-session-contract.js';
import type { HostedSessionRpcBoundary } from '../methods/hosted-session.js';

const target = { specId: 1, sessionId: 'session-1' };

function boundary(): HostedSessionRpcBoundary {
  const liveSessions = {
    open: vi.fn(async () => ({ status: 'opened' as const })),
    close: vi.fn(async () => ({ status: 'closed' as const })),
    driveTurn: vi.fn(async () => ({ status: 'completed' as const })),
    openAsks: vi.fn(() => []),
    answerExchange: vi.fn(() => ({ status: 'completed' as const })),
    subscribeAll: vi.fn(() => () => {}),
    dispose: vi.fn(async () => {}),
  } satisfies LiveSessionHost;
  return {
    liveSessions,
    project: vi.fn(async (requested) => ({
      status: 'ready' as const,
      presentation: { target: requested, cursor: null, entries: [] },
    })),
  };
}

function coordinator() {
  return {
    openDefaultWorkspace: vi.fn(),
    inspectWorkspace: vi.fn(),
    activateWorkspace: vi.fn(),
  } as never;
}

describe('standalone hosted-session RPC contract', () => {
  it('advertises the same precise session.openAsks result as the sidecar', async () => {
    const standalone = createWebSidecarRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp',
      hostedSession: boundary(),
    });
    const sidecar = createWebSidecarRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp',
      sessionOpenAsks: { reader: { openAsks: () => [], stateOf: () => 'cancelled' } },
    });

    async function advertisedOpenAsksResult(handlers: typeof standalone): Promise<unknown> {
      const discovery = await handlers.handle({ jsonrpc: '2.0', id: 1, method: 'rpc.discover' });
      const methods = (discovery as { result?: { methods?: { method: string; resultSchema: unknown }[] } })
        .result?.methods;
      return methods?.find(({ method }) => method === 'session.openAsks')?.resultSchema;
    }

    const standaloneResult = await advertisedOpenAsksResult(standalone);
    const sidecarResult = await advertisedOpenAsksResult(sidecar);
    expect(standaloneResult).toEqual(sidecarResult);
    expect(standaloneResult).toMatchObject({
      additionalProperties: false,
      properties: { openAsks: { type: 'array' } },
      required: ['openAsks'],
      type: 'object',
    });
  });

  it('round-trips every semantic delta, including both exact question alternatives', () => {
    const events: LiveSessionEvent[] = [
      { target, seq: 0, delta: { type: 'assistant_text_delta' as const, runId: 'run-1', text: 'Hello' } },
      {
        target,
        seq: 1,
        delta: {
          type: 'ask_opened' as const,
          ask: { exchangeId: 'ask-text', mode: 'text' as const, question: { body: 'Continue?' } },
        },
      },
      {
        target,
        seq: 2,
        delta: {
          type: 'ask_opened' as const,
          ask: {
            exchangeId: 'ask-questionnaire',
            mode: 'questionnaire' as const,
            question: {
              body: 'Complete the questionnaire.',
              questions: [{ id: 'q1', kind: 'free-text' as const, prompt: 'Why?' }],
            },
          },
        },
      },
      { target, seq: 3, delta: { type: 'agent_settled' as const } },
    ];

    for (const event of events) {
      expect(liveSessionEventSchema.parse(createLiveSessionEventFrame(event).params)).toEqual(event);
    }
  });

  it('rejects targetless lifecycle, driver, ask, answer, and presentation requests', async () => {
    const handlers = createWebSidecarRpcHandlers({
      coordinator: coordinator(),
      cwd: '/tmp',
      hostedSession: boundary(),
    });
    for (const method of [
      'session.open',
      'session.close',
      'session.presentation',
      'session.openAsks',
      'session.driveTurn',
      'session.answerExchange',
    ]) {
      const response = await handlers.handle({ jsonrpc: '2.0', id: method, method, params: {} });
      expect(response).toMatchObject({ error: { code: -32602 } });
    }
  });

  it('preserves the explicit target and driver through every command/query', async () => {
    const hostedSession = boundary();
    const handlers = createWebSidecarRpcHandlers({ coordinator: coordinator(), cwd: '/tmp', hostedSession });
    await handlers.handle({ jsonrpc: '2.0', id: 1, method: 'session.open', params: target });
    await handlers.handle({ jsonrpc: '2.0', id: 2, method: 'session.presentation', params: target });
    await handlers.handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'session.driveTurn',
      params: { ...target, driverId: 'browser-a', prompt: 'Hi' },
    });
    await handlers.handle({
      jsonrpc: '2.0',
      id: 4,
      method: 'session.answerExchange',
      params: { ...target, driverId: 'browser-a', exchangeId: 'ask-1', answer: 'Yes' },
    });
    expect(hostedSession.liveSessions.open).toHaveBeenCalledWith(target);
    expect(hostedSession.project).toHaveBeenCalledWith(target);
    expect(hostedSession.liveSessions.driveTurn).toHaveBeenCalledWith(target, 'browser-a', 'Hi');
    expect(hostedSession.liveSessions.answerExchange).toHaveBeenCalledWith(
      target,
      'browser-a',
      'ask-1',
      'Yes',
    );
  });
});
