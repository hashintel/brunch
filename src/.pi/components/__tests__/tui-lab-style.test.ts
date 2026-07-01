import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import {
  lineVisibleWidths,
  makeSolidBadge,
  renderStylePalettePreview,
  type LabTheme,
} from '../tui-lab/index.js';

const theme = createTheme();

describe('TUI style lab palette', () => {
  it('maps Brunch style roles onto current Pi theme tokens', () => {
    const lines = renderStylePalettePreview(theme, 120);

    expect(lines.join('\n')).toContain('primary');
    expect(lines.join('\n')).toContain('validated / ready');
    expect(lines.join('\n')).toContain('structured token');
  });

  it('renders text style samples and safely resets each preview line', () => {
    const lines = renderStylePalettePreview(theme, 120);

    expect(lines.join('\n')).toContain('\x1b[1mbold\x1b[22m');
    expect(lines.join('\n')).toContain('\x1b[3mitalic\x1b[23m');
    expect(lines.join('\n')).toContain('\x1b[4munderline\x1b[24m');
    expect(lines.join('\n')).toContain('\x1b[9mstrike\x1b[29m');
    expect(lines.every((line) => line.endsWith('\x1b[0m'))).toBe(true);
  });

  it('renders solid badges by converting foreground ANSI to background ANSI', () => {
    const badge = makeSolidBadge(theme, 'solid', 'accent');

    expect(badge).toContain('\x1b[48;5;33m');
    expect(badge).toContain('\x1b[39m\x1b[49m');
    expect(visibleWidth(`${badge} tail`)).toBe(' solid  tail'.length);
  });

  it('keeps preview lines within visible width', () => {
    const lines = renderStylePalettePreview(theme, 32);

    expect(lineVisibleWidths(lines).every((width) => width <= 32)).toBe(true);
  });
});

function createTheme(): LabTheme {
  const colorCodes: Record<string, string> = {
    accent: '\x1b[38;5;33m',
    success: '\x1b[38;5;34m',
    warning: '\x1b[38;5;220m',
    error: '\x1b[38;5;196m',
    muted: '\x1b[38;5;244m',
    dim: '\x1b[38;5;240m',
    text: '\x1b[39m',
    customMessageLabel: '\x1b[38;5;99m',
    toolTitle: '\x1b[38;5;69m',
    syntaxKeyword: '\x1b[38;5;141m',
  };
  return {
    fg: (color, text) => `${colorCodes[color]}${text}\x1b[39m`,
    bold: (text) => `\x1b[1m${text}\x1b[22m`,
    italic: (text) => `\x1b[3m${text}\x1b[23m`,
    underline: (text) => `\x1b[4m${text}\x1b[24m`,
    strikethrough: (text) => `\x1b[9m${text}\x1b[29m`,
    inverse: (text) => `\x1b[7m${text}\x1b[27m`,
    getFgAnsi: (color) => colorCodes[color],
  };
}
