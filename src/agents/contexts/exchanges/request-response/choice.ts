import { blockquote, heading } from 'md-pen';

import type { RequestChoiceDetails } from '../../../../exchanges/projections/request-response.js';
import { joinMarkdownBlocks } from '../../../shared/markdown.js';
import { formatCancelledTerminal, formatOptionEcho, formatResponseTerminal } from '../option-echo.js';
import type { RenderElision } from '../render-honesty.js';

export const REQUEST_CHOICE_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'transport schema tag, not user-facing answer content' },
  { path: 'v', reason: 'transport schema version, not user-facing answer content' },
  { path: 'exchange_id', reason: 'correlation id, not transcript prose' },
  { path: 'tool_meta.*', reason: 'tool-chain routing metadata, not transcript prose' },
  { path: 'answered.choice.id', reason: 'stable option id is represented by the selected option label' },
  { path: 'answered.choice.kind', reason: 'choice kind is represented by listed/Other/None answer syntax' },
  { path: 'answered.options.*.id', reason: 'stable option ids are represented by ordered option echoes' },
  { path: 'answered.options.*.rationale', reason: 'request answer echo intentionally repeats content only' },
];

export function formatRequestChoice(details: RequestChoiceDetails): string {
  if ('cancelled' in details) {
    return formatCancelledTerminal(
      'The request was posed, but the user declined to answer. Read this as wanting to change direction or reply in free text.',
    );
  }
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
