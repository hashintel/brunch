import type { RequestReviewDetails } from '../../../projections/exchanges/request-review.js';
import { joinMarkdownBlocks, markdownBlockquote, markdownHeading } from '../../shared/markdown.js';
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
    markdownHeading(2, `Review: ${label}`),
    details.answered.comment ? markdownBlockquote(details.answered.comment) : undefined,
  );
}
