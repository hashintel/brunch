import { Markdown, Text } from '@earendil-works/pi-tui';

import { createStructuredExchangeMarkdownTheme } from '../../../components/exchange-markdown-body.js';
import { withLateralPadding } from '../../../components/lateral-padding.js';

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

export { createStructuredExchangeMarkdownTheme } from '../../../components/exchange-markdown-body.js';

export function renderMarkdownResult(
  result: ToolResultLike,
  theme?: Parameters<typeof createStructuredExchangeMarkdownTheme>[0],
) {
  return withLateralPadding(
    new Markdown(textFromToolContent(result), 0, 0, createStructuredExchangeMarkdownTheme(theme)),
  );
}

export function renderEmptyStructuredExchangeCall() {
  // Structured-exchange renderCall is intentionally invisible: durable semantics
  // and user-visible text live in the tool result content (D37-L/D104-L).
  return renderMarkdownResult({ content: [] });
}

export function renderPlainResult(result: ToolResultLike) {
  return new Text(textFromToolContent(result), 0, 0);
}
