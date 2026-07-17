import { describe, expect, it } from 'vitest';

import { projectBorderedChrome } from '../brunch-editor.js';

const identityColor = (s: string) => s;

describe('projectBorderedChrome', () => {
  it('embeds top and bottom labels into a rounded box, leaving content lines boxed', () => {
    // Simulate Editor's real shape: plain rule, two content lines, plain rule.
    const raw = ['────────────', 'hello       ', '            ', '────────────'];
    const result = projectBorderedChrome(
      raw,
      { topRight: '[ Specify ]', bottomRight: '"Alpha"' },
      20,
      identityColor,
    );

    expect(result[0]).toContain('[ Specify ]');
    expect(result[0]?.startsWith('╭')).toBe(true);
    expect(result[0]?.endsWith('╮')).toBe(true);
    expect(result[3]).toContain('"Alpha"');
    expect(result[3]?.startsWith('╰')).toBe(true);
    expect(result[3]?.endsWith('╯')).toBe(true);
    expect(result[1]).toBe('│ hello        │');
  });

  it('pads an empty/single-line editor to at least 2 content rows', () => {
    const raw = ['──────────', 'hello     ', '──────────'];
    const result = projectBorderedChrome(raw, {}, 14, identityColor);

    // border + 2 content rows + border
    expect(result).toHaveLength(4);
    expect(result[1]).toBe('│ hello      │');
    expect(result[2]).toBe('│            │');
    expect(result[3]?.startsWith('╰')).toBe(true);
  });

  it('does not pad when the editor already has enough content rows', () => {
    const raw = ['──────────', 'line one  ', 'line two  ', 'line three', '──────────'];
    const result = projectBorderedChrome(raw, {}, 14, identityColor);

    expect(result).toHaveLength(5);
  });

  it('finds the true bottom border even when autocomplete rows follow it', () => {
    const raw = [
      '──────────',
      'query text',
      'second row',
      '──────────', // real bottom border
      'suggestion one', // autocomplete row, NOT the border
      'suggestion two',
    ];
    const result = projectBorderedChrome(
      raw,
      { topRight: '[ specify ]', bottomRight: '"Spec"' },
      30,
      identityColor,
    );

    expect(result[0]).toContain('[ specify ]');
    expect(result[3]).toContain('"Spec"');
    expect(result[3]?.startsWith('╰')).toBe(true);
    // Autocomplete rows are untouched content, boxed like any other line.
    expect(result[4]).toBe('│ suggestion one │');
    expect(result[5]).toBe('│ suggestion two │');
  });

  it('recognizes the scroll-indicator variant of the border', () => {
    const raw = ['─── ↑ 3 more ─────', 'query text', 'second row', '──────────────────'];
    const result = projectBorderedChrome(raw, { topRight: '[ specify ]' }, 20, identityColor);

    expect(result[0]).toContain('[ specify ]');
  });

  it('produces a plain rounded border when no label is given', () => {
    const raw = ['──────────', 'query text', 'second row', '──────────'];
    const result = projectBorderedChrome(raw, {}, 14, identityColor);

    expect(result[0]).toBe('╭────────────╮');
    expect(result[3]).toBe('╰────────────╯');
  });

  it('returns an empty array for empty input', () => {
    expect(projectBorderedChrome([], { topRight: '[ x ]' }, 20, identityColor)).toEqual([]);
  });
});
