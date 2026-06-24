import type { RequestReviewDetails } from '../../projections/exchanges/request-review.js';

export function formatRequestReview(details: RequestReviewDetails): string {
  if ('cancelled' in details) return '# Review decision\n\n_User cancelled the review request._';
  if ('unavailable' in details) return `# Review decision\n\n_${details.unavailable.message}_`;

  const label =
    details.answered.decision === 'approve'
      ? 'Approved'
      : details.answered.decision === 'request_changes'
        ? 'Changes requested'
        : 'Rejected';
  const lines = ['# Review decision', '', label];
  if (details.answered.comment) lines.push('', 'Comment:', '', `> ${details.answered.comment}`);
  return lines.join('\n');
}
