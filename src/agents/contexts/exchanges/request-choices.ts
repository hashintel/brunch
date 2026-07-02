import type { RequestChoicesDetails } from '../../../projections/exchanges/request-choices.js';
import { joinMarkdownBlocks, markdownBlockquote, markdownHeading } from '../../shared/markdown.js';
import { formatOptionEcho, formatResponseTerminal } from './option-echo.js';

export function formatRequestChoices(details: RequestChoicesDetails): string {
  if ('cancelled' in details) return formatResponseTerminal('User cancelled the request.');
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message);

  return joinMarkdownBlocks(
    markdownHeading(2, 'Answer'),
    formatOptionEcho({
      selectedIds: new Set(details.answered.choices.map((choice) => choice.id)),
      options: details.answered.options,
      writeIns: details.answered.choices
        .filter((choice) => choice.kind !== 'listed')
        .map((choice) => ({
          kind: choice.kind === 'none' ? ('none' as const) : ('other' as const),
          label: choice.label,
        })),
    }),
    details.answered.comment ? markdownBlockquote(details.answered.comment) : undefined,
  );
}
