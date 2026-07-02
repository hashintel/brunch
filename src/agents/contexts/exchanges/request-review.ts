import { blockquote, heading } from 'md-pen';

import type { RequestReviewDetails } from '../../../projections/exchanges/request-review.js';
import { joinMarkdownBlocks } from '../../shared/markdown.js';
import { formatResponseTerminal } from './option-echo.js';

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
