import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Theme } from '@earendil-works/pi-coding-agent';
import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from '../../../.pi/__tests__/support/virtual-terminal.js';
import { createRuntimeModePickerComponent } from '../../../.pi/components/runtime-posture/axis-picker.js';
import { ComponentGalleryComponent } from '../gallery-component.js';
import {
  createComponentPreviewTheme,
  registerComponentPreviewThemeToggle,
  SwitchableComponentPreviewTheme,
} from '../theme.js';

const THEME_DIR = new URL('../../../.pi/themes/', import.meta.url);

function hexToTruecolorFg(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

function shippedAccentHex(variant: 'dark' | 'light'): string {
  const parsed = JSON.parse(
    readFileSync(fileURLToPath(new URL(`brunch-${variant}.json`, THEME_DIR)), 'utf8'),
  ) as { vars: Record<string, string>; colors: Record<string, string> };
  return parsed.vars[parsed.colors['accent']!] ?? parsed.colors['accent']!;
}

describe('createComponentPreviewTheme', () => {
  it('renders the exact colors shipped in the Brunch theme JSONs', () => {
    const dark = createComponentPreviewTheme('dark');
    const light = createComponentPreviewTheme('light');

    expect(dark.getFgAnsi('accent')).toBe(hexToTruecolorFg(shippedAccentHex('dark')));
    expect(light.getFgAnsi('accent')).toBe(hexToTruecolorFg(shippedAccentHex('light')));
    expect(dark.fg('accent', 'x')).toBe(`${dark.getFgAnsi('accent')}x\x1b[39m`);
  });

  it('is structurally usable as a LabTheme by a real component', () => {
    const theme = createComponentPreviewTheme();

    const component = createRuntimeModePickerComponent({ current: 'specify', theme, onDone: () => {} });
    const text = component.render(120).join('\n');

    expect(text).toContain('Choose Brunch mode');
  });
});

describe('SwitchableComponentPreviewTheme', () => {
  it('is a real Theme and delegates to the active variant across toggle()', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const dark = createComponentPreviewTheme('dark');
    const light = createComponentPreviewTheme('light');

    expect(theme).toBeInstanceOf(Theme);
    expect(theme.variant).toBe('dark');
    expect(theme.getFgAnsi('accent')).toBe(dark.getFgAnsi('accent'));
    expect(theme.fg('accent', 'x')).toBe(dark.fg('accent', 'x'));

    expect(theme.toggle()).toBe('light');
    expect(theme.variant).toBe('light');
    expect(theme.getFgAnsi('accent')).toBe(light.getFgAnsi('accent'));
    expect(theme.fg('accent', 'x')).toBe(light.fg('accent', 'x'));
    expect(theme.bg('selectedBg', 'x')).toBe(light.bg('selectedBg', 'x'));
    expect(theme.getBgAnsi('selectedBg')).toBe(light.getBgAnsi('selectedBg'));
    expect(theme.getColorMode()).toBe('truecolor');

    // Methods that route through this.fg internally follow the toggle too.
    expect(theme.getThinkingBorderColor('high')('y')).toBe(light.fg('thinkingHigh', 'y'));

    expect(theme.toggle()).toBe('dark');
    expect(theme.getFgAnsi('accent')).toBe(dark.getFgAnsi('accent'));
  });

  it('honors an initial light variant', () => {
    const theme = new SwitchableComponentPreviewTheme('light');
    expect(theme.variant).toBe('light');
    expect(theme.getFgAnsi('accent')).toBe(createComponentPreviewTheme('light').getFgAnsi('accent'));
  });

  it('drives the gallery hint line, which names the active variant', () => {
    const theme = new SwitchableComponentPreviewTheme('dark');
    const gallery = new ComponentGalleryComponent(
      [],
      theme,
      undefined as never,
      undefined as never,
      () => {},
    );

    expect(gallery.render(120).join('\n')).toContain('ctrl+t theme (dark)');
    theme.toggle();
    expect(gallery.render(120).join('\n')).toContain('ctrl+t theme (light)');
  });
});

