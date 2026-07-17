import { zRequestDetails } from '../../../../exchanges/schemas/index.js';
import {
  ExchangeTerminalResultComponent,
  type ExchangeTerminalStatus,
} from '../../../components/exchange-terminal-result.js';
import { withLateralPadding } from '../../../components/lateral-padding.js';
import { renderMarkdownResult, textFromToolContent } from './markdown.js';
import type { ExchangeValidationFailureDetails } from './validation.js';

interface ToolResultLike {
  readonly content?: { readonly type?: string; readonly text?: string }[];
  readonly details?: unknown;
}

interface ThemeLike {
  fg?: (color: never, text: string) => string;
  bold?: (text: string) => string;
}

function isValidationFailureDetails(value: unknown): value is ExchangeValidationFailureDetails {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const details = value as Record<string, unknown>;
  if (Object.keys(details).some((key) => !['status', 'tool', 'diagnostics'].includes(key))) return false;
  if (
    details.status !== 'validation_failed' ||
    details.tool !== 'ask' ||
    !Array.isArray(details.diagnostics)
  ) {
    return false;
  }
  return details.diagnostics.every((diagnostic) => {
    if (!diagnostic || typeof diagnostic !== 'object' || Array.isArray(diagnostic)) return false;
    const item = diagnostic as Record<string, unknown>;
    return (
      Object.keys(item).every((key) => key === 'field' || key === 'message') &&
      typeof item.field === 'string' &&
      typeof item.message === 'string'
    );
  });
}

export function renderAskTerminalResult(result: ToolResultLike, theme?: ThemeLike) {
  const parsed = zRequestDetails.safeParse(result.details);
  let status: ExchangeTerminalStatus | undefined;
  if (parsed.success) {
    status =
      'answered' in parsed.data ? 'answered' : 'cancelled' in parsed.data ? 'cancelled' : 'unavailable';
  } else if (isValidationFailureDetails(result.details)) {
    return { render: () => [], invalidate: () => {} };
  }
  if (!status) return renderMarkdownResult(result, theme);
  return withLateralPadding(
    new ExchangeTerminalResultComponent({
      status,
      body: textFromToolContent(result),
      ...(theme ? { theme } : {}),
    }),
  );
}
