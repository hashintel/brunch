import { describe, expect, it } from 'vitest';

import { persistedUserPartsShowsComposerText } from '../persisted-user-parts-match.js';

describe('persistedUserPartsShowsComposerText', () => {
  it('matches exact persisted text', () => {
    expect(persistedUserPartsShowsComposerText('hello', 'hello')).toBe(true);
  });

  it('matches when server appended mention context block', () => {
    const composer = 'compare #G1';
    const persisted = [
      composer,
      '',
      'Mentioned items (from `#` references in the user message):',
      '- [G1] (goal) Ship it',
    ].join('\n');
    expect(persistedUserPartsShowsComposerText(composer, persisted)).toBe(true);
  });

  it('does not match unrelated persisted text', () => {
    expect(persistedUserPartsShowsComposerText('hello', 'hello world')).toBe(false);
  });

  it('does not match when bundle is empty', () => {
    expect(persistedUserPartsShowsComposerText('hello', '')).toBe(false);
  });
});
