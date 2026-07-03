import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { CardComponent } from '../cards.js';

const theme = {
  fg: (color: ThemeColor, text: string) => `[${color}]${text}[/${color}]`,
  bold: (text: string) => `*${text}*`,
} as Theme;

describe('CardComponent', () => {
  it('renders the current titled bordered card shape', () => {
    const card = new CardComponent('Alpha', 'Plain body', theme, 'accent');

    expect(card.render(20)).toEqual([
      '[accent]╭─[/accent] *Alpha* [accent]────────╮[/accent]',
      '[accent]│[/accent] Plain body       [accent]│[/accent]',
      '[accent]╰──────────────────╯[/accent]',
    ]);
  });
});
