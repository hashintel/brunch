import { describe, expect, it } from 'vitest';

import { TuiStyleLabComponent } from '../../extensions/tui-lab/index.js';
import {
  DEMO_MODEL_SEGMENTS,
  nextSegmentIndex,
  normalizeActiveIndex,
  previousSegmentIndex,
  renderSegmentTrack,
  trackVisibleWidth,
  type LabTheme,
} from '../tui-lab/index.js';

const theme = createTheme();

describe('TUI style lab segment track', () => {
  it('renders the active segment as a solid chip and inactive labels as colored text', () => {
    const track = renderSegmentTrack(theme, DEMO_MODEL_SEGMENTS, 1);

    expect(track).toContain('\x1b[48;5;33m\x1b[30m default ');
    expect(track).toContain('\x1b[38;5;34msmol\x1b[39m');
    expect(track).toContain('\x1b[38;5;220mslow\x1b[39m');
  });

  it('accepts arbitrary segment labels and colors', () => {
    const track = renderSegmentTrack(
      theme,
      [
        { label: 'ask', color: 'accent' },
        { label: 'shape', color: 'customMessageLabel' },
        { label: 'lock', color: 'success' },
      ],
      2,
    );

    expect(track).toContain('ask');
    expect(track).toContain('shape');
    expect(track).toContain('\x1b[48;5;34m\x1b[30m lock ');
  });

  it('keeps visible width within the requested maximum', () => {
    const track = renderSegmentTrack(theme, DEMO_MODEL_SEGMENTS, 1, 14);

    expect(trackVisibleWidth(track)).toBeLessThanOrEqual(14);
  });

  it('wraps active indexes forward and backward', () => {
    expect(normalizeActiveIndex(4, 3)).toBe(1);
    expect(normalizeActiveIndex(-1, 3)).toBe(2);
    expect(nextSegmentIndex(2, 3)).toBe(0);
    expect(previousSegmentIndex(0, 3)).toBe(2);
  });
});

describe('TUI style lab cycle demo component', () => {
  it('cycles only local demo state and requests no model mutation API', () => {
    let closed = false;
    const component = new TuiStyleLabComponent(theme, () => {
      closed = true;
    });

    expect(component.render(80).join('\n')).toContain('default');
    component.handleInput?.('\x1b[C');
    expect(component.render(80).join('\n')).toContain('\x1b[48;5;220m\x1b[30m slow ');
    component.handleInput?.('\x1b[D');
    expect(component.render(80).join('\n')).toContain('\x1b[48;5;33m\x1b[30m default ');
    component.handleInput?.('\x1b');
    expect(closed).toBe(true);
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
    inverse: (text) => `\x1b[7m${text}\x1b[27m`,
    getFgAnsi: (color) => colorCodes[color],
  };
}
