import { readFileSync, watch } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getSelectListTheme, Theme, type ThemeColor } from '@earendil-works/pi-coding-agent';
import {
  type EditorTheme,
  isKeyRelease,
  Key,
  matchesKey,
  type Terminal,
  type TUI,
} from '@earendil-works/pi-tui';

/**
 * Real truecolor palette for the standalone component preview harness
 * (`npm run dev:components`), loaded from the shipped Brunch theme JSONs in
 * `src/.pi/themes/` — the same files a live session resolves through the
 * sealed resource loader. Constructs an actual `pi-coding-agent` `Theme`
 * instance — the same class production components receive as `ctx.ui.custom`'s
 * `theme` argument (`.fg`/`.bg`/`.inverse`/`.getFgAnsi` behave identically) —
 * so previewed components render the exact colors under refinement.
 *
 * pi's own theme-loading pipeline lives behind `theme.ts` internals that the
 * package's `exports` map does not expose outside a running session, so this
 * reimplements only the small part the JSON format needs: `vars` indirection
 * to hex values, split into fg and bg token tables.
 *
 * `BRUNCH_PREVIEW_THEME=light npm run dev:components` starts on the light half
 * of the pair; the default is dark. ctrl+t toggles live at any point (see
 * `SwitchableComponentPreviewTheme` / `registerComponentPreviewThemeToggle`).
 */
const THEME_DIR = new URL('../../.pi/themes/', import.meta.url);

const BG_TOKENS = [
  'selectedBg',
  'userMessageBg',
  'customMessageBg',
  'toolPendingBg',
  'toolSuccessBg',
  'toolErrorBg',
] as const;

type ThemeBgToken = (typeof BG_TOKENS)[number];

interface BrunchThemeJson {
  name: string;
  vars?: Record<string, string>;
  colors: Record<string, string>;
  export?: { pageBg?: string; pageFg?: string };
}

export type ComponentPreviewThemeVariant = 'dark' | 'light';

export function resolveInitialComponentPreviewThemeVariant(): ComponentPreviewThemeVariant {
  return process.env.BRUNCH_PREVIEW_THEME === 'light' ? 'light' : 'dark';
}

export interface BrunchThemePalette {
  readonly name: string;
  readonly fgColors: Record<ThemeColor, string>;
  readonly bgColors: Record<ThemeBgToken, string>;
  /** Whole-page background from the theme's `export` block (used for OSC 11). */
  readonly pageBg: string | undefined;
  /**
   * Reference default-foreground — the terminal environment color the
   * palette is designed against. Deliberately *not* the `text` token:
   * `text` is `""` (terminal default, pi's canonical value), while pageFg
   * documents the assumed inherited environment default that live sessions
   * never paint. Read from `export.pageFg` when present, else the neutral
   * harness default below — pi's published theme schema does not know
   * `pageFg`, so schema-aware editors strip it from the JSONs; the harness
   * must not depend on it surviving.
   */
  readonly pageFg: string | undefined;
}

/** Neutral reference environment (user decision 2026-07-07): most terminals
 * roughly conform to an off-black/off-white default scheme. */
