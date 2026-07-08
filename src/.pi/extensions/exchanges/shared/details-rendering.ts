import type { Component } from '@earendil-works/pi-tui';
import type * as z from 'zod';

import { renderMarkdownResult } from './markdown.js';

interface ToolResultWithDetails {
  readonly content?: { type?: string; text?: string }[];
  readonly details?: unknown;
}

export function renderDetailsOrMarkdownResult<T>(
  result: ToolResultWithDetails,
  schema: z.ZodType<T>,
  renderDetails: (details: T) => Component,
  renderFallback: () => Component = () => renderMarkdownResult(result),
): Component {
  const parsed = schema.safeParse(result.details);
  if (!parsed.success) return renderFallback();
  return renderDetails(parsed.data);
}
