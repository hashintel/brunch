import { describe, expect, it, vi } from 'vitest';

import { createLiveAskRegistry } from '../live-ask-registry.js';
import { createTuiLiveSessionAdapter } from '../tui-live-session-adapter.js';

const target = { specId: 3, sessionId: 'session-tui' };

function session() {
  let listener: ((event: never) => void) | undefined;
  return {
    prompt: vi.fn(async () => {}),
    get isStreaming() {
      return false;
    },
    subscribe: vi.fn((next: (event: never) => void) => {
      listener = next;
      return () => {
        listener = undefined;
      };
    }),
    emit(event: unknown) {
      listener?.(event as never);
    },
  };
}

describe('TUI live-session adapter', () => {
  it('exposes only the exact target and projects semantic events', async () => {
    const asks = createLiveAskRegistry();
    const adapter = createTuiLiveSessionAdapter({ target, asks });
    const live = session();
    const events: unknown[] = [];
    adapter.subscribeAll((event) => events.push(event));
    adapter.attachSession(live);

    await expect(adapter.open(target)).resolves.toEqual({ status: 'attached' });
    await expect(adapter.open({ ...target, sessionId: 'rival' })).resolves.toEqual({ status: 'not_open' });
    live.emit({ type: 'agent_start' });
    live.emit({
      type: 'message_update',
      assistantMessageEvent: { type: 'text_delta', delta: 'Hello' },
    });
    live.emit({ type: 'agent_settled' });

    expect(events).toEqual([
      { target, seq: 0, delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'Hello' } },
      { target, seq: 1, delta: { type: 'agent_settled' } },
    ]);
  });

  it('emits one target-addressed ask_opened for an ask the TUI announces', () => {
    const asks = createLiveAskRegistry();
    const adapter = createTuiLiveSessionAdapter({ target, asks });
    const events: unknown[] = [];
    adapter.subscribeAll((event) => events.push(event));
    adapter.attachSession(session());

    const announced = {
      exchangeId: 'tui-owned',
      mode: 'text',
      question: { body: 'Which shape should we take?' },
    } as const;
    const conclude = asks.opener.announceAsk(announced);

    expect(events).toEqual([{ target, seq: 0, delta: { type: 'ask_opened', ask: announced } }]);
    expect(adapter.openAsks(target)).toEqual([announced]);
    // Announcement is observation, not authority: the browser's answer path
    // must report the ask closed rather than resolving it behind the TUI.
    expect(adapter.answerExchange(target, 'browser', 'tui-owned', 'from the browser')).toEqual({
      status: 'ask_closed',
    });

    conclude();
    expect(events).toHaveLength(1);
    expect(adapter.openAsks(target)).toEqual([]);
  });

  it('supports target-addressed drive/open-ask/answer and rejects concurrent turns as busy', async () => {
    const asks = createLiveAskRegistry();
    const adapter = createTuiLiveSessionAdapter({ target, asks });
    const live = session();
    adapter.attachSession(live);

    await expect(adapter.driveTurn(target, 'browser', 'Continue')).resolves.toEqual({ status: 'completed' });
    expect(live.prompt).toHaveBeenCalledWith('Continue', {
      expandPromptTemplates: false,
      source: 'rpc',
    });

    Object.defineProperty(live, 'isStreaming', { value: true });
    await expect(adapter.driveTurn(target, 'browser', 'Rival')).resolves.toEqual({ status: 'busy' });
    await expect(adapter.close(target)).resolves.toEqual({ status: 'busy' });
    expect(live.prompt).toHaveBeenCalledTimes(1);
    expect(adapter.openAsks({ ...target, sessionId: 'rival' })).toBeUndefined();
  });

  it('enforces one browser driver per attachment epoch', async () => {
    const adapter = createTuiLiveSessionAdapter({ target, asks: createLiveAskRegistry() });
    const first = session();
    adapter.attachSession(first);

    await expect(adapter.driveTurn(target, 'browser-a', 'First')).resolves.toEqual({ status: 'completed' });
    await expect(adapter.driveTurn(target, 'browser-b', 'Rival')).resolves.toEqual({
      status: 'driver_conflict',
    });
    expect(adapter.answerExchange(target, 'browser-b', 'ask-1', 'Rival')).toEqual({
      status: 'driver_conflict',
    });

    await expect(adapter.close(target)).resolves.toEqual({ status: 'closed' });
    await expect(adapter.driveTurn(target, 'browser-b', 'After close')).resolves.toEqual({
      status: 'completed',
    });

    adapter.attachSession(session());
    await expect(adapter.driveTurn(target, 'browser-c', 'After attach')).resolves.toEqual({
      status: 'completed',
    });
    adapter.detachSession();
    adapter.attachSession(session());
    await expect(adapter.driveTurn(target, 'browser-d', 'After detach')).resolves.toEqual({
      status: 'completed',
    });
  });
});
