/**
 * Shared markdown formatting substrate for Brunch LLM-facing text.
 *
 * Owns:
 * - thin wrapper helpers around md-pen
 * - shared fenced-block and escaping conventions
 * - no graph/session/exchange domain semantics
 */

import {
  blockquote,
  bold,
  code,
  codeBlock,
  escape,
  heading,
  hr,
  ol,
  strikethrough,
  table,
  taskList,
  ul,
} from 'md-pen';

export function markdownHeading(level: number, text: string): string {
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new RangeError(`Markdown heading level must be 1-6; received ${String(level)}`);
  }
  return heading(text.trim(), level as 1 | 2 | 3 | 4 | 5 | 6);
}

export function markdownBullet(text: string): string {
  return `- ${text}`;
}

export function markdownBold(text: string): string {
  const rendered = bold(text);
  return rendered.startsWith('__') && rendered.endsWith('__') ? `**${rendered.slice(2, -2)}**` : rendered;
}

export function markdownStrikethrough(text: string): string {
  return strikethrough(text);
}

export function markdownBlockquote(text: string): string {
  return blockquote(text.trim());
}

export function markdownCodeBlock(contents: string, language?: string): string {
  return codeBlock(contents, language);
}

export function markdownTable(rows: Array<Array<string | number | boolean>>): string {
  return table(rows);
}

export function markdownUl(items: string[]): string {
  return ul(items);
}

export function markdownOl(items: string[]): string {
  return ol(items);
}

export function markdownTaskList(items: Array<[boolean, string]>): string {
  return taskList(items);
}

export function markdownHr(): string {
  return hr();
}

export function inlineCode(text: string): string {
  return code(text);
}

export function markdownEscape(text: string): string {
  return escape(text);
}

export function joinMarkdownBlocks(...blocks: Array<string | null | undefined | false>): string {
  return blocks
    .filter((block): block is string => typeof block === 'string')
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .join('\n\n');
}
