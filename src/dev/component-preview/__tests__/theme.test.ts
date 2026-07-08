import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Theme } from '@earendil-works/pi-coding-agent';
import { TUI } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { VirtualTerminal } from '../../../.pi/__tests__/support/virtual-terminal.js';
import { OPERATIONAL_MODE_BORDER_COLOR_ROLES } from '../../../.pi/components/mode-border-theme.js';
import { createRuntimeModePickerComponent } from '../../../.pi/components/runtime-posture/axis-picker.js';
import { OPERATIONAL_MODE_IDS } from '../../../session/schema/kinds.js';
import { ComponentGalleryComponent } from '../gallery-component.js';
import {
  createComponentPreviewTheme,
  createThemePaintingTerminal,
  parseBrunchThemePalette,
  registerComponentPreviewThemeToggle,
  shouldReloadComponentPreviewThemeForWatchEvent,
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

describe('parseBrunchThemePalette', () => {
  // Semantic validation exists so watchComponentPreviewTheme's throw-based
  // last-good-palette fallback fires on valid-JSON-but-bad-value saves, not
  // only on JSON syntax errors — otherwise malformed hexes flow into OSC/SGR
  // emission as NaN channels.
  const themeJson = (overrides: object): string =>
    JSON.stringify({
      name: 'probe',
      vars: { ink: '#e2ddd7' },
      colors: { accent: 'ink', text: '' },
      export: { pageBg: '#26221e', pageFg: '#e0e0e0' },
      ...overrides,
    });

  it('accepts valid hexes, empty-string tokens, and vars indirection', () => {
    const palette = parseBrunchThemePalette(themeJson({}), 'dark');
    expect(palette.fgColors['accent']).toBe('#e2ddd7');
    expect(palette.fgColors['text']).toBe('');
    expect(palette.pageBg).toBe('#26221e');
    expect(palette.pageFg).toBe('#e0e0e0');
  });

  it('throws on a valid-JSON save with an invalid hex literal', () => {
    expect(() =>
      parseBrunchThemePalette(themeJson({ export: { pageBg: '#26221e', pageFg: '#nothex' } }), 'dark'),
    ).toThrow(/pageFg/);
  });

  it('throws on a dangling var reference (resolves to itself, not a hex)', () => {
    expect(() =>
      parseBrunchThemePalette(themeJson({ colors: { accent: 'inkk', text: '' } }), 'dark'),
    ).toThrow(/accent.*inkk/);
  });

  it('throws on a dangling page-color var before terminal painting can consume it', () => {
    expect(() =>
      parseBrunchThemePalette(
        themeJson({ export: { pageBg: 'surface-missing', pageFg: '#e0e0e0' } }),
        'dark',
      ),
    ).toThrow(/pageBg.*surface-missing/);
  });

  it('rejects empty string where a page color is required', () => {
    expect(() =>
      parseBrunchThemePalette(themeJson({ export: { pageBg: '', pageFg: '#e0e0e0' } }), 'dark'),
    ).toThrow(/pageBg/);
  });

  it('rejects empty string for non-terminal-default color tokens', () => {
    expect(() => parseBrunchThemePalette(themeJson({ colors: { accent: '', text: '' } }), 'dark')).toThrow(
      /accent/,
    );
    expect(() =>
      parseBrunchThemePalette(themeJson({ colors: { selectedBg: '', text: '' } }), 'dark'),
    ).toThrow(/selectedBg/);
  });

  it('still parses the shipped theme JSONs', () => {
    for (const variant of ['dark', 'light'] as const) {
      const raw = readFileSync(fileURLToPath(new URL(`brunch-${variant}.json`, THEME_DIR)), 'utf8');
      expect(() => parseBrunchThemePalette(raw, variant)).not.toThrow();
    }
  });

  it('defines one mode border color role per operational mode in both shipped themes', () => {
    const requiredRoles = OPERATIONAL_MODE_IDS.map((mode) => OPERATIONAL_MODE_BORDER_COLOR_ROLES[mode]);

    for (const variant of ['dark', 'light'] as const) {
      const raw = readFileSync(fileURLToPath(new URL(`brunch-${variant}.json`, THEME_DIR)), 'utf8');
      const palette = parseBrunchThemePalette(raw, variant);
      for (const role of requiredRoles) {
        expect((palette.fgColors as Record<string, string>)[role], `${variant} ${role}`).toMatch(
          /^#[0-9a-fA-F]{6}$/,
        );
      }
    }
  });
});

describe('watchComponentPreviewTheme', () => {
  it('treats filename-less filesystem events as reload candidates', () => {
    expect(shouldReloadComponentPreviewThemeForWatchEvent(null)).toBe(true);
    expect(shouldReloadComponentPreviewThemeForWatchEvent('brunch-dark.json')).toBe(true);
    expect(shouldReloadComponentPreviewThemeForWatchEvent('notes.txt')).toBe(false);
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
      // the theme's `export.pageFg` reference — governs unstyled and
      // `text`-token component text) and page background (OSC 11).
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

describe('createThemePaintingTerminal', () => {
  function hexToFg(hex: string): string {
    const c = hex.replace('#', '');
    return `\x1b[38;2;${parseInt(c.slice(0, 2), 16)};${parseInt(c.slice(2, 4), 16)};${parseInt(c.slice(4, 6), 16)}m`;
  }
  function hexToBg(hex: string): string {
    const c = hex.replace('#', '');
    return `\x1b[48;2;${parseInt(c.slice(0, 2), 16)};${parseInt(c.slice(2, 4), 16)};${parseInt(c.slice(4, 6), 16)}m`;
  }

  it('prefixes writes with the page fg/bg and rewrites default-reset codes to the theme base', () => {
    const inner = new VirtualTerminal(80, 24);
    const theme = new SwitchableComponentPreviewTheme('dark');
    const painted = createThemePaintingTerminal(inner, theme);

    const fg = hexToFg(theme.pageFg!);
    const bg = hexToBg(theme.pageBg!);

    painted.write('styled\x1b[39mafter-fg-reset\x1b[49mafter-bg-reset\x1b[0mafter-full-reset');
    const written = inner.writes.join('');

    expect(written.startsWith(fg + bg)).toBe(true);
    expect(written).toContain(`styled${fg}after-fg-reset`);
    expect(written).toContain(`${bg}after-bg-reset`);
    expect(written).toContain(`\x1b[0m${fg}${bg}after-full-reset`);
    expect(written).not.toContain('\x1b[39ma');
  });

  it('follows toggle for subsequent writes and sets the base bg before erase calls (BCE)', () => {
    const inner = new VirtualTerminal(80, 24);
    const theme = new SwitchableComponentPreviewTheme('dark');
    const painted = createThemePaintingTerminal(inner, theme);

    theme.toggle();
    painted.clearLine();
    const written = inner.writes.join('');
    expect(written).toContain(hexToBg(theme.pageBg!));
    expect(written).toContain('\x1b[K');
  });

  it('delegates the rest of the Terminal surface to the wrapped terminal', () => {
    const inner = new VirtualTerminal(90, 30);
    const theme = new SwitchableComponentPreviewTheme('dark');
    const painted = createThemePaintingTerminal(inner, theme);

    expect(painted.columns).toBe(90);
    expect(painted.rows).toBe(30);
    expect(painted.kittyProtocolActive).toBe(false);
  });
});
