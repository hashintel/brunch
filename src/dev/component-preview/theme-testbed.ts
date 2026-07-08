import { getMarkdownTheme, type Theme, type ThemeColor } from '@earendil-works/pi-coding-agent';
import { type Component, Key, Markdown, matchesKey, type TUI } from '@earendil-works/pi-tui';

import { CONSULT_MENU_SURFACE_IDENTITY_BORDER_ROLE } from '../../.pi/components/consult-menu.js';
import { OPERATIONAL_MODE_BORDER_COLOR_ROLES } from '../../.pi/components/mode-border-theme.js';
import { createStructuredExchangeMarkdownTheme } from '../../.pi/extensions/exchanges/shared/markdown.js';
import { loadComponentPreviewBorderColorRoles } from './theme.js';

/**
 * Pi shares its theme singleton across module instances through a registered
 * global symbol (`Symbol.for('@earendil-works/pi-coding-agent:theme')` —
 * see the "ensures all module instances see the same theme" comment in pi's
 * theme.ts). In a live session pi's boot initializes it; the harness has no
 * session, so the testbed installs the preview theme there to make the
 * *public* `getMarkdownTheme()` / `highlightCode()` exports usable. Because
 * the preview theme delegates every color read, toggle and hot-reload flow
 * through to pi's markdown + syntax rendering live.
 */
const PI_THEME_GLOBAL = Symbol.for('@earendil-works/pi-coding-agent:theme');

function installPreviewThemeAsPiGlobal(theme: Theme): void {
  // A bound facade, not the instance itself: pi reads the global through a
  // Proxy whose method calls arrive with `this` = proxy, which breaks the
  // preview theme's private-field delegation. Binding keeps every read live.
  const facade: Record<string, unknown> = {};
  for (
    let prototype = Object.getPrototypeOf(theme) as object | null;
    prototype !== null && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype) as object | null
  ) {
    for (const name of Object.getOwnPropertyNames(prototype)) {
      if (name === 'constructor' || name in facade) continue;
      const value = (theme as unknown as Record<string, unknown>)[name];
      if (typeof value === 'function') facade[name] = value.bind(theme);
    }
  }
  (globalThis as Record<symbol, unknown>)[PI_THEME_GLOBAL] = facade;
}

const MARKDOWN_FIXTURE = `# Heading one — the quick brown fox

## Heading two · sub-structure

Body text with **bold**, *italic*, ~~strikethrough~~, and \`inline code\`.
A [link label](https://example.com/docs) sits inline; below is a quote:

> Quoted guidance line — muted but must stay readable against the page.
> Second quote line with \`inline code\` inside.

- bullet item one
- bullet item two with **bold emphasis**
  - nested bullet
1. ordered item
2. ordered item

---

\`\`\`typescript
// comment: resolve the palette per variant
export function resolve(vars: Record<string, string>, value: string): string {
  const hex = vars[value] ?? value;
  if (!hex.startsWith('#')) throw new Error(\`unresolved: \${value}\`);
  return hex.toLowerCase();
}
\`\`\`

\`\`\`python
# comment: same shape in python
def resolve(vars: dict[str, str], value: str) -> str:
    hex = vars.get(value, value)
    assert hex.startswith("#"), f"unresolved: {value}"
    return hex.lower()
\`\`\`

\`\`\`json
{ "name": "brunch-dark", "vars": { "fuchsia": "#e871ab" }, "count": 42 }
\`\`\`

\`\`\`
unlabeled code block — rendered flat with mdCodeBlock, no token colors
\`\`\`
`;

/** Fg tokens that carry running text or chrome — the contrast-critical set. */
const CONTRAST_FG_TOKENS: readonly ThemeColor[] = [
  'text',
  'muted',
  'dim',
  'thinkingText',
  'toolOutput',
  'border',
  'borderMuted',
  'accent',
  'customMessageLabel',
  'success',
  'warning',
  'error',
];

const SAMPLE = 'the quick brown fox jumps over 0123456789';

function fgRole(theme: Theme, role: string, text: string): string {
  return theme.fg(role as ThemeColor, text);
}

function textVariationStrip(theme: Theme): string[] {
  const markdownBody = new Markdown(
    'markdown body sample with **bold**, *italic*, `code`, and [link](https://example.com)',
    0,
    0,
    createStructuredExchangeMarkdownTheme(theme),
  );
  return [
    theme.fg('accent', '— text variations —'),
    `plain       ${theme.fg('text', SAMPLE)}`,
    `emphasis    ${theme.bold(SAMPLE)}  ${theme.italic(SAMPLE)}  ${theme.underline(SAMPLE)}`,
    `dim         ${theme.fg('dim', SAMPLE)}`,
    `muted       ${theme.fg('muted', SAMPLE)}`,
    `accent      ${theme.fg('accent', SAMPLE)}`,
    ...markdownBody.render(88),
  ];
}

function borderLevelsStrip(theme: Theme): string[] {
  return [
    theme.fg('accent', '— border levels —'),
    `borderMuted  ${fgRole(theme, 'borderMuted', '╭────────────────╮')} subtle / nested`,
    `border       ${fgRole(theme, 'border', '╭────────────────╮')} ordinary chrome`,
    `borderAccent ${fgRole(theme, 'borderAccent', '╭────────────────╮')} identity / emphasis`,
  ];
}

