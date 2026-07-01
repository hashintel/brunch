import { resetCapabilitiesCache, setCapabilities, visibleWidth } from '@earendil-works/pi-tui';
import { afterEach, describe, expect, it } from 'vitest';

import { projectBorderedChrome } from '../brunch-editor.js';

const identityColor = (s: string) => s;

afterEach(() => {
  resetCapabilitiesCache();
});

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
      { topRight: '[ elicit ]', bottomRight: '"Spec"' },
      30,
      identityColor,
    );

    expect(result[0]).toContain('[ elicit ]');
    expect(result[3]).toContain('"Spec"');
    expect(result[3]?.startsWith('╰')).toBe(true);
    // Autocomplete rows are untouched content, boxed like any other line.
    expect(result[4]).toBe('│ suggestion one │');
    expect(result[5]).toBe('│ suggestion two │');
  });

  it('recognizes the scroll-indicator variant of the border', () => {
    const raw = ['─── ↑ 3 more ─────', 'query text', 'second row', '──────────────────'];
    const result = projectBorderedChrome(raw, { topRight: '[ elicit ]' }, 20, identityColor);

    expect(result[0]).toContain('[ elicit ]');
  });

  it('produces a plain rounded border when no label is given', () => {
    const raw = ['──────────', 'query text', 'second row', '──────────'];
    const result = projectBorderedChrome(raw, {}, 14, identityColor);

    expect(result[0]).toBe('╭────────────╮');
    expect(result[3]).toBe('╰────────────╯');
  });

  it('indents belowLines by one column and truncates to width', () => {
    const raw = ['──────', 'text  ', 'more  ', '──────'];
    const result = projectBorderedChrome(
      raw,
      { belowLines: ['http://localhost:3000/very/long/path/that/overflows'] },
      10,
      identityColor,
    );

    expect(result).toHaveLength(5);
    expect(result[4]?.startsWith(' ')).toBe(true);
    expect(visibleWidth(result[4] ?? '')).toBeLessThanOrEqual(10);
  });

  it('renders a { text, url } belowLine as an OSC 8 hyperlink when supported', () => {
    setCapabilities({ images: null, trueColor: false, hyperlinks: true });
    const raw = ['──────', 'text  ', 'more  ', '──────'];
    const result = projectBorderedChrome(
      raw,
      { belowLines: [{ text: 'http://localhost:3141/session', url: 'http://localhost:3141/session' }] },
      40,
      identityColor,
    );

    expect(result.at(-1)).toContain('\x1b]8;;http://localhost:3141/session');
    expect(result.at(-1)).toContain('http://localhost:3141/session');
  });

  it('falls back to plain text for a { text, url } belowLine when hyperlinks are unsupported', () => {
    setCapabilities({ images: null, trueColor: false, hyperlinks: false });
    const raw = ['──────', 'text  ', 'more  ', '──────'];
    const result = projectBorderedChrome(
      raw,
      { belowLines: [{ text: 'http://localhost:3141/session', url: 'http://localhost:3141/session' }] },
      40,
      identityColor,
    );

    expect(result.at(-1)).not.toContain('\x1b]8;');
    expect(result.at(-1)).toContain('http://localhost:3141/session');
  });

  it('returns an empty array for empty input', () => {
    expect(projectBorderedChrome([], { topRight: '[ x ]' }, 20, identityColor)).toEqual([]);
  });
});
