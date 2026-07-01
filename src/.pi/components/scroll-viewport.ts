/**
 * A pure, domain-ignorant scroll-window primitive — sibling to `projectBorderedChrome`
 * (`brunch-editor.ts`). Takes any content lines plus a fixed viewport height and returns exactly the
 * visible slice, clamped, along with which of those visible rows the scroll thumb should occupy.
 *
 * Converged shape (confirmed against pi-tui's own `Editor`/`SelectList` windowing, then cross-checked
 * against glyph, opentui, and lazygit/gocui — all five independently arrive at the same model): a
 * caller either owns free-scroll state (`offset`
 * authoritative) or, as here, tracks a selected index and asks the window to keep it visible
 * (`SelectList`'s own centered-window formula, reused verbatim since it's already the established
 * in-repo/in-dependency precedent for this exact list shape).
 *
 * Deliberately takes a fixed `height`, not a `TUI`/terminal reference — `Editor` derives its viewport
 * from `tui.terminal.rows` because it already holds a `TUI` for cursor/paging reasons; a component with
 * no other need for a `TUI` reference (e.g. `WorkspaceDialogComponent`) shouldn't acquire one just for
 * this. `SelectList`'s fixed `maxVisible: number` is the precedented fit.
 *
 * Thumb math (size/position) mirrors gocui/glyph's converged proportional formula. The thumb is
 * reported per-row rather than rendered here: folding it into an existing border character (as
 * gocui/lazygit do, `▐` replacing `│`) is the intended consumption pattern, and only the caller knows
 * where its border characters live.
 *
 * Wheel-scroll passthrough and true pointer-hover hit-testing are explicitly out of scope for this
 * primitive — see the card's Decisions table for why.
 */
export interface ScrollWindow {
  /** The visible slice: `content.length` lines if everything fits, otherwise exactly `height` lines. */
  readonly lines: readonly string[];
  /** The clamped scroll offset actually used — index into `content` of `lines[0]`. */
  readonly offset: number;
  /**
   * Parallel to `lines` (same length): true for rows the scroll thumb should occupy. All false when
   * `content` fits within `height` — callers should draw a plain border, not a thumb, in that case.
   */
  readonly isThumbRow: readonly boolean[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function projectScrollViewport(
  content: readonly string[],
  height: number,
  keepVisible?: number,
): ScrollWindow {
  const total = content.length;
  const safeHeight = Math.max(1, height);

  if (total <= safeHeight) {
    return { lines: content, offset: 0, isThumbRow: content.map(() => false) };
  }

  const maxOffset = total - safeHeight;
  const offset =
    keepVisible === undefined ? 0 : clamp(keepVisible - Math.floor(safeHeight / 2), 0, maxOffset);
  const lines = content.slice(offset, offset + safeHeight);

  const thumbSize = Math.max(1, Math.floor((safeHeight / total) * safeHeight));
  const travel = Math.max(0, safeHeight - thumbSize);
  const thumbStart = maxOffset > 0 ? Math.floor((offset / maxOffset) * travel) : 0;
  const isThumbRow = Array.from(
    { length: safeHeight },
    (_, index) => index >= thumbStart && index < thumbStart + thumbSize,
  );

  return { lines, offset, isThumbRow };
}