function borderSemanticsStrip(theme: Theme): string[] {
  const modeRows = Object.entries(OPERATIONAL_MODE_BORDER_COLOR_ROLES).map(
    ([mode, role]) =>
      `${`${mode.slice(0, 1).toUpperCase()}${mode.slice(1)} mode`.padEnd(14)} ${fgRole(theme, role, '╭────────────────╮')} ${role}`,
  );
  const surfaceRows = [
    `Consult menu ${fgRole(theme, CONSULT_MENU_SURFACE_IDENTITY_BORDER_ROLE, '╭────────────────╮')} ${CONSULT_MENU_SURFACE_IDENTITY_BORDER_ROLE}`,
    `Workspace   ${fgRole(theme, 'borderMuted', '╭────────────────╮')} borderMuted`,
  ];
  const allThemeBorderRoles = loadComponentPreviewBorderColorRoles().map(
    (role) => `${role.padEnd(18)} ${fgRole(theme, role, '╭────────╮')}`,
  );
  return [
    theme.fg('accent', '— mode-reactive border roles —'),
    ...modeRows,
    '',
    theme.fg('accent', '— surface-identity border roles —'),
    ...surfaceRows,
    '',
    theme.fg('accent', '— all border roles from theme files —'),
    ...allThemeBorderRoles,
  ];
}

function contrastStrip(theme: Theme): string[] {
  const lines = [
    theme.fg('accent', '— contrast strip (fg tokens on page background) —'),
    ...CONTRAST_FG_TOKENS.map((token) => `${token.padEnd(20)} ${theme.fg(token, SAMPLE)}`),
    '',
    theme.fg('accent', '— bg tokens (text token over each) —'),
    ...(
      [
        'selectedBg',
        'userMessageBg',
        'customMessageBg',
        'toolPendingBg',
        'toolSuccessBg',
        'toolErrorBg',
      ] as const
    ).map((token) => `${token.padEnd(20)} ${theme.bg(token, ` ${theme.fg('text', SAMPLE)} `)}`),
  ];
  return lines;
}

/**
 * Scrollable testbed for pinning markdown, syntax-highlighting, and gray/
 * contrast theme values. Renders the same fixture through both live markdown
 * surfaces — Brunch's exchange renderer theme (flat code blocks by design)
 * and pi's assistant-message theme (real highlight.js token colors via the
 * syntax* tokens) — plus a contrast strip of the text/gray ramp over the
 * page and message backgrounds. Edit `src/.pi/themes/brunch-*.json` while
 * this is open: the watcher hot-reloads values, ctrl+t compares halves.
 */
export class ThemeTestbedComponent implements Component {
  #scrollTop = 0;
  readonly #exchangeMarkdown: Markdown;
  readonly #assistantMarkdown: Markdown;

  constructor(
    private readonly theme: Theme,
    private readonly tui: TUI,
    private readonly onDone: () => void,
  ) {
    installPreviewThemeAsPiGlobal(theme);
    this.#exchangeMarkdown = new Markdown(
      MARKDOWN_FIXTURE,
      0,
      0,
      createStructuredExchangeMarkdownTheme(theme),
    );
    this.#assistantMarkdown = new Markdown(MARKDOWN_FIXTURE, 0, 0, getMarkdownTheme());
  }

  render(width: number): string[] {
    const safeWidth = Math.max(24, width);
    const contentWidth = Math.min(safeWidth, 100);
    const all = [
      this.theme.fg(
        'dim',
        '↑/↓ or j/k scroll · ctrl+t theme · edit src/.pi/themes/*.json to hot-reload · esc/q back',
      ),
      '',
      this.theme.fg('accent', '━━ pi assistant surface (getMarkdownTheme + syntax* tokens) ━━'),
      '',
      ...this.#assistantMarkdown.render(contentWidth),
      '',
      this.theme.fg('accent', '━━ brunch exchange surface (createStructuredExchangeMarkdownTheme) ━━'),
      '',
      ...this.#exchangeMarkdown.render(contentWidth),
      '',
      ...textVariationStrip(this.theme),
      '',
      ...borderLevelsStrip(this.theme),
      '',
      ...borderSemanticsStrip(this.theme),
      '',
      ...contrastStrip(this.theme),
    ];
    const height = Math.max(8, this.tui.terminal.rows - 1);
    const maxTop = Math.max(0, all.length - height);
    this.#scrollTop = Math.min(this.#scrollTop, maxTop);
    return all.slice(this.#scrollTop, this.#scrollTop + height);
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, 'q')) {
      this.onDone();
      return;
    }
    if (matchesKey(data, Key.down) || matchesKey(data, 'j')) {
      this.#scrollTop += 2;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.up) || matchesKey(data, 'k')) {
      this.#scrollTop = Math.max(0, this.#scrollTop - 2);
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.pageDown)) {
      this.#scrollTop += 20;
      this.tui.requestRender();
      return;
    }
    if (matchesKey(data, Key.pageUp)) {
      this.#scrollTop = Math.max(0, this.#scrollTop - 20);
      this.tui.requestRender();
    }
  }

  invalidate(): void {
    this.#exchangeMarkdown.invalidate();
    this.#assistantMarkdown.invalidate();
  }
}
