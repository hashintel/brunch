import type { RequestChoiceDetails } from '../../../projections/exchanges/request-choice.js';
import { joinMarkdownBlocks, markdownBlockquote, markdownHeading } from '../../shared/markdown.js';
import { formatOptionEcho, formatResponseTerminal } from './option-echo.js';

export function formatRequestChoice(details: RequestChoiceDetails): string {
  if ('cancelled' in details) return formatResponseTerminal('User cancelled the request.');
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message);
  return joinMarkdownBlocks(
    markdownHeading(2, 'Answer'),
    formatOptionEcho({
      selectedIds: new Set([details.answered.choice.id]),
      options: details.answered.options,
      writeIns:
        details.answered.choice.kind === 'listed'
          ? []
          : [{ kind: details.answered.choice.kind, label: details.answered.choice.label }],
    }),
    details.answered.comment ? markdownBlockquote(details.answered.comment) : undefined,
  );
}
