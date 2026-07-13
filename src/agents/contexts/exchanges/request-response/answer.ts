import { heading } from 'md-pen';

import type { RequestAnswerDetails } from '../../../../exchanges/projections/request-response.js';
import { joinMarkdownBlocks } from '../../../shared/markdown.js';
import { formatCancelledTerminal, formatResponseTerminal } from '../option-echo.js';
import type { RenderElision } from '../render-honesty.js';

export const REQUEST_ANSWER_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'transport schema tag, not user-facing answer content' },
  { path: 'v', reason: 'transport schema version, not user-facing answer content' },
  { path: 'exchange_id', reason: 'correlation id, not transcript prose' },
  { path: 'tool_meta.*', reason: 'tool-chain routing metadata, not transcript prose' },
];

export function formatRequestAnswer(details: RequestAnswerDetails): string {
  if ('cancelled' in details) {
    return formatCancelledTerminal(
      'The request was posed, but the user declined to answer. Read this as wanting to change direction or reply in free text.',
    );
  }
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message);
  // The free-text answer is the user's own voice, not commentary on one — plain
  // text, never a blockquote (blockquote carries the "why" voice in this grammar).
  return joinMarkdownBlocks(heading('Answer', 2), details.answered.text);
}
