import { describe, expect, it, vi } from 'vitest';

import type { AskQuestionEcho } from '../../exchanges/schemas/index.js';
import { createLiveAskRegistry, type OpenAsk } from '../live-ask-registry.js';

const liveSignal = (): AbortSignal => new AbortController().signal;

function ask(exchangeId: string, overrides: Partial<OpenAsk> = {}): OpenAsk {
  const question: AskQuestionEcho = { body: `Question for ${exchangeId}` };
  return { exchangeId, mode: 'text', question, ...overrides };
}

describe('live ask registry', () => {
  it('lists an open ask with its payload while it awaits an answer', () => {
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(
      ask('grounding', { question: { body: 'Where do we start?' } }),
      liveSignal(),
    );

    expect(registry.reader.openAsks()).toEqual([
      { exchangeId: 'grounding', mode: 'text', question: { body: 'Where do we start?' } },
    ]);
    expect(registry.reader.stateOf('grounding')).toBe('open');
  });

  it('distinguishes a live exchange id from a stale or unknown one', () => {
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(ask('live'), liveSignal());

    expect(registry.reader.stateOf('live')).toBe('open');
    expect(registry.reader.stateOf('never-seen')).toBe('closed');
  });

  it('resolves the awaiting promise and transitions to answered on submit', async () => {
    const registry = createLiveAskRegistry();
    const answer = registry.opener.openAsk(ask('domain'), liveSignal());

    expect(registry.answerer.submitAnswer({ exchangeId: 'domain', answer: 'billing' })).toEqual({
      submitted: true,
    });
    await expect(answer).resolves.toBe('billing');
    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('domain')).toBe('answered');
  });

  it('is idempotent under double-answer: the second submit reports no pending exchange', async () => {
    const registry = createLiveAskRegistry();
    const answer = registry.opener.openAsk(ask('once'), liveSignal());

    expect(registry.answerer.submitAnswer({ exchangeId: 'once', answer: 'first' })).toEqual({
      submitted: true,
    });
    await expect(answer).resolves.toBe('first');
    expect(registry.answerer.submitAnswer({ exchangeId: 'once', answer: 'second' })).toEqual({
      submitted: false,
      reason: 'no_pending_exchange',
    });
    expect(registry.reader.stateOf('once')).toBe('answered');
  });

  it('cancels an open ask, resolving undefined and clearing it from discovery', async () => {
    const registry = createLiveAskRegistry();
    const answer = registry.opener.openAsk(ask('interrupted'), liveSignal());

    registry.cancel('interrupted');
    await expect(answer).resolves.toBeUndefined();
    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('interrupted')).toBe('cancelled');
  });

  it('cancels an already-aborted ask without exposing it for discovery', async () => {
    const registry = createLiveAskRegistry();
    const controller = new AbortController();
    controller.abort();

    const answer = registry.opener.openAsk(ask('already-aborted'), controller.signal);

    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('already-aborted')).toBe('cancelled');
    await expect(answer).resolves.toBeUndefined();
  });

  it('does not lose an abort delivered while its listener is being installed', async () => {
    const registry = createLiveAskRegistry();
    const controller = new AbortController();
    const installListener = controller.signal.addEventListener.bind(controller.signal);
    vi.spyOn(controller.signal, 'addEventListener').mockImplementation((...args) => {
      installListener(...args);
      controller.abort();
    });

    const answer = registry.opener.openAsk(ask('installation-race'), controller.signal);

    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('installation-race')).toBe('cancelled');
    expect(registry.answerer.submitAnswer({ exchangeId: 'installation-race', answer: 'too late' })).toEqual({
      submitted: false,
      reason: 'no_pending_exchange',
    });
    await expect(answer).resolves.toBeUndefined();
  });

  it('synchronously cancels on abort and rejects a later answer', async () => {
    const registry = createLiveAskRegistry();
    const controller = new AbortController();
    const answer = registry.opener.openAsk(ask('aborted'), controller.signal);

    controller.abort();

    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('aborted')).toBe('cancelled');
    expect(registry.answerer.submitAnswer({ exchangeId: 'aborted', answer: 'too late' })).toEqual({
      submitted: false,
      reason: 'no_pending_exchange',
    });
    await expect(answer).resolves.toBeUndefined();
  });

  it('removes the abort listener after answer and explicit cancellation', async () => {
    const registry = createLiveAskRegistry();
    const answered = new AbortController();
    const cancelled = new AbortController();
    const answeredRemove = vi.spyOn(answered.signal, 'removeEventListener');
    const cancelledRemove = vi.spyOn(cancelled.signal, 'removeEventListener');
    const answer = registry.opener.openAsk(ask('answered-cleanup'), answered.signal);
    const cancellation = registry.opener.openAsk(ask('cancelled-cleanup'), cancelled.signal);

    registry.answerer.submitAnswer({ exchangeId: 'answered-cleanup', answer: 'done' });
    registry.cancel('cancelled-cleanup');

    await expect(answer).resolves.toBe('done');
    await expect(cancellation).resolves.toBeUndefined();
    expect(answeredRemove).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(cancelledRemove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('clears every open ask on teardown so a resumed process rediscovers nothing', async () => {
    const registry = createLiveAskRegistry();
    const first = registry.opener.openAsk(ask('a'), liveSignal());
    const second = registry.opener.openAsk(ask('b'), liveSignal());

    registry.cancelAll();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(registry.reader.openAsks()).toEqual([]);
  });

  it('rejects opening two asks under the same exchange id', () => {
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(ask('dup'), liveSignal());
    expect(() => registry.opener.openAsk(ask('dup'), liveSignal())).toThrow(/already/);
  });

  it('validates questionnaire envelopes without settling invalid submissions', async () => {
    const registry = createLiveAskRegistry();
    const answer = registry.opener.openAsk(
      ask('questionnaire', {
        mode: 'questionnaire',
        question: {
          body: 'What matters?',
          questions: [{ id: 'goal', kind: 'free-text', prompt: 'What matters?' }],
        },
      }),
      liveSignal(),
    );

    expect(
      registry.answerer.submitAnswer({
        exchangeId: 'questionnaire',
        answer: JSON.stringify({ schema: 'wrong', answers: [] }),
      }),
    ).toEqual({ submitted: false, reason: 'invalid_answer' });
    expect(registry.reader.stateOf('questionnaire')).toBe('open');

    const envelope = JSON.stringify({
      schema: 'brunch.ask.questionnaire-answer',
      answers: [{ questionId: 'goal', kind: 'free-text', text: 'Clarity' }],
    });
    expect(registry.answerer.submitAnswer({ exchangeId: 'questionnaire', answer: envelope })).toEqual({
      submitted: true,
    });
    await expect(answer).resolves.toBe(envelope);
  });

  it('lists an announced ask as open but never makes it answerable here', () => {
    const registry = createLiveAskRegistry();
    const observed: OpenAsk[] = [];
    registry.subscribe((entry) => observed.push(entry));
    const announced = ask('tui-owned', { question: { body: 'Which shape should we take?' } });

    const conclude = registry.opener.announceAsk(announced);

    expect(registry.reader.openAsks()).toEqual([announced]);
    expect(registry.reader.stateOf('tui-owned')).toBe('open');
    expect(observed).toEqual([announced]);
    // The local UI holding this ask is its only answering authority; a remote
    // observer that tries to answer must be refused rather than silently
    // resolving a rendezvous that does not exist.
    expect(registry.answerer.submitAnswer({ exchangeId: 'tui-owned', answer: 'from the browser' })).toEqual({
      submitted: false,
      reason: 'no_pending_exchange',
    });

    conclude();

    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('tui-owned')).toBe('closed');
    expect(observed).toEqual([announced]);
  });

  it('leaves the opener rendezvous untouched while an announcement is open', async () => {
    const registry = createLiveAskRegistry();
    const conclude = registry.opener.announceAsk(ask('announced'));
    const answer = registry.opener.openAsk(ask('headless'), liveSignal());

    expect(registry.reader.openAsks().map((entry) => entry.exchangeId)).toEqual(['headless', 'announced']);
    expect(registry.answerer.submitAnswer({ exchangeId: 'headless', answer: 'still works' })).toEqual({
      submitted: true,
    });
    await expect(answer).resolves.toBe('still works');

    conclude();
    expect(registry.reader.openAsks()).toEqual([]);
  });

  it('clears announcements on teardown alongside pending asks', () => {
    const registry = createLiveAskRegistry();
    registry.opener.announceAsk(ask('announced-teardown'));

    registry.cancelAll();

    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('announced-teardown')).toBe('closed');
  });

  it('answers choice and review modes through the same string broker contract', async () => {
    const registry = createLiveAskRegistry();
    const choice = registry.opener.openAsk(
      ask('mode-choice', {
        mode: 'single-select',
        question: { body: 'Pick one', options: [{ id: 'a', label: 'A' }] },
      }),
      liveSignal(),
    );
    const review = registry.opener.openAsk(ask('mode-review', { mode: 'review' }), liveSignal());

    expect(registry.reader.openAsks().map((entry) => entry.mode)).toEqual(['single-select', 'review']);
    registry.answerer.submitAnswer({ exchangeId: 'mode-choice', answer: 'a' });
    registry.answerer.submitAnswer({ exchangeId: 'mode-review', answer: 'approve' });
    await expect(choice).resolves.toBe('a');
    await expect(review).resolves.toBe('approve');
  });
});
