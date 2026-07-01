/**
 * Text rendering for the session-local elicitation scratchpad
 * (`session/elicitation-scratchpad.ts`). Pure formatting only — no reads,
 * no graph access. The scratchpad is non-authoritative (I56-L): rendered
 * text never claims graph-truth status for an item.
 */

import type { ElicitationScratchpadItem } from '../../../session/elicitation-scratchpad.js';

export function formatElicitationScratchpad(items: readonly ElicitationScratchpadItem[]): string {
  if (items.length === 0) {
    return 'ELICITATION SCRATCHPAD (empty)';
  }

  const open = items.filter((item) => item.disposition === 'open');
  const resolved = items.filter((item) => item.disposition === 'resolved');

  const lines = ['ELICITATION SCRATCHPAD'];
  for (const item of open) {
    lines.push(`- [open] ${item.obligation}${item.rationale ? ` — ${item.rationale}` : ''}`);
  }
  for (const item of resolved) {
    lines.push(`- [resolved] ${item.obligation}${item.rationale ? ` — ${item.rationale}` : ''}`);
  }
  return lines.join('\n');
}

export type ElicitationScratchpadOperation = 'add' | 'resolve' | 'update';

export function formatElicitationScratchpadUpdateResult(
  items: readonly ElicitationScratchpadItem[],
  operation: ElicitationScratchpadOperation,
): string {
  return `Scratchpad ${operation} applied.\n${formatElicitationScratchpad(items)}`;
}
