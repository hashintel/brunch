import { Markdown, Text, type MarkdownTheme } from '@earendil-works/pi-tui';

import { withLateralPadding } from '../../../components/lateral-padding.js';

interface ThemeLike {
  fg?: (color: never, text: string) => string;
  bold?: (text: string) => string;
  italic?: (text: string) => string;
  underline?: (text: string) => string;
  strikethrough?: (text: string) => string;
}

interface ToolTextContentLike {
  type?: string;
  text?: string;
}

interface ToolResultLike {
  content?: ToolTextContentLike[];
}

export function textFromToolContent(result: ToolResultLike): string {
  const first = result.content?.[0];
  return first?.type === 'text' && typeof first.text === 'string' ? first.text : '';
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

export function renderMarkdownResult(result: ToolResultLike, theme?: ThemeLike) {
  return withLateralPadding(
    new Markdown(textFromToolContent(result), 0, 0, createStructuredExchangeMarkdownTheme(theme)),
  );
}

export function renderPlainResult(result: ToolResultLike) {
  return new Text(textFromToolContent(result), 0, 0);
}

export function markdownEscape(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

export function normalizeOptionalText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
