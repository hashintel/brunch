import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

export interface RoundedBoxPadding {
  /** Spaces between each side border glyph and the content (default 1). */
  readonly x?: number;
  /** Blank rows above the content (default 0). */
  readonly top?: number;
  /** Blank rows below the content (default 0). */
  readonly bottom?: number;
}

export interface RoundedBoxOptions {
  readonly topLabel?: string;
  readonly bottomLabel?: string;
  readonly labelAlign?: 'left' | 'right';
  readonly thumbRows?: ReadonlySet<number>;
  readonly preserveContentWidth?: boolean;
  readonly padding?: RoundedBoxPadding;
}

const DEFAULT_PADDING_X = 1;

function paddingX(options: RoundedBoxOptions): number {
  return Math.max(0, options.padding?.x ?? DEFAULT_PADDING_X);
}

/** Columns the box consumes around the content: two border glyphs plus padding on each side. */
export function roundedBoxSideBudget(padding?: RoundedBoxPadding): number {
  return 2 + Math.max(0, padding?.x ?? DEFAULT_PADDING_X) * 2;
}

/** Widest content that fits inside a box of `width` with the given padding. */
export function roundedBoxInnerWidth(width: number, padding?: RoundedBoxPadding): number {
  return Math.max(0, width - roundedBoxSideBudget(padding));
}

export interface StackedSections {
  readonly lines: readonly string[];
  /** Starting index of each input section within `lines`. */
  readonly offsets: readonly number[];
}

/**
 * Join content sections with a uniform blank-line gap. The box module owns
 * spacing — padding inside the border and margins between content sections —
 * so content components supply only their own lines and never author blank
 * margin rows themselves. Empty sections keep an offset but emit no gap.
 */
export function stackSections(sections: readonly (readonly string[])[], gap = 1): StackedSections {
  const lines: string[] = [];
  const offsets: number[] = [];
  const separator = Array.from({ length: Math.max(0, gap) }, () => '');
  for (const section of sections) {
    if (section.length > 0 && lines.length > 0) lines.push(...separator);
    offsets.push(lines.length);
    lines.push(...section);
  }
  return { lines, offsets };
}

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

  const sidePadding = paddingX(options);
  const safeWidth = Math.max(2 + sidePadding * 2, width);
  const topPadding = Math.max(0, options.padding?.top ?? 0);
  const bottomPadding = Math.max(0, options.padding?.bottom ?? 0);
  const rows = [
    ...Array.from({ length: topPadding }, () => ({ line: '', contentIndex: undefined })),
    ...contentLines.map((line, contentIndex) => ({ line, contentIndex })),
    ...Array.from({ length: bottomPadding }, () => ({ line: '', contentIndex: undefined })),
  ];

  return [
    borderLine('╭', '╮', options.topLabel, options.labelAlign ?? 'right', safeWidth, borderColor),
    ...rows.map(({ line, contentIndex }) =>
      contentLine(
        line,
        safeWidth,
        sidePadding,
        borderColor,
        contentIndex !== undefined && options.thumbRows?.has(contentIndex),
        options.preserveContentWidth,
      ),
    ),
    borderLine('╰', '╯', options.bottomLabel, options.labelAlign ?? 'right', safeWidth, borderColor),
  ];
}

function borderLine(
  leftCorner: string,
  rightCorner: string,
  label: string | undefined,
  labelAlign: 'left' | 'right',
  width: number,
  borderColor: (text: string) => string,
): string {
  if (!label) return borderColor(`${leftCorner}${'─'.repeat(width - 2)}${rightCorner}`);

  const suffix = ` ${label} `;
  const dashCount = Math.max(0, width - 2 - 1 - visibleWidth(suffix));
  const leftRun = labelAlign === 'left' ? `${leftCorner}─` : `${leftCorner}${'─'.repeat(dashCount)}`;
  const rightRun = labelAlign === 'left' ? `${'─'.repeat(dashCount)}${rightCorner}` : `─${rightCorner}`;
  const raw = `${leftRun}${suffix}${rightRun}`;

  if (visibleWidth(raw) > width) return colorBorderText(truncateToWidth(raw, width), borderColor);
  return `${borderColor(leftRun)}${suffix}${borderColor(rightRun)}`;
}

function contentLine(
  content: string,
  width: number,
  sidePadding: number,
  borderColor: (text: string) => string,
  isThumbRow: boolean | undefined,
  preserveContentWidth: boolean | undefined,
): string {
  const innerWidth = Math.max(0, width - 2 - sidePadding * 2);
  const pad = ' '.repeat(sidePadding);
  const inner = truncateToWidth(content, innerWidth);
  const fill = preserveContentWidth ? '' : ' '.repeat(Math.max(0, innerWidth - visibleWidth(inner)));
  const rightBorder = isThumbRow ? '▐' : '│';
  return `${borderColor('│')}${pad}${inner}${fill}${pad}${borderColor(rightBorder)}`;
}

function colorBorderText(text: string, borderColor: (text: string) => string): string {
  return Array.from(text, (char) => (isBorderGlyph(char) ? borderColor(char) : char)).join('');
}

function isBorderGlyph(char: string): boolean {
  return char === '╭' || char === '╮' || char === '╰' || char === '╯' || char === '─';
}
