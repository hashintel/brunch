import { describe, expect, it } from 'vitest';

import {
  composerTextFromPersistedUserParts,
  persistedUserPartsShowsComposerText,
} from './persisted-user-parts.js';

describe('composerTextFromPersistedUserParts', () => {
  it('returns text unchanged when no mention block was appended', () => {
    expect(composerTextFromPersistedUserParts('hello')).toBe('hello');
  });

  it('strips the server mention snapshot block', () => {
    const composer = 'compare #G1';
    const persisted = [
      composer,
      '',
      'Mentioned items (from `#` references in the user message):',
      '- [G1] (goal) Ship it',
    ].join('\n');
    expect(composerTextFromPersistedUserParts(persisted)).toBe(composer);
  });
});

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
});
