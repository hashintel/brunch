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
});
