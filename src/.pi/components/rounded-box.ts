import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

export interface RoundedBoxOptions {
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  readonly thumbRows?: ReadonlySet<number>;
  readonly blankPadding?: {
    readonly top?: number;
    readonly bottom?: number;
  };
}

const SIDE_BUDGET = 4;

/**
 * Project content lines into a rounded box without owning any domain-specific
 * component state. Callers index `thumbRows` against their unpadded content.
 */
export function projectRoundedBox(
  contentLines: readonly string[],
  options: RoundedBoxOptions,
  width: number,
  borderColor: (text: string) => string,
): string[] {
  if (contentLines.length === 0) return [];

  const safeWidth = Math.max(SIDE_BUDGET, width);
  const topPadding = Math.max(0, options.blankPadding?.top ?? 0);
  const bottomPadding = Math.max(0, options.blankPadding?.bottom ?? 0);
  const rows = [
    ...Array.from({ length: topPadding }, () => ({ line: '', contentIndex: undefined })),
    ...contentLines.map((line, contentIndex) => ({ line, contentIndex })),
    ...Array.from({ length: bottomPadding }, () => ({ line: '', contentIndex: undefined })),
  ];

  return [
    borderLine('╭', '╮', options.topLabel, safeWidth, borderColor),
    ...rows.map(({ line, contentIndex }) =>
      contentLine(
        line,
        safeWidth,
        borderColor,
        contentIndex !== undefined && options.thumbRows?.has(contentIndex),
      ),
    ),
    borderLine('╰', '╯', options.bottomLabel, safeWidth, borderColor),
  ];
}

function borderLine(
  leftCorner: string,
  rightCorner: string,
  label: string | undefined,
  width: number,
  borderColor: (text: string) => string,
): string {
  if (!label) return colorBorderText(`${leftCorner}${'─'.repeat(width - 2)}${rightCorner}`, borderColor);

  const suffix = ` ${label} `;
  const dashCount = Math.max(0, width - 2 - 1 - visibleWidth(suffix));
  const raw = `${leftCorner}${'─'.repeat(dashCount)}${suffix}─${rightCorner}`;
  return colorBorderText(truncateToWidth(raw, width), borderColor);
}

function contentLine(
  content: string,
  width: number,
  borderColor: (text: string) => string,
  isThumbRow: boolean | undefined,
): string {
  const innerWidth = Math.max(0, width - SIDE_BUDGET);
  const inner = truncateToWidth(content, innerWidth);
  const padding = ' '.repeat(Math.max(0, innerWidth - visibleWidth(inner)));
  const rightBorder = isThumbRow ? '▐' : '│';
  return `${borderColor('│')} ${inner}${padding} ${borderColor(rightBorder)}`;
}

function colorBorderText(text: string, borderColor: (text: string) => string): string {
  return Array.from(text, (char) => (isBorderGlyph(char) ? borderColor(char) : char)).join('');
}

function isBorderGlyph(char: string): boolean {
  return char === '╭' || char === '╮' || char === '╰' || char === '╯' || char === '─';
}
