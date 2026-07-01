import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { projectBorderedChrome } from '../brunch-editor.js';

const identityColor = (s: string) => s;

describe('projectBorderedChrome', () => {
  it('embeds top and bottom labels into a plain box, leaving content lines boxed', () => {
    // Simulate Editor's real shape: plain rule, one content line, plain rule.
    const raw = ['────────────', 'hello       ', '────────────'];
    const result = projectBorderedChrome(
      raw,
      { topRight: '[ Specify ]', bottomRight: '"Alpha"' },
      20,
      identityColor,
    );

    expect(result[0]).toContain('[ Specify ]');
    expect(result[0]?.startsWith('┌')).toBe(true);
    expect(result[0]?.endsWith('┐')).toBe(true);
    expect(result[2]).toContain('"Alpha"');
    expect(result[2]?.startsWith('└')).toBe(true);
    expect(result[2]?.endsWith('┘')).toBe(true);
    expect(result[1]).toBe('│ hello        │');
  });

  it('finds the true bottom border even when autocomplete rows follow it', () => {
    const raw = [
      '──────────',
      'query text',
      '──────────', // real bottom border
      'suggestion one', // autocomplete row, NOT the border
      'suggestion two',
    ];
    const result = projectBorderedChrome(
      raw,
      { topRight: '[ elicit ]', bottomRight: '"Spec"' },
      30,
      identityColor,
    );

    expect(result[0]).toContain('[ elicit ]');
    expect(result[2]).toContain('"Spec"');
    expect(result[2]?.startsWith('└')).toBe(true);
    // Autocomplete rows are untouched content, boxed like any other line.
    expect(result[3]).toBe('│ suggestion one │');
    expect(result[4]).toBe('│ suggestion two │');
  });

  it('recognizes the scroll-indicator variant of the border', () => {
    const raw = ['─── ↑ 3 more ─────', 'query text', '──────────────────'];
    const result = projectBorderedChrome(raw, { topRight: '[ elicit ]' }, 20, identityColor);

    expect(result[0]).toContain('[ elicit ]');
  });

  it('produces a plain border when no label is given', () => {
    const raw = ['──────────', 'query text', '──────────'];
    const result = projectBorderedChrome(raw, {}, 14, identityColor);

    expect(result[0]).toBe('┌────────────┐');
    expect(result[2]).toBe('└────────────┘');
  });

  it('appends belowLines after the box, truncated to width', () => {
    const raw = ['──────', 'text  ', '──────'];
    const result = projectBorderedChrome(
      raw,
      { belowLines: ['http://localhost:3000/very/long/path/that/overflows'] },
      10,
      identityColor,
    );

    expect(result).toHaveLength(4);
    expect(visibleWidth(result[3] ?? '')).toBeLessThanOrEqual(10);
  });

  it('returns an empty array for empty input', () => {
    expect(projectBorderedChrome([], { topRight: '[ x ]' }, 20, identityColor)).toEqual([]);
  });
});
