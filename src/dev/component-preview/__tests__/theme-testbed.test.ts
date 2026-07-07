import type { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { ThemeTestbedComponent } from '../theme-testbed.js';
import { SwitchableComponentPreviewTheme } from '../theme.js';

function stubTui(rows = 200): TUI {
  return { terminal: { rows }, requestRender: () => {} } as unknown as TUI;
}

describe('ThemeTestbedComponent', () => {
  it('renders both markdown surfaces with real token colors plus the contrast strip', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const testbed = new ThemeTestbedComponent(theme, stubTui(), () => {});

    const text = testbed.render(100).join('\n');

    // Section headers for both surfaces and the contrast strip are present.
    expect(text).toContain('pi assistant surface');
    expect(text).toContain('brunch exchange surface');
    expect(text).toContain('contrast strip');

    // The pi assistant surface produces real syntax token colors (keyword
    // ANSI from the typescript fixture), which the flat brunch exchange
    // surface never emits.
    expect(text).toContain(theme.getFgAnsi('syntaxKeyword'));
    // Both surfaces style headings through mdHeading.
    expect(text).toContain(theme.getFgAnsi('mdHeading'));
    // The contrast strip exercises fg tokens and bg tokens.
    expect(text).toContain(theme.getFgAnsi('muted'));
    expect(text).toContain(theme.getBgAnsi('selectedBg'));
  });

  it('follows a theme toggle without reconstruction (delegated reads)', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const testbed = new ThemeTestbedComponent(theme, stubTui(), () => {});

    const darkHeading = theme.getFgAnsi('mdHeading');
    expect(testbed.render(100).join('\n')).toContain(darkHeading);

    theme.toggle();
    testbed.invalidate();
    const lightHeading = theme.getFgAnsi('mdHeading');
    expect(lightHeading).not.toBe(darkHeading);
    expect(testbed.render(100).join('\n')).toContain(lightHeading);
  });

  it('reload() rebuilds palettes from disk without breaking reads', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const before = theme.getFgAnsi('accent');
    theme.reload();
    expect(theme.getFgAnsi('accent')).toBe(before);
  });
});