describe('registerComponentPreviewThemeToggle', () => {
  it('consumes ctrl+t, reskins the open component in place, and never delivers the key to it', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    const theme = new SwitchableComponentPreviewTheme('dark');
    const received: string[] = [];

    const component = {
      render: () => [theme.fg('accent', 'marker')],
      handleInput: (data: string) => received.push(data),
      invalidate: () => {},
    };
    tui.addChild(component);
    tui.setFocus(component);
    const dispose = registerComponentPreviewThemeToggle(tui, theme);
    tui.start();

    try {
      await terminal.waitForRender();
      const darkAccent = createComponentPreviewTheme('dark').getFgAnsi('accent');
      const lightAccent = createComponentPreviewTheme('light').getFgAnsi('accent');
      expect(terminal.writes.join('')).toContain(darkAccent);
      expect(terminal.writes.join('')).not.toContain(lightAccent);
      // Registration paints the initial variant's default foreground (OSC 10,
      // the `text` token — governs unstyled component text) and page
      // background (OSC 11).
      const darkPageBg = theme.pageBg;
      const darkPageFg = theme.pageFg;
      expect(darkPageBg).toBeDefined();
      expect(darkPageFg).toBeDefined();
      expect(terminal.writes.join('')).toContain(`\x1b]10;${darkPageFg}\x07`);
      expect(terminal.writes.join('')).toContain(`\x1b]11;${darkPageBg}\x07`);

      terminal.sendInput('\x14');
      await terminal.waitForRender();

      expect(theme.variant).toBe('light');
      expect(terminal.writes.join('')).toContain(lightAccent);
      expect(received).not.toContain('\x14');

      // The terminal default foreground and background follow the toggle.
      const lightPageBg = theme.pageBg;
      const lightPageFg = theme.pageFg;
      expect(lightPageBg).not.toBe(darkPageBg);
      expect(lightPageFg).not.toBe(darkPageFg);
      expect(terminal.writes.join('')).toContain(`\x1b]10;${lightPageFg}\x07`);
      expect(terminal.writes.join('')).toContain(`\x1b]11;${lightPageBg}\x07`);

      // Dispose restores the terminal's defaults (OSC 110 + 111).
      dispose();
      expect(terminal.writes.join('')).toContain('\x1b]110\x07');
      expect(terminal.writes.join('')).toContain('\x1b]111\x07');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('recognizes the kitty-protocol ctrl+t press and ignores its release', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    const theme = new SwitchableComponentPreviewTheme('dark');

    tui.addChild({ render: () => ['plain'], invalidate: () => {} });
    registerComponentPreviewThemeToggle(tui, theme);
    tui.start();

    try {
      await terminal.waitForRender();
      // Kitty CSI-u encoding for ctrl+t press (codepoint 116, ctrl modifier).
      terminal.sendInput('\x1b[116;5u');
      expect(theme.variant).toBe('light');

      // The release event (event type :3) must not toggle back.
      terminal.sendInput('\x1b[116;5:3u');
      expect(theme.variant).toBe('light');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });

  it('leaves other input untouched', async () => {
    const terminal = new VirtualTerminal(80, 24);
    const tui = new TUI(terminal);
    const theme = new SwitchableComponentPreviewTheme('dark');
    const received: string[] = [];

    const component = {
      render: () => ['plain'],
      handleInput: (data: string) => received.push(data),
      invalidate: () => {},
    };
    tui.addChild(component);
    tui.setFocus(component);
    registerComponentPreviewThemeToggle(tui, theme);
    tui.start();

    try {
      await terminal.waitForRender();
      terminal.sendInput('t');
      expect(received).toContain('t');
      expect(theme.variant).toBe('dark');
    } finally {
      terminal.stop();
      tui.stop();
    }
  });
});