const REFERENCE_PAGE_FG: Record<ComponentPreviewThemeVariant, string> = {
  dark: '#e0e0e0',
  light: '#1f1f1f',
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const TERMINAL_DEFAULT_FG_TOKENS = ['text'] as const;

function allowsTerminalDefaultToken(token: string): boolean {
  return (TERMINAL_DEFAULT_FG_TOKENS as readonly string[]).includes(token);
}

/**
 * Parse and validate one Brunch theme JSON. Exported for tests; the harness
 * itself goes through `loadBrunchThemePalette` below. Every resolved value
 * must be `#RRGGBB` (except the declared terminal-default fg token `text`,
 * which may be `""` per pi's theme format) — validation runs *after* `vars` indirection, so a
 * dangling var reference (which resolves to itself) fails the same check as a
 * bad hex literal. Throwing here is load-bearing: `watchComponentPreviewTheme`
 * relies on `reload()` throwing to keep the last good palette, and without
 * this check a valid-JSON save with a bad value would sail through and emit
 * malformed OSC/SGR sequences downstream.
 */
export function parseBrunchThemePalette(
  raw: string,
  variant: ComponentPreviewThemeVariant,
): BrunchThemePalette {
  const parsed = JSON.parse(raw) as BrunchThemeJson;
  const vars = parsed.vars ?? {};
  const resolve = (token: string, value: string, allowEmpty: boolean): string => {
    const resolved = vars[value] ?? value;
    if (allowEmpty && resolved === '') return resolved;
    if (!HEX_COLOR.test(resolved)) {
      throw new Error(`theme ${parsed.name}: "${token}" resolves to "${resolved}", expected #RRGGBB`);
    }
    return resolved;
  };

  const fgColors: Record<string, string> = {};
  const bgColors: Record<string, string> = {};
  for (const [token, value] of Object.entries(parsed.colors)) {
    if ((BG_TOKENS as readonly string[]).includes(token)) {
      bgColors[token] = resolve(token, value, false);
    } else {
      fgColors[token] = resolve(token, value, allowsTerminalDefaultToken(token));
    }
  }

  return {
    name: parsed.name,
    fgColors: fgColors as Record<ThemeColor, string>,
    bgColors: bgColors as Record<ThemeBgToken, string>,
    pageBg:
      parsed.export?.pageBg !== undefined ? resolve('export.pageBg', parsed.export.pageBg, false) : undefined,
    pageFg:
      parsed.export?.pageFg !== undefined
        ? resolve('export.pageFg', parsed.export.pageFg, false)
        : REFERENCE_PAGE_FG[variant],
  };
}

function readBrunchThemeJson(variant: ComponentPreviewThemeVariant): string {
  return readFileSync(fileURLToPath(new URL(`brunch-${variant}.json`, THEME_DIR)), 'utf8');
}

function loadBrunchThemePalette(variant: ComponentPreviewThemeVariant): BrunchThemePalette {
  return parseBrunchThemePalette(readBrunchThemeJson(variant), variant);
}

export function loadComponentPreviewThemeColorRoles(): readonly string[] {
  const roles = new Set<string>();
  for (const variant of ['dark', 'light'] as const) {
    const raw = readBrunchThemeJson(variant);
    parseBrunchThemePalette(raw, variant);
    const parsed = JSON.parse(raw) as BrunchThemeJson;
    for (const role of Object.keys(parsed.colors)) roles.add(role);
  }
  return [...roles].sort();
}

export function loadComponentPreviewBorderColorRoles(): readonly string[] {
  return loadComponentPreviewThemeColorRoles().filter(
    (role) => role === 'border' || role.toLowerCase().includes('border'),
  );
}

export function createComponentPreviewTheme(variant?: ComponentPreviewThemeVariant): Theme {
  const palette = loadBrunchThemePalette(variant ?? resolveInitialComponentPreviewThemeVariant());
  return new Theme(palette.fgColors, palette.bgColors, 'truecolor', { name: palette.name });
}

/**
 * A live-switchable `Theme` for the preview harness. It *is* a real `Theme`
 * (subclassing satisfies call sites that require the nominal class), but every
 * color read delegates to the currently active dark/light variant, so one
 * shared instance retheming everything on screen is just `toggle()` plus a
 * render pass — components re-call `theme.fg(...)` inside `render()` and the
 * base class resolves colors per call from constructor-built tables (verified
 * against pi-coding-agent's `theme.js`), caching nothing downstream.
 *
 * Only the public color API is overridden — no reaching into the base class's
 * private color maps. `bold`/`italic`/`underline`/`inverse`/`strikethrough`
 * are theme-independent chalk passthroughs, and
 * `getThinkingBorderColor`/`getBashModeBorderColor` route through `this.fg`,
 * so they follow the toggle without their own overrides.
 */
export class SwitchableComponentPreviewTheme extends Theme {
  #variants: Record<ComponentPreviewThemeVariant, Theme>;
  #pageBgs: Record<ComponentPreviewThemeVariant, string | undefined>;
  #pageFgs: Record<ComponentPreviewThemeVariant, string | undefined>;
  #active: ComponentPreviewThemeVariant;

  constructor(initial: ComponentPreviewThemeVariant = resolveInitialComponentPreviewThemeVariant()) {
    const darkPalette = loadBrunchThemePalette('dark');
    const lightPalette = loadBrunchThemePalette('light');
    const initialPalette = initial === 'dark' ? darkPalette : lightPalette;
    super(initialPalette.fgColors, initialPalette.bgColors, 'truecolor', { name: initialPalette.name });
    this.#variants = {
      dark: new Theme(darkPalette.fgColors, darkPalette.bgColors, 'truecolor', { name: darkPalette.name }),
      light: new Theme(lightPalette.fgColors, lightPalette.bgColors, 'truecolor', {
        name: lightPalette.name,
      }),
    };
    this.#pageBgs = { dark: darkPalette.pageBg, light: lightPalette.pageBg };
    this.#pageFgs = { dark: darkPalette.pageFg, light: lightPalette.pageFg };
    this.#active = initial;
  }

  get variant(): ComponentPreviewThemeVariant {
    return this.#active;
  }

  /** Active variant's whole-page background hex (theme JSON `export.pageBg`), if declared. */
  get pageBg(): string | undefined {
    return this.#pageBgs[this.#active];
  }

  /**
   * Active variant's reference default-foreground hex (`export.pageFg`, a
   * Brunch extension of pi's export block — pi ignores unknown export keys).
   * Painted via OSC 10 / the SGR fallback so unstyled and `text`-token
   * (`""` = terminal default, per pi's theme format) glyphs render on the
   * environment the palette is designed against.
   */
  get pageFg(): string | undefined {
    return this.#pageFgs[this.#active];
  }

  toggle(): ComponentPreviewThemeVariant {
    this.#active = this.#active === 'dark' ? 'light' : 'dark';
    return this.#active;
  }

  /**
   * Re-read both theme JSONs from disk and rebuild the variant Themes.
   * Because all color reads delegate per call, live components pick up the
   * new values on their next render — same choreography as `toggle()`.
   * Throws on unreadable/invalid JSON *and* on semantically invalid color
   * values (non-`#RRGGBB` after vars resolution — see
   * `parseBrunchThemePalette`); callers decide whether a bad mid-edit save is
   * fatal (the watcher below just keeps the last good set).
   */
  reload(): void {
    const darkPalette = loadBrunchThemePalette('dark');
    const lightPalette = loadBrunchThemePalette('light');
    this.#variants = {
      dark: new Theme(darkPalette.fgColors, darkPalette.bgColors, 'truecolor', { name: darkPalette.name }),
      light: new Theme(lightPalette.fgColors, lightPalette.bgColors, 'truecolor', {
        name: lightPalette.name,
      }),
    };
    this.#pageBgs = { dark: darkPalette.pageBg, light: lightPalette.pageBg };
    this.#pageFgs = { dark: darkPalette.pageFg, light: lightPalette.pageFg };
  }

  override fg(color: ThemeColor, text: string): string {
    return this.#variants[this.#active].fg(color, text);
  }

  override bg(color: ThemeBgToken, text: string): string {
    return this.#variants[this.#active].bg(color, text);
  }

  override getFgAnsi(color: ThemeColor): string {
    return this.#variants[this.#active].getFgAnsi(color);
  }

  override getBgAnsi(color: ThemeBgToken): string {
    return this.#variants[this.#active].getBgAnsi(color);
  }

  override getColorMode(): ReturnType<Theme['getColorMode']> {
    return this.#variants[this.#active].getColorMode();
  }
}

