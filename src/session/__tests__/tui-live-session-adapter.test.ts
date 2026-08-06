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
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
    });
    live.emit({ type: 'agent_settled' });

    expect(events).toEqual([
      { target, seq: 0, delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'Hello' } },
      { target, seq: 1, delta: { type: 'agent_settled' } },
    ]);
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
    expect(live.prompt).toHaveBeenCalledTimes(1);
    expect(adapter.openAsks({ ...target, sessionId: 'rival' })).toBeUndefined();
  });
});
