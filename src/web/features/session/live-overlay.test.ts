import { describe, expect, it } from 'vitest';

import type { SessionPresentationEntry } from '../../../projections/session/session-presentation.js';
import { mergeSessionPresentation, settleConfirmedAnswer } from './live-overlay.js';

const message = (cursor: string, text: string): SessionPresentationEntry => ({
  id: cursor,
  cursor,
  kind: 'message',
  role: 'assistant',
  text,
});

const ask = (terminal = false): SessionPresentationEntry => ({
  id: 'ask',
  cursor: 'ask',
  kind: 'ask',
  exchangeId: 'choice',
  question: 'Choose',
  options: [{ id: 'known', label: 'Known' }],
  ...(terminal
    ? {
        terminal: {
          status: 'answered' as const,
          value: {
            choice: { kind: 'listed' as const, id: 'known', label: 'Known' },
            options: [{ id: 'known', content: 'Known' }],
          },
        },
      }
    : {}),
});

describe('live ask reconciliation', () => {
  it('replaces a canonical unresolved ask with a local terminal at its canonical position', () => {
    const merged = mergeSessionPresentation(
      [message('before', 'Before'), ask(), message('after', 'After')],
      [ask(true)],
    );
    expect(merged.map((entry) => entry.cursor)).toEqual(['before', 'ask', 'after']);
    expect(merged[1]).toMatchObject({ kind: 'ask', terminal: { status: 'answered' } });
  });

  it('does not construct a malformed single-choice terminal for an unknown option', () => {
    expect(settleConfirmedAnswer([ask()], 'choice', 'unknown')).toEqual([ask()]);
  });

  it('suppresses canonical/live non-ask overlap occurrence-by-occurrence', () => {
    const canonical = [message('canonical:1', 'Repeated'), message('canonical:2', 'Repeated')];
    const exactLive = message('live:1', 'Repeated');
    const partialLive = message('live:2', 'Repeat');

    expect(mergeSessionPresentation(canonical, [exactLive, exactLive, partialLive])).toEqual([
      ...canonical,
      partialLive,
    ]);
  });

  it('matches non-ask overlap by stable identity before semantic content', () => {
    const canonical = message('shared', 'Canonical complete text');
    const live = message('shared', 'Streaming partial text');

    expect(mergeSessionPresentation([canonical], [live])).toEqual([canonical]);
  });
});