/**
 * Global ctrl+t theme toggle for the preview harness. Registered as a TUI
 * input listener, which pi-tui runs *before* focused-component dispatch —
 * `{ consume: true }` guarantees no previewed component (editors included)
 * ever sees the keystroke. The invalidate-then-render pair mirrors pi-tui's
 * own theme-change choreography (`Component.invalidate()` is documented as
 * "called when theme changes" and `TUI.invalidate()` propagates to children
 * and overlays).
 *
 * Theme colors only style glyphs; the screen behind them is the terminal
 * emulator's own background, so without repainting it a light toggle reads as
 * light text on a dark page. Each switch (and registration) therefore also
 * sets the terminal background via OSC 11 to the variant's `export.pageBg`
 * from the theme JSON; the returned dispose restores the terminal default via
 * OSC 111. Same session-scoped ownership discipline as the harness's SGR
 * mouse opt-in in `custom-ui.ts`.
 */
// OSC 10/11 support varies by emulator (Ghostty/kitty/iTerm2/WezTerm honor
// them; Zed's built-in terminal ignores them silently). Terminals that ignore
// them are covered by the SGR fallback in `createThemePaintingTerminal`.
function paintTerminalThemeColors(tui: TUI, theme: SwitchableComponentPreviewTheme): void {
  // OSC 10 = default foreground (unstyled text), OSC 11 = default background.
  if (theme.pageFg !== undefined) tui.terminal.write(`\x1b]10;${theme.pageFg}\x07`);
  if (theme.pageBg !== undefined) tui.terminal.write(`\x1b]11;${theme.pageBg}\x07`);
}

function hexToFgSgr(hex: string): string {
  const c = hex.replace('#', '');
  return `\x1b[38;2;${parseInt(c.slice(0, 2), 16)};${parseInt(c.slice(2, 4), 16)};${parseInt(c.slice(4, 6), 16)}m`;
}

function hexToBgSgr(hex: string): string {
  const c = hex.replace('#', '');
  return `\x1b[48;2;${parseInt(c.slice(0, 2), 16)};${parseInt(c.slice(2, 4), 16)};${parseInt(c.slice(4, 6), 16)}m`;
}

/**
 * SGR-level fallback for terminals that ignore OSC 10/11 (e.g. Zed): wrap the
 * harness Terminal so the theme's page fg/bg ride the output stream itself.
 * Every frame write is prefixed with the base colors, and the "reset to
 * terminal default" codes are rewritten so resets return to the *theme's*
 * base instead — `\x1b[39m` → base fg, `\x1b[49m` → base bg, `\x1b[0m` →
 * `\x1b[0m` + base pair. Erase sequences (`\x1b[K` etc.) then fill with the
 * active background (BCE), so cleared cells adopt the page color too.
 *
 * Colors are read from the switchable theme per write, so toggle and hot
 * reload flow through; pair renders with `requestRender(true)` after a theme
 * change so unchanged lines are rewritten under the new base.
 *
 * ceiling: rewrites assume escape sequences never split across write chunks —
 * true today because pi-tui composes each frame into one buffer write.
 * Revisit if pi-tui ever streams partial frames.
 */
