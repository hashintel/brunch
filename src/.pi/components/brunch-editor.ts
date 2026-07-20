import { CustomEditor } from '@earendil-works/pi-coding-agent';
import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import type { EditorTheme, TUI } from '@earendil-works/pi-tui';

import { findLastIndex, isEditorBorderLine, padContentToMinimum, stripEditorBorder } from './editor-lines.js';
import { projectRoundedBox } from './rounded-box.js';

/**
 * Pre-formatted label strings baked into the box border.
 * Callers assemble these from runtime facts such as operational mode and spec
 * title; this module stays domain-ignorant.
 */
export interface BrunchEditorLabels {
  /** Right-aligned label embedded in the top border, e.g. '[ Specify ]'. Omit for a plain top border. */
  readonly topRight?: string;
  /** Right-aligned label embedded in the bottom border, e.g. '"Spec Title"'. Omit for a plain bottom border. */
  readonly bottomRight?: string;
}

/** "│ " + " │" reserved from the outer width before delegating to the wrapped inner renderer. */
const SIDE_BUDGET = 4;

/** Minimum content rows inside the box, even when the editor is empty. */
const MIN_CONTENT_LINES = 2;

function projectTrailingRows(
  trailingLines: readonly string[],
  width: number,
  borderColor: (str: string) => string,
): readonly string[] {
  if (trailingLines.length === 0) return [];
  return projectRoundedBox(trailingLines, { preserveContentWidth: true }, width, borderColor).slice(1, -1);
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
  return [...boxedContent, ...boxedTrailing];
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
