import { describe, expect, it, vi } from 'vitest';

import type { LiveExchangeAnswerOutcome } from '../live-exchange-broker.js';
import {
  ActiveLiveSessionError,
  createLiveSessionHost,
  type LiveSessionEvent,
  type LiveSessionRuntime,
} from '../live-session-host.js';

const target = { specId: 7, sessionId: 'session-a' };

function runtime(): LiveSessionRuntime {
  return {
    prompt: vi.fn(async () => {}),
    openAsks: () => [],
    answerExchange: (): LiveExchangeAnswerOutcome => ({
      submitted: false,
      reason: 'no_pending_exchange',
    }),
    subscribe: () => () => {},
    dispose: vi.fn(async () => {}),
  };
}

describe('LiveSessionHost target integrity', () => {
  it('fans out future targets and close/reopen epochs to one idempotent subscription', async () => {
    const runtimeListeners: Array<Parameters<LiveSessionRuntime['subscribe']>[0]> = [];
    const createRuntime = vi.fn(async () => {
      const created = runtime();
      created.subscribe = (listener) => {
        runtimeListeners.push(listener);
        return () => {};
      };
      return created;
    });
    const host = createLiveSessionHost({ createRuntime });
    const events: LiveSessionEvent[] = [];
    const unsubscribe = host.subscribeAll((event) => events.push(event));

    await host.open(target);
    runtimeListeners[0]!({ type: 'assistant_text_delta', runId: 'first', text: 'A' });
    runtimeListeners[0]!({ type: 'agent_settled' });
    await host.close(target);
    await host.open(target);
    runtimeListeners[1]!({ type: 'assistant_text_delta', runId: 'second', text: 'B' });

    expect(events).toEqual([
      { target, seq: 0, delta: { type: 'assistant_text_delta', runId: 'first', text: 'A' } },
      { target, seq: 1, delta: { type: 'agent_settled' } },
      { target, seq: 0, delta: { type: 'assistant_text_delta', runId: 'second', text: 'B' } },
    ]);
    unsubscribe();
    unsubscribe();
    runtimeListeners[1]!({ type: 'agent_settled' });
    expect(events).toHaveLength(3);
  });

  it('coalesces concurrent opens into exactly one writable runtime', async () => {
    const created = runtime();
    const createRuntime = vi.fn(async () => created);
    const host = createLiveSessionHost({ createRuntime });

    await expect(Promise.all([host.open(target), host.open(target)])).resolves.toEqual([
      { status: 'opened' },
      { status: 'attached' },
    ]);
    expect(createRuntime).toHaveBeenCalledTimes(1);
  });

  it('disposes a runtime that finishes opening while host disposal is in progress', async () => {
    let resolveRuntime!: (runtime: LiveSessionRuntime) => void;
    const pendingRuntime = new Promise<LiveSessionRuntime>((resolve) => {
      resolveRuntime = resolve;
    });
    const created = runtime();
    created.subscribe = vi.fn(() => () => {});
    const host = createLiveSessionHost({ createRuntime: () => pendingRuntime });

    const opening = host.open(target);
    const disposing = host.dispose();
    resolveRuntime(created);

    await expect(opening).resolves.toEqual({ status: 'opened' });
    await disposing;
    expect(created.dispose).toHaveBeenCalledOnce();
    expect(created.subscribe).not.toHaveBeenCalled();
    await expect(host.close(target)).resolves.toEqual({ status: 'not_open' });
  });

  it('rejects unaddressed/mismatched work and a second prompt while allowing a live answer', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const created = runtime();
    created.prompt = vi.fn(() => pending);
    created.openAsks = () => [{ exchangeId: 'ask-1', mode: 'text', question: { body: 'Answer?' } }];
    created.answerExchange = (exchangeId, answer) =>
      exchangeId !== 'ask-1'
        ? { submitted: false, reason: 'no_pending_exchange' }
        : answer === 'yes'
          ? { submitted: true }
          : { submitted: false, reason: 'invalid_answer' };
    const host = createLiveSessionHost({ createRuntime: async () => created });
    await host.open(target);

    const first = host.driveTurn(target, 'browser-a', 'first');
    await expect(host.driveTurn(target, 'browser-a', 'second')).resolves.toEqual({ status: 'busy' });
    await expect(host.driveTurn(target, 'browser-b', 'second')).resolves.toEqual({
      status: 'driver_conflict',
    });
    await expect(host.close(target)).resolves.toEqual({ status: 'busy' });
    await expect(host.dispose()).rejects.toEqual(new ActiveLiveSessionError([target]));
    expect(host.openAsks({ specId: 7, sessionId: 'wrong' })).toBeUndefined();
    expect(host.answerExchange(target, 'browser-b', 'ask-1', 'yes')).toEqual({
      status: 'driver_conflict',
    });
    expect(host.answerExchange(target, 'browser-a', 'ask-1', 'invalid')).toEqual({
      status: 'invalid_answer',
    });
    expect(host.answerExchange(target, 'browser-a', 'ask-1', 'yes')).toEqual({ status: 'completed' });
    expect(host.answerExchange(target, 'browser-a', 'stale', 'yes')).toEqual({ status: 'ask_closed' });
    release();
    await expect(first).resolves.toEqual({ status: 'completed' });
    await expect(host.close(target)).resolves.toEqual({ status: 'closed' });
  });
});