export function createThemePaintingTerminal(
  base: Terminal,
  theme: SwitchableComponentPreviewTheme,
): Terminal {
  const baseSgr = (): string =>
    (theme.pageFg !== undefined ? hexToFgSgr(theme.pageFg) : '') +
    (theme.pageBg !== undefined ? hexToBgSgr(theme.pageBg) : '');

  const paint = (data: string): string => {
    const sgr = baseSgr();
    if (sgr === '') return data;
    let out = data;
    if (theme.pageFg !== undefined) out = out.replaceAll('\x1b[39m', hexToFgSgr(theme.pageFg));
    if (theme.pageBg !== undefined) out = out.replaceAll('\x1b[49m', hexToBgSgr(theme.pageBg));
    out = out.replaceAll('\x1b[0m', `\x1b[0m${sgr}`);
    return sgr + out;
  };

  return new Proxy(base, {
    get(target, prop) {
      if (prop === 'write') {
        return (data: string) => {
          target.write(paint(data));
        };
      }
      if (prop === 'clearLine' || prop === 'clearFromCursor' || prop === 'clearScreen') {
        return () => {
          // Ensure BCE erases fill with the page background.
          target.write(baseSgr());
          target[prop]();
        };
      }
      if (prop === 'stop') {
        return () => {
          target.write('\x1b[0m');
          target.stop();
        };
      }
      const value = Reflect.get(target, prop, target) as unknown;
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
    },
  });
}

function restoreTerminalThemeColors(tui: TUI): void {
  tui.terminal.write('\x1b]110\x07\x1b]111\x07');
}

export function registerComponentPreviewThemeToggle(
  tui: TUI,
  theme: SwitchableComponentPreviewTheme,
): () => void {
  paintTerminalThemeColors(tui, theme);
  const removeListener = tui.addInputListener((data) => {
    // Input listeners run before the TUI's key-release filter, so guard
    // releases explicitly: under the kitty protocol ctrl+t arrives as a CSI-u
    // press *and* a CSI-u release, and matchesKey alone accepts both.
    if (isKeyRelease(data) || !matchesKey(data, Key.ctrl('t'))) return undefined;
    theme.toggle();
    paintTerminalThemeColors(tui, theme);
    tui.invalidate();
    // force: unchanged lines must still be rewritten under the new base
    // fg/bg that createThemePaintingTerminal injects per write.
    tui.requestRender(true);
    return { consume: true };
  });
  return () => {
    removeListener();
    restoreTerminalThemeColors(tui);
  };
}

/**
 * Hot-reload the theme JSONs while the harness runs: watch
 * `src/.pi/themes/`, and on any change to `brunch-*.json` rebuild the
 * variant Themes and repaint — edit a value in your editor, save, and the
 * running preview reskins on the next render pass. A mid-edit save with
 * invalid JSON keeps the last good palette (reload throws, we swallow and
 * wait for the next write). Debounced because editors typically fire
 * multiple fs events per save.
 */
export function shouldReloadComponentPreviewThemeForWatchEvent(filename: string | null): boolean {
  return filename === null || /^brunch-.*\.json$/.test(filename);
}

export function watchComponentPreviewTheme(tui: TUI, theme: SwitchableComponentPreviewTheme): () => void {
  let timer: NodeJS.Timeout | undefined;
  const watcher = watch(fileURLToPath(THEME_DIR), (_event, filename) => {
    if (!shouldReloadComponentPreviewThemeForWatchEvent(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        theme.reload();
      } catch {
        return; // mid-edit invalid JSON: keep the last good palette
      }
      paintTerminalThemeColors(tui, theme);
      tui.invalidate();
      tui.requestRender(true);
    }, 50);
  });
  return () => {
    clearTimeout(timer);
    watcher.close();
  };
}

/**
 * `ctx.ui.setEditorComponent`'s factory receives an `EditorTheme`
 * (`{ borderColor, selectList }`), not the full `Theme` class — in a real
 * session Pi constructs that conversion internally before calling the
 * factory. The preview harness only has the full `Theme`, so this builds the
 * same shape from it for components (like `BrunchEditorComponent`) that need
 * an `EditorTheme` to construct standalone.
 */
export function createComponentPreviewEditorTheme(theme: Theme): EditorTheme {
  return {
    borderColor: (str: string) => theme.fg('border', str),
    selectList: getSelectListTheme(),
  };
}
