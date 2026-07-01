import { CustomEditor } from '@earendil-works/pi-coding-agent';
import type { KeybindingsManager } from '@earendil-works/pi-coding-agent';
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { EditorTheme, TUI } from '@earendil-works/pi-tui';

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
  /** Lines appended immediately below the box (not part of the border). */
  readonly belowLines?: readonly string[];
}

/** "│ " + " │" reserved from the outer width before delegating to the wrapped inner renderer. */
const SIDE_BUDGET = 4;

const ANSI = '\x1b';
const ANSI_SEQUENCE_GLOBAL = new RegExp(`${ANSI}\\[[0-9;?]*[ -/]*[@-~]`, 'g');

function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE_GLOBAL, '');
}

/**
 * True for a full-width horizontal rule or `Editor`'s own scroll-indicator
 * line (`─── ↑ N more ───`) — both mark an `Editor`-drawn border, not content
 * or an autocomplete row. `Editor`'s own `render()` (pi-tui) draws no side
 * borders at all and appends autocomplete-dropdown rows *after* its bottom
 * border line, so the bottom border is not reliably the last array element —
 * this predicate is how `projectBorderedChrome` finds it regardless.
 */
function isEditorBorderLine(line: string): boolean {
  const stripped = stripAnsi(line);
  return /^─*$/.test(stripped) || /^─+\s[↑↓]\s\d+\smore\s─*$/.test(stripped);
}

function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index]!)) return index;
  }
  return -1;
}

/**
 * Right-align `label` into a border line built from scratch (`leftCorner` +
 * dashes + label + dash + `rightCorner`), truncating gracefully when the
 * label doesn't fit. `undefined` label produces a plain rule.
 */
function borderLine(
  leftCorner: string,
  rightCorner: string,
  label: string | undefined,
  width: number,
  borderColor: (str: string) => string,
): string {
  const safeWidth = Math.max(2, width);
  if (!label) {
    return borderColor(`${leftCorner}${'─'.repeat(safeWidth - 2)}${rightCorner}`);
  }
  const suffix = ` ${label} `;
  const dashCount = Math.max(0, safeWidth - 2 - 1 - visibleWidth(suffix));
  const raw = `${leftCorner}${'─'.repeat(dashCount)}${suffix}─${rightCorner}`;
  return borderColor(truncateToWidth(raw, safeWidth));
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

  const bottomIndex = findLastIndex(innerLines, isEditorBorderLine);
  const lines = innerLines.map((line, index) => {
    if (index === 0) return borderLine('┌', '┐', labels.topRight, width, borderColor);
    if (index === bottomIndex) return borderLine('└', '┘', labels.bottomRight, width, borderColor);
    return `${borderColor('│')} ${line} ${borderColor('│')}`;
  });

  const below = (labels.belowLines ?? []).map((line) => truncateToWidth(line, width));
  return [...lines, ...below];
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
  ) {
    super(tui, editorTheme, keybindings);
  }

  override render(width: number): string[] {
    const innerWidth = Math.max(1, width - SIDE_BUDGET);
    const innerLines = super.render(innerWidth);
    return projectBorderedChrome(innerLines, this.getLabels(), width, this.editorTheme.borderColor);
  }
}
