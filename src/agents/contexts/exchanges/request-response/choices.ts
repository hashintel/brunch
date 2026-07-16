import { blockquote, heading } from 'md-pen';

import type { RequestChoicesDetails } from '../../../../exchanges/projections/request-response.js';
import { joinMarkdownBlocks } from '../../../shared/markdown.js';
import { CANCELLED_TERMINAL, formatOptionEcho, formatResponseTerminal } from '../option-echo.js';
import type { RenderElision } from '../render-honesty.js';

export const REQUEST_CHOICES_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'transport schema tag, not user-facing answer content' },
  { path: 'v', reason: 'transport schema version, not user-facing answer content' },
  { path: 'exchange_id', reason: 'correlation id, not transcript prose' },
  { path: 'tool_meta.*', reason: 'tool-chain routing metadata, not transcript prose' },
  { path: 'answered.choices.*.id', reason: 'stable option ids are represented by selected option labels' },
  {
    path: 'answered.choices.*.kind',
    reason: 'choice kind is represented by listed/Other/None answer syntax',
  },
  { path: 'answered.options.*.id', reason: 'stable option ids are represented by ordered option echoes' },
  { path: 'answered.options.*.rationale', reason: 'request answer echo intentionally repeats content only' },
];

export function formatRequestChoices(details: RequestChoicesDetails): string {
  if ('cancelled' in details) {
    return CANCELLED_TERMINAL;
  }
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message);

  return joinMarkdownBlocks(
    heading('Answer', 2),
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
    details.answered.comment ? blockquote(details.answered.comment) : undefined,
  );
}
