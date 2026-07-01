import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { projectRoundedBox } from '../rounded-box.js';

const identityColor = (text: string) => text;

describe('projectRoundedBox', () => {
  it('returns an empty array for empty content', () => {
    expect(projectRoundedBox([], {}, 20, identityColor)).toEqual([]);
  });

  it('projects a plain rounded box at the requested width', () => {
    expect(projectRoundedBox(['alpha', 'beta'], {}, 12, identityColor)).toEqual([
      '╭──────────╮',
      '│ alpha    │',
      '│ beta     │',
      '╰──────────╯',
    ]);
  });

  it('embeds top and bottom labels right-aligned in the border', () => {
    expect(
      projectRoundedBox(['body'], { topLabel: '[ Specify ]', bottomLabel: '"Alpha"' }, 24, identityColor),
    ).toEqual(['╭──────── [ Specify ] ─╮', '│ body                 │', '╰──────────── "Alpha" ─╯']);
  });

  it('can embed a top label left-aligned in the border', () => {
    expect(
      projectRoundedBox(['body'], { topLabel: '*Alpha*', labelAlign: 'left' }, 20, identityColor),
    ).toEqual(['╭─ *Alpha* ────────╮', '│ body             │', '╰──────────────────╯']);
  });

  it('colors labeled border runs without coloring the label text', () => {
    const color = (text: string) => `<${text}>`;

    expect(projectRoundedBox(['body'], { topLabel: '*Alpha*', labelAlign: 'left' }, 20, color)[0]).toBe(
      '<╭─> *Alpha* <────────╮>',
    );
    expect(projectRoundedBox(['body'], { topLabel: '[ Specify ]' }, 24, color)[0]).toBe(
      '<╭────────> [ Specify ] <─╮>',
    );
  });

  it('truncates overlong labels to the border width', () => {
    const top = projectRoundedBox(['body'], { topLabel: '[ label too long ]' }, 8, identityColor)[0] ?? '';

    expect(visibleWidth(top)).toBeLessThanOrEqual(8);
    expect(top.startsWith('╭')).toBe(true);
  });

  it('truncates oversized left-aligned labels to the border width', () => {
    const top = projectRoundedBox(
      ['body'],
      { topLabel: '[ label too long ]', labelAlign: 'left' },
      8,
      identityColor,
    );

    expect(visibleWidth(top[0] ?? '')).toBeLessThanOrEqual(8);
    expect(top[0]?.startsWith('╭')).toBe(true);
  });

  it('truncates overlong content lines instead of overflowing the box', () => {
    const result = projectRoundedBox(['abcdefghijklmnop'], {}, 10, identityColor);

    expect(visibleWidth(result[1] ?? '')).toBeLessThanOrEqual(10);
    expect(result[1]).toContain('...');
  });

  it('can preserve the visible width of pre-rendered content rows', () => {
    const result = projectRoundedBox(['pre-rendered'], { preserveContentWidth: true }, 24, identityColor);

    expect(result[1]).toBe('│ pre-rendered │');
  });

  it('renders thumb rows by replacing the right border glyph for matching content rows', () => {
    const result = projectRoundedBox(['one', 'two', 'three'], { thumbRows: new Set([1]) }, 12, identityColor);

    expect(result[1]).toBe('│ one      │');
    expect(result[2]).toBe('│ two      ▐');
    expect(result[3]).toBe('│ three    │');
  });

  it('inserts blank padding while keeping thumb rows indexed against caller content', () => {
    const result = projectRoundedBox(
      ['first', 'second'],
      { blankPadding: { top: 1, bottom: 2 }, thumbRows: new Set([1]) },
      12,
      identityColor,
    );

    expect(result).toEqual([
      '╭──────────╮',
      '│          │',
      '│ first    │',
      '│ second   ▐',
      '│          │',
      '│          │',
      '╰──────────╯',
    ]);
  });

  it('colors border glyphs without coloring content text', () => {
    const color = (text: string) => `<${text}>`;
    const result = projectRoundedBox(['body'], { thumbRows: new Set([0]) }, 8, color);

    expect(result).toEqual(['<╭──────╮>', '<│> body <▐>', '<╰──────╯>']);
  });
});
