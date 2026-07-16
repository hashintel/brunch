import type { TUI } from '@earendil-works/pi-tui';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ThemeTestbedComponent } from '../theme-testbed.js';
import { SwitchableComponentPreviewTheme } from '../theme.js';

function stubTui(rows = 200): TUI {
  return { terminal: { rows }, requestRender: () => {} } as unknown as TUI;
}

// Constructing ThemeTestbedComponent installs the preview theme into pi's
// registered theme global; save and restore it so this file cannot leak the
// preview theme into other test files sharing the same Vitest worker.
const PI_THEME_GLOBAL = Symbol.for('@earendil-works/pi-coding-agent:theme');
let hadPreviousPiThemeGlobal: boolean;
let previousPiThemeGlobal: unknown;

beforeEach(() => {
  const globals = globalThis as Record<symbol, unknown>;
  hadPreviousPiThemeGlobal = PI_THEME_GLOBAL in globals;
  previousPiThemeGlobal = globals[PI_THEME_GLOBAL];
});

afterEach(() => {
  const globals = globalThis as Record<symbol, unknown>;
  if (hadPreviousPiThemeGlobal) {
    globals[PI_THEME_GLOBAL] = previousPiThemeGlobal;
  } else {
    delete globals[PI_THEME_GLOBAL];
  }
});

describe('ThemeTestbedComponent', () => {
  it('renders both markdown surfaces with real token colors plus the contrast strip', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const testbed = new ThemeTestbedComponent(theme, stubTui(), () => {});

    const text = testbed.render(100).join('\n');

    // Section headers for both markdown surfaces, text variations, border semantics, and the contrast strip are present.
    expect(text).toContain('pi assistant surface');
    expect(text).toContain('brunch exchange surface');
    expect(text).toContain('text variations');
    expect(text).toContain('border levels');
    expect(text).toContain('mode-reactive border roles');
    expect(text).toContain('surface-identity border roles');
    expect(text).toContain('contrast strip');

    // The pi assistant surface produces real syntax token colors (keyword
    // ANSI from the typescript fixture), which the flat brunch exchange
    // surface never emits.
    expect(text).toContain(theme.getFgAnsi('syntaxKeyword'));
    // Both surfaces style headings through mdHeading.
    expect(text).toContain(theme.getFgAnsi('mdHeading'));
    // The contrast strip and semantics sections exercise fg tokens, bg tokens, and every named border role.
    expect(text).toContain(theme.getFgAnsi('muted'));
    expect(text).toContain(theme.getBgAnsi('selectedBg'));
    expect(text).toContain(theme.getFgAnsi('borderMuted'));
    expect(text).toContain(theme.getFgAnsi('border'));
    expect(text).toContain(theme.getFgAnsi('borderAccent'));
    expect(text).toContain(theme.getFgAnsi('modeSpecifyBorder' as never));
    expect(text).toContain(theme.getFgAnsi('modeExecuteBorder' as never));
  });

  it('renders the expanded theme-demo witness in both shipped theme variants', () => {
    for (const variant of ['dark', 'light'] as const) {
      const theme = new SwitchableComponentPreviewTheme(variant);
      const testbed = new ThemeTestbedComponent(theme, stubTui(), () => {});

      const text = testbed.render(100).join('\n');

      expect(text).toContain('emphasis');
      expect(text).toContain('markdown body sample');
      expect(text).toContain('Specify mode');
      expect(text).toContain('Consult menu');
      expect(text).toContain(theme.getFgAnsi('accent'));
      expect(text).toContain(theme.getFgAnsi('borderAccent'));
    }
  });

  it('follows a theme toggle without reconstruction (delegated reads)', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const testbed = new ThemeTestbedComponent(theme, stubTui(), () => {});

    const darkHeading = theme.getFgAnsi('mdHeading');
    expect(testbed.render(100).join('\n')).toContain(darkHeading);

    theme.toggle();
    testbed.invalidate();
    const lightHeading = theme.getFgAnsi('mdHeading');
    expect(lightHeading).toBe(darkHeading);
    expect(testbed.render(100).join('\n')).toContain(lightHeading);
  });

  it('reload() rebuilds palettes from disk without breaking reads', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const before = theme.getFgAnsi('accent');
    theme.reload();
    expect(theme.getFgAnsi('accent')).toBe(before);
  });
});
