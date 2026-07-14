import { describe, expect, it } from 'vitest';

import type { AskQuestionEcho } from '../../exchanges/schemas/index.js';
import { createLiveAskRegistry, type OpenAsk } from '../live-ask-registry.js';

function ask(exchangeId: string, overrides: Partial<OpenAsk> = {}): OpenAsk {
  const question: AskQuestionEcho = { body: `Question for ${exchangeId}` };
  return { exchangeId, mode: 'text', question, ...overrides };
}

describe('live ask registry', () => {
  it('lists an open ask with its payload while it awaits an answer', () => {
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(ask('grounding', { question: { body: 'Where do we start?' } }));

    expect(registry.reader.openAsks()).toEqual([
      { exchangeId: 'grounding', mode: 'text', question: { body: 'Where do we start?' } },
    ]);
    expect(registry.reader.stateOf('grounding')).toBe('open');
  });

  it('distinguishes a live exchange id from a stale or unknown one', () => {
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(ask('live'));

    expect(registry.reader.stateOf('live')).toBe('open');
    expect(registry.reader.stateOf('never-seen')).toBe('closed');
  });

  it('resolves the awaiting promise and transitions to answered on submit', async () => {
    const registry = createLiveAskRegistry();
    const answer = registry.opener.openAsk(ask('domain'));

    expect(registry.answerer.submitAnswer({ exchangeId: 'domain', answer: 'billing' })).toEqual({
      submitted: true,
    });
    await expect(answer).resolves.toBe('billing');
    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('domain')).toBe('answered');
  });

  it('is idempotent under double-answer: the second submit reports no pending exchange', async () => {
    const registry = createLiveAskRegistry();
    const answer = registry.opener.openAsk(ask('once'));

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
    const answer = registry.opener.openAsk(ask('interrupted'));

    registry.cancel('interrupted');
    await expect(answer).resolves.toBeUndefined();
    expect(registry.reader.openAsks()).toEqual([]);
    expect(registry.reader.stateOf('interrupted')).toBe('cancelled');
  });

  it('clears every open ask on teardown so a resumed process rediscovers nothing', async () => {
    const registry = createLiveAskRegistry();
    const first = registry.opener.openAsk(ask('a'));
    const second = registry.opener.openAsk(ask('b'));

    registry.cancelAll();

    await expect(first).resolves.toBeUndefined();
    await expect(second).resolves.toBeUndefined();
    expect(registry.reader.openAsks()).toEqual([]);
  });

  it('rejects opening two asks under the same exchange id', () => {
    const registry = createLiveAskRegistry();
    void registry.opener.openAsk(ask('dup'));
    expect(() => registry.opener.openAsk(ask('dup'))).toThrow(/already/);
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

  it('answers choice and review modes through the same string broker contract', async () => {
    const registry = createLiveAskRegistry();
    const choice = registry.opener.openAsk(
      ask('mode-choice', {
        mode: 'single-select',
        question: { body: 'Pick one', options: [{ id: 'a', label: 'A' }] },
      }),
    );
    const review = registry.opener.openAsk(ask('mode-review', { mode: 'review' }));

    expect(registry.reader.openAsks().map((entry) => entry.mode)).toEqual(['single-select', 'review']);
    registry.answerer.submitAnswer({ exchangeId: 'mode-choice', answer: 'a' });
    registry.answerer.submitAnswer({ exchangeId: 'mode-review', answer: 'approve' });
    await expect(choice).resolves.toBe('a');
    await expect(review).resolves.toBe('approve');
  });
});
