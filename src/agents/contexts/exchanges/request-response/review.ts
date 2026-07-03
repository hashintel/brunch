import { blockquote, heading } from 'md-pen';

import type { RequestReviewDetails } from '../../../../exchanges/projections/request-response.js';
import { joinMarkdownBlocks } from '../../../shared/markdown.js';
import { formatResponseTerminal } from '../option-echo.js';
import type { RenderElision } from '../render-honesty.js';

export const REQUEST_REVIEW_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'transport schema tag, not user-facing review content' },
  { path: 'v', reason: 'transport schema version, not user-facing review content' },
  { path: 'exchange_id', reason: 'correlation id, not transcript prose' },
  { path: 'tool_meta.*', reason: 'tool-chain routing metadata, not transcript prose' },
];

export function formatRequestReview(details: RequestReviewDetails): string {
  if ('cancelled' in details) return formatResponseTerminal('User cancelled the review request.', 'Review');
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message, 'Review');

  const label =
    details.answered.decision === 'approve'
      ? 'accepted'
      : details.answered.decision === 'request_changes'
        ? 'changes requested'
        : 'rejected';
  return joinMarkdownBlocks(
    heading(`Review: ${label}`, 2),
    details.answered.comment ? blockquote(details.answered.comment) : undefined,
  );
}
