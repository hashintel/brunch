import { getSelectListTheme, Theme, type ThemeColor } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

/**
 * Real 256-color palette for the standalone component preview harness
 * (`npm run dev:components`). Constructs an actual `pi-coding-agent` `Theme`
 * instance — the same class production components receive as `ctx.ui.custom`'s
 * `theme` argument (`.fg`/`.bg`/`.inverse`/`.getFgAnsi` behave identically) —
 * so previewed components are styled by the real rendering class, not a
 * duck-typed stand-in.
 *
 * ceiling: hand-authored color table, not pi's shipped dark.json/light.json.
 * pi-coding-agent's real theme-loading pipeline (vars indirection + hex-to-256
 * resolution) lives behind `theme.ts` internals that the package's `exports`
 * map does not expose outside a running session (only `.` and `./rpc-entry`
 * are importable). This reproduces the same *class and method behavior*,
 * seeded with the numeric 256-color codes Brunch components already depend on
 * (matching `src/.pi/__tests__/support/tui-theme.ts` and existing component
 * tests), rather than pi's exact shipped hex values. Revisit only if exact
 * shipped colors become load-bearing for a previewed component.
 */
const FG_COLORS: Record<ThemeColor, string | number> = {
  accent: 33,
  border: 33,
  borderAccent: 39,
  borderMuted: 240,
  success: 34,
  error: 196,
  warning: 220,
  muted: 244,
  dim: 240,
  text: '',
  thinkingText: 244,
  userMessageText: 39,
  customMessageText: 99,
  customMessageLabel: 99,
  toolTitle: 69,
  toolOutput: 244,
  mdHeading: 33,
  mdLink: 39,
  mdLinkUrl: 240,
  mdCode: 141,
  mdCodeBlock: 141,
  mdCodeBlockBorder: 240,
  mdQuote: 244,
  mdQuoteBorder: 240,
  mdHr: 240,
  mdListBullet: 33,
  toolDiffAdded: 34,
  toolDiffRemoved: 196,
  toolDiffContext: 244,
  syntaxComment: 244,
  syntaxKeyword: 141,
  syntaxFunction: 33,
  syntaxVariable: 39,
  syntaxString: 34,
  syntaxNumber: 220,
  syntaxType: 141,
  syntaxOperator: 244,
  syntaxPunctuation: 244,
  thinkingOff: 240,
  thinkingMinimal: 244,
  thinkingLow: 33,
  thinkingMedium: 220,
  thinkingHigh: 196,
  thinkingXhigh: 196,
  bashMode: 220,
};

const BG_COLORS = {
  selectedBg: 237,
  userMessageBg: 236,
  customMessageBg: 235,
  toolPendingBg: 236,
  toolSuccessBg: 22,
  toolErrorBg: 52,
};

export function createComponentPreviewTheme(): Theme {
  return new Theme(FG_COLORS, BG_COLORS, '256color', { name: 'brunch-dev-preview' });
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
