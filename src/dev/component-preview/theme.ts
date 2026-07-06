import { readFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { getSelectListTheme, Theme, type ThemeColor } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

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
 * `BRUNCH_PREVIEW_THEME=light npm run dev:components` previews the light half
 * of the pair; the default is dark.
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

export function createComponentPreviewTheme(variant?: ComponentPreviewThemeVariant): Theme {
  const resolvedVariant = variant ?? (process.env.BRUNCH_PREVIEW_THEME === 'light' ? 'light' : 'dark');
  const raw = readFileSync(fileURLToPath(new URL(`brunch-${resolvedVariant}.json`, THEME_DIR)), 'utf8');
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

  return new Theme(
    fgColors as Record<ThemeColor, string>,
    bgColors as Record<ThemeBgToken, string>,
    'truecolor',
    { name: parsed.name },
  );
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
