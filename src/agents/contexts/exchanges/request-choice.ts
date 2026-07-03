import { blockquote, heading } from 'md-pen';

import type { RequestChoiceDetails } from '../../../exchanges/projections/request-choice.js';
import { joinMarkdownBlocks } from '../../shared/markdown.js';
import { formatOptionEcho, formatResponseTerminal } from './option-echo.js';

export function formatRequestChoice(details: RequestChoiceDetails): string {
  if ('cancelled' in details) return formatResponseTerminal('User cancelled the request.');
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message);
  return joinMarkdownBlocks(
    heading('Answer', 2),
    formatOptionEcho({
      selectedIds: new Set([details.answered.choice.id]),
      options: details.answered.options,
      writeIns:
        details.answered.choice.kind === 'listed'
          ? []
          : [{ kind: details.answered.choice.kind, label: details.answered.choice.label }],
    }),
    details.answered.comment ? blockquote(details.answered.comment) : undefined,
  );
}
