import { CustomEditor } from '@earendil-works/pi-coding-agent';
import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { getCapabilities, hyperlink, truncateToWidth } from '@earendil-works/pi-tui';
import type { EditorTheme, TUI } from '@earendil-works/pi-tui';

import { findLastIndex, isEditorBorderLine, padContentToMinimum, stripEditorBorder } from './editor-lines.js';
import { projectRoundedBox } from './rounded-box.js';

/**
 * Pre-formatted label strings baked into the box border / trailing lines.
 * Callers assemble these from whatever runtime facts they have (operational
 * mode, spec title, sidecar URL, model/context usage, ...) — this module
 * stays domain-ignorant so `projectBorderedChrome` can be reused for other
 * bordered components later (the `request_*` question-form pickers are the
 * next intended reuse; see `memory/PLAN.md`'s `component-dx` frontier).
 */
export interface BrunchEditorLabels {
  /** Right-aligned label embedded in the top border, e.g. '[ Specify ]'. Omit for a plain top border. */
  readonly topRight?: string;
  /** Right-aligned label embedded in the bottom border, e.g. '"Spec Title"'. Omit for a plain bottom border. */
  readonly bottomRight?: string;
  /**
   * Lines appended immediately below the box (not part of the border). A
   * plain string renders as-is; `{ text, url }` renders as a clickable OSC 8
   * hyperlink where the terminal supports it (falls back to plain `text`
   * otherwise) — kept as a union rather than a dedicated "url" field so this
   * stays generic for any future bordered component's below-lines, not just
   * this editor's sidecar URL.
   */
  readonly belowLines?: readonly (string | { readonly text: string; readonly url: string })[];
}

/** "│ " + " │" reserved from the outer width before delegating to the wrapped inner renderer. */
const SIDE_BUDGET = 4;

/** Minimum content rows inside the box, even when the editor is empty. */
const MIN_CONTENT_LINES = 2;

/** Left indent applied to lines below the box. */
const BELOW_LINES_INDENT = 1;

function projectTrailingRows(
  trailingLines: readonly string[],
  width: number,
  borderColor: (str: string) => string,
): readonly string[] {
  if (trailingLines.length === 0) return [];
  return projectRoundedBox(trailingLines, { preserveContentWidth: true }, width, borderColor).slice(1, -1);
}

/** Renders `text` as a clickable OSC 8 hyperlink where the terminal supports it, plain text otherwise. */
function renderLinkedText(text: string, url: string): string {
  return getCapabilities().hyperlinks ? hyperlink(text, url) : text;
}

/**
 * Splice runtime-state labels into an already-rendered bordered box, and
 * append trailing lines below it.
 *
 * `innerLines` is the untouched output of another component's
 * `render(innerWidth)` where `innerWidth = width - 4` (room for a `│ `/` │`
 * side wrap) — this function only assumes an `Editor`-shaped border contract
 * (`isEditorBorderLine`), not anything editor-specific, so it stays reusable
 * for other bordered components.
 */
export function projectBorderedChrome(
  innerLines: readonly string[],
  labels: BrunchEditorLabels,
  width: number,
  borderColor: (str: string) => string,
): string[] {
  if (innerLines.length === 0) return [];

  const rawBottomIndex = findLastIndex(innerLines, isEditorBorderLine);
  const { contentLines, trailingLines } = stripEditorBorder(innerLines, rawBottomIndex);
  const boxedContent = projectRoundedBox(
    padContentToMinimum(contentLines, MIN_CONTENT_LINES, Math.max(1, width - SIDE_BUDGET)),
    {
      ...(labels.topRight !== undefined ? { topLabel: labels.topRight } : {}),
      ...(labels.bottomRight !== undefined ? { bottomLabel: labels.bottomRight } : {}),
      preserveContentWidth: true,
    },
    width,
    borderColor,
  );
  const boxedTrailing = projectTrailingRows(trailingLines, width, borderColor);

  const belowWidth = Math.max(0, width - BELOW_LINES_INDENT);
  const indent = ' '.repeat(BELOW_LINES_INDENT);
  const below = (labels.belowLines ?? []).map((line) => {
    const text = typeof line === 'string' ? line : renderLinkedText(line.text, line.url);
    return indent + truncateToWidth(text, belowWidth);
  });
  return [...boxedContent, ...boxedTrailing, ...below];
}

/**
 * Wraps the default `CustomEditor` in a left/right `│` box and embeds
 * runtime-state labels into the border — the default `Editor` box has no
 * side borders at all, so the wrapped editor renders at `width - SIDE_BUDGET`
 * and every returned line (border, content, and any autocomplete rows) gets
 * boxed by `projectBorderedChrome`, mirroring how `CardComponent` (`cards.ts`)
 * already boxes Markdown content.
 *
 * `getLabels` is pulled fresh on every `render()` call, never cached — the
 * same freshness contract `src/.pi/extensions/chrome/index.ts` already uses
 * for the footer/header (`options?.telemetry?.()`).
 */
export class BrunchEditorComponent extends CustomEditor {
  constructor(
    tui: TUI,
    private readonly editorTheme: EditorTheme,
    keybindings: KeybindingsManager,
    private readonly getLabels: () => BrunchEditorLabels,
    private readonly getBorderColor: () => (str: string) => string = () => editorTheme.borderColor,
  ) {
    super(tui, editorTheme, keybindings);
  }

  override render(width: number): string[] {
    const innerWidth = Math.max(1, width - SIDE_BUDGET);
    const innerLines = super.render(innerWidth);
    return projectBorderedChrome(innerLines, this.getLabels(), width, this.getBorderColor());
  }
}
