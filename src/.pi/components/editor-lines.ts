const ANSI = '\x1b';
const ANSI_SEQUENCE_GLOBAL = new RegExp(`${ANSI}\\[[0-9;?]*[ -/]*[@-~]`, 'g');

export function stripAnsi(text: string): string {
  return text.replace(ANSI_SEQUENCE_GLOBAL, '');
}

/**
 * True for a full-width horizontal rule or `Editor`'s own scroll-indicator
 * line (`─── ↑ N more ───`) — both mark an `Editor`-drawn border, not content
 * or an autocomplete row.
 */
export function isEditorBorderLine(line: string): boolean {
  const stripped = stripAnsi(line);
  return /^─*$/.test(stripped) || /^─+\s[↑↓]\s\d+\smore\s─*$/.test(stripped);
}

export function findLastIndex<T>(items: readonly T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index--) {
    if (predicate(items[index]!)) return index;
  }
  return -1;
}

export function padContentToMinimum(
  contentLines: readonly string[],
  minLines: number,
  innerWidth: number,
): readonly string[] {
  const padCount = Math.max(0, minLines - contentLines.length);
  if (padCount === 0) return contentLines;
  return [...contentLines, ...Array.from({ length: padCount }, () => ' '.repeat(Math.max(0, innerWidth)))];
}

export function stripEditorBorder(
  innerLines: readonly string[],
  bottomIndex: number,
): { contentLines: readonly string[]; trailingLines: readonly string[] } {
  if (bottomIndex <= 0) return { contentLines: innerLines, trailingLines: [] };
  return {
    contentLines: innerLines.slice(1, bottomIndex),
    trailingLines: innerLines.slice(bottomIndex + 1),
  };
}
