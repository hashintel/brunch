// FE-800 display polish: short, deterministic label derived from a
// slice's definition. Used purely for cook progress logging — slice
// ids stay canonical for branches, depends_on, reports, and tests.

import { describe, expect, it } from 'vitest';

import { sliceLabel } from './slice-label.js';

describe('sliceLabel', () => {
  it('appends a slug derived from the first significant words of the definition', () => {
    expect(
      sliceLabel({
        id: 'req-4',
        definition:
          'Users can drag nodes to reposition them; positions persist per specification and are restored on reload.',
      }),
    ).toBe('req-4 · users-can-drag-nodes');
  });

  it('drops leading stop words so the slug starts with content', () => {
    expect(
      sliceLabel({
        id: 'req-2',
        definition:
          'The spatial canvas renders every intent item as a positioned node and every typed relationship as a drawn edge.',
      }),
    ).toBe('req-2 · spatial-canvas-renders-every');
  });

  it('cuts at the first clause boundary (comma, semicolon, period, colon)', () => {
    expect(
      sliceLabel({
        id: 'req-1',
        definition: 'Graph mode exposes a layout switch, toggling between list and canvas.',
      }),
    ).toBe('req-1 · graph-mode-exposes-layout');
  });

  it('caps the slug at ~32 characters on a word boundary', () => {
    expect(
      sliceLabel({
        id: 'req-5',
        definition: 'Canvas edges are visually distinguished by relation kind, documented by a legend.',
      }),
    ).toBe('req-5 · canvas-edges-visually');
  });

  it('returns just the id when the definition is empty or only stop words', () => {
    expect(sliceLabel({ id: 'req-7', definition: '' })).toBe('req-7');
    expect(sliceLabel({ id: 'req-7', definition: '   ' })).toBe('req-7');
    expect(sliceLabel({ id: 'req-7', definition: 'The a an to' })).toBe('req-7');
  });

  it('returns just the id when no definition is provided', () => {
    expect(sliceLabel({ id: 'req-99' })).toBe('req-99');
  });

  it('strips non-alphanumeric runs and drops sub-3-char fragments', () => {
    // "em-dash" splits into [`em`, `dash`]; `em` is too short to keep.
    expect(
      sliceLabel({
        id: 'req-3',
        definition: '`Quoted` & escaped (parens) — em-dash, weird stuff!!!',
      }),
    ).toBe('req-3 · quoted-escaped-parens-dash');
  });

  it('is stable: same definition always produces the same label', () => {
    const def = 'Pan and zoom move and scale the viewport.';
    expect(sliceLabel({ id: 'x', definition: def })).toBe(sliceLabel({ id: 'x', definition: def }));
  });
});
