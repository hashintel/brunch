import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getSelectListTheme, Theme, type ThemeColor } from '@earendil-works/pi-coding-agent';
import type { EditorTheme, TUI } from '@earendil-works/pi-tui';

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
}

export type ComponentPreviewThemeVariant = 'dark' | 'light';

export function resolveInitialComponentPreviewThemeVariant(): ComponentPreviewThemeVariant {
  return process.env.BRUNCH_PREVIEW_THEME === 'light' ? 'light' : 'dark';
}

interface BrunchThemePalette {
  readonly name: string;
  readonly fgColors: Record<ThemeColor, string>;
  readonly bgColors: Record<ThemeBgToken, string>;
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
  readonly #variants: Record<ComponentPreviewThemeVariant, Theme>;
  #active: ComponentPreviewThemeVariant;

  constructor(initial: ComponentPreviewThemeVariant = resolveInitialComponentPreviewThemeVariant()) {
    const palette = loadBrunchThemePalette(initial);
    super(palette.fgColors, palette.bgColors, 'truecolor', { name: palette.name });
    this.#variants = {
      dark: createComponentPreviewTheme('dark'),
      light: createComponentPreviewTheme('light'),
    };
    this.#active = initial;
  }

  get variant(): ComponentPreviewThemeVariant {
    return this.#active;
  }

  toggle(): ComponentPreviewThemeVariant {
    this.#active = this.#active === 'dark' ? 'light' : 'dark';
    return this.#active;
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

const CTRL_T = '\x14';

/**
 * Global ctrl+t theme toggle for the preview harness. Registered as a TUI
 * input listener, which pi-tui runs *before* focused-component dispatch —
 * `{ consume: true }` guarantees no previewed component (editors included)
 * ever sees the keystroke. The invalidate-then-render pair mirrors pi-tui's
 * own theme-change choreography (`Component.invalidate()` is documented as
 * "called when theme changes" and `TUI.invalidate()` propagates to children
 * and overlays).
 */
export function registerComponentPreviewThemeToggle(
  tui: TUI,
  theme: SwitchableComponentPreviewTheme,
): () => void {
  return tui.addInputListener((data) => {
    if (data !== CTRL_T) return undefined;
    theme.toggle();
    tui.invalidate();
    tui.requestRender();
    return { consume: true };
  });
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
