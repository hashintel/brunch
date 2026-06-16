import { describe, expect, it } from 'vitest';

import { selectPresenter } from './select.js';

describe('selectPresenter', () => {
  it('honors an explicit reporter flag over every environment signal', () => {
    expect(selectPresenter({ command: 'cook', isTTY: true, ci: false, reporterFlag: 'plain' })).toBe('plain');
    expect(selectPresenter({ command: 'agent', isTTY: false, ci: true, reporterFlag: 'ink' })).toBe('ink');
    expect(selectPresenter({ command: 'serve', isTTY: false, ci: true, reporterFlag: 'silent' })).toBe(
      'silent',
    );
  });

  it('forces silent for agent mode so stdout stays JSONL-clean', () => {
    expect(selectPresenter({ command: 'agent', isTTY: true, ci: false })).toBe('silent');
  });

  it('falls back to plain in CI or when stderr is not a TTY', () => {
    expect(selectPresenter({ command: 'cook', isTTY: false, ci: false })).toBe('plain');
    expect(selectPresenter({ command: 'serve', isTTY: true, ci: true })).toBe('plain');
    expect(selectPresenter({ command: 'plan', isTTY: false, ci: true })).toBe('plain');
  });

  it('selects the ink TUI only on an interactive non-CI TTY', () => {
    expect(selectPresenter({ command: 'cook', isTTY: true, ci: false })).toBe('ink');
    expect(selectPresenter({ command: 'serve', isTTY: true, ci: false })).toBe('ink');
    expect(selectPresenter({ command: 'plan', isTTY: true, ci: false })).toBe('ink');
  });
});
