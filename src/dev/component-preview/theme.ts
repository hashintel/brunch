import { readFileSync, watch } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getSelectListTheme, Theme, type ThemeColor } from '@earendil-works/pi-coding-agent';
import { type EditorTheme, isKeyRelease, Key, matchesKey, type TUI } from '@earendil-works/pi-tui';

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
  export?: { pageBg?: string };
}

export type ComponentPreviewThemeVariant = 'dark' | 'light';

export function resolveInitialComponentPreviewThemeVariant(): ComponentPreviewThemeVariant {
  return process.env.BRUNCH_PREVIEW_THEME === 'light' ? 'light' : 'dark';
}

interface BrunchThemePalette {
  readonly name: string;
  readonly fgColors: Record<ThemeColor, string>;
  readonly bgColors: Record<ThemeBgToken, string>;
  /** Whole-page background from the theme's `export` block (used for OSC 11). */
  readonly pageBg: string | undefined;
}

function loadBrunchThemePalette(variant: ComponentPreviewThemeVariant): BrunchThemePalette {
  const raw = readFileSync(fileURLToPath(new URL(`brunch-${variant}.json`, THEME_DIR)), 'utf8');
  const parsed = JSON.parse(raw) as BrunchThemeJson;
  const vars = parsed.vars ?? {};
  const resolve = (value: string): string => vars[value] ?? value;

  const fgColors: Record<string, string> = {};
  const bgColors: Record<string, string> = {};
  for (const [token, value] of Object.entries(parsed.colors)) {
    if ((BG_TOKENS as readonly string[]).includes(token)) {
      bgColors[token] = resolve(value);
    } else {
      fgColors[token] = resolve(value);
    }
  }

  return {
    name: parsed.name,
    fgColors: fgColors as Record<ThemeColor, string>,
    bgColors: bgColors as Record<ThemeBgToken, string>,
    pageBg: parsed.export?.pageBg !== undefined ? resolve(parsed.export.pageBg) : undefined,
  };
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
    this.#pageFgs = { dark: darkPalette.fgColors.text, light: lightPalette.fgColors.text };
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
   * Active variant's default-foreground hex (the `text` token). Painted via
   * OSC 10 so *unstyled* component text — markdown body, picker labels,
   * anything not wrapped in `theme.fg(...)` — adopts the theme's text color
   * instead of the terminal's own default.
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
   * Throws on unreadable/invalid JSON; callers decide whether a bad
   * mid-edit save is fatal (the watcher below just keeps the last good set).
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
    this.#pageFgs = { dark: darkPalette.fgColors.text, light: lightPalette.fgColors.text };
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
// ceiling: OSC 10/11 support varies by emulator (Ghostty/kitty/iTerm2/WezTerm
// honor them; Zed's built-in terminal ignores them silently, keeping its own
// colors). There is no reliable capability query worth the complexity for a
// dev harness; revisit only if painted defaults become required in an
// unsupporting terminal we care about.
function paintTerminalThemeColors(tui: TUI, theme: SwitchableComponentPreviewTheme): void {
  // OSC 10 = default foreground (unstyled text), OSC 11 = default background.
  if (theme.pageFg !== undefined) tui.terminal.write(`\x1b]10;${theme.pageFg}\x07`);
  if (theme.pageBg !== undefined) tui.terminal.write(`\x1b]11;${theme.pageBg}\x07`);
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
    tui.requestRender();
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
export function watchComponentPreviewTheme(tui: TUI, theme: SwitchableComponentPreviewTheme): () => void {
  let timer: NodeJS.Timeout | undefined;
  const watcher = watch(fileURLToPath(THEME_DIR), (_event, filename) => {
    if (filename !== null && !/^brunch-.*\.json$/.test(filename)) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        theme.reload();
      } catch {
        return; // mid-edit invalid JSON: keep the last good palette
      }
      paintTerminalThemeColors(tui, theme);
      tui.invalidate();
      tui.requestRender();
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
