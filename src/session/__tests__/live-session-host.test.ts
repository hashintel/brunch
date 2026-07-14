import { describe, expect, it, vi } from 'vitest';

import {
  ActiveLiveSessionError,
  createLiveSessionHost,
  type LiveSessionRuntime,
} from '../live-session-host.js';

const target = { specId: 7, sessionId: 'session-a' };

function runtime(): LiveSessionRuntime {
  return {
    prompt: vi.fn(async () => {}),
    openAsks: () => [],
    answerExchange: () => false,
    subscribe: () => () => {},
    dispose: vi.fn(async () => {}),
  };
}

describe('LiveSessionHost target integrity', () => {
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

  it('rejects unaddressed/mismatched work and a second prompt while allowing a live answer', async () => {
    let release!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const created = runtime();
    created.prompt = vi.fn(() => pending);
    created.openAsks = () => [{ exchangeId: 'ask-1', mode: 'text', question: { body: 'Answer?' } }];
    created.answerExchange = (exchangeId, answer) => exchangeId === 'ask-1' && answer === 'yes';
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
    expect(host.answerExchange(target, 'browser-a', 'ask-1', 'yes')).toEqual({ status: 'completed' });
    expect(host.answerExchange(target, 'browser-a', 'stale', 'yes')).toEqual({ status: 'ask_closed' });
    release();
    await expect(first).resolves.toEqual({ status: 'completed' });
    await expect(host.close(target)).resolves.toEqual({ status: 'closed' });
  });
});
