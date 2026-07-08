import { Markdown, type MarkdownTheme } from '@earendil-works/pi-tui';

interface ThemeLike {
  fg?: (color: never, text: string) => string;
  bold?: (text: string) => string;
  italic?: (text: string) => string;
  underline?: (text: string) => string;
  strikethrough?: (text: string) => string;
}

export function createStructuredExchangeMarkdownTheme(theme?: ThemeLike): MarkdownTheme {
  const color = (name: string) => (text: string) => (theme?.fg ? theme.fg(name as never, text) : text);
  const identity = (text: string) => text;
  return {
    heading: color('mdHeading'),
    link: color('mdLink'),
    linkUrl: color('mdLinkUrl'),
    code: color('mdCode'),
    codeBlock: color('mdCodeBlock'),
    codeBlockBorder: color('mdCodeBlockBorder'),
    quote: color('mdQuote'),
    quoteBorder: color('mdQuoteBorder'),
    hr: color('mdHr'),
    listBullet: color('mdListBullet'),
    bold: theme?.bold ?? identity,
    italic: theme?.italic ?? identity,
    underline: theme?.underline ?? identity,
    strikethrough: theme?.strikethrough ?? identity,
    highlightCode: (code: string) => code.split('\n').map(color('mdCodeBlock')),
  };
}

export function renderExchangeMarkdownBodyLines(
  body: string | undefined,
  theme: ThemeLike | undefined,
  width: number,
): string[] {
  const trimmed = body?.trim();
  if (!trimmed) return [];
  return new Markdown(trimmed, 0, 0, createStructuredExchangeMarkdownTheme(theme)).render(Math.max(1, width));
}
