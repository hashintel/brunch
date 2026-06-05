import type { StructuredExchangeRequestDetails } from '../../.pi/extensions/structured-exchange/shared/model.js';

export function formatRequestReview(details: StructuredExchangeRequestDetails): string {
  if (details.status === 'cancelled') return '### Review decision\n\n_User cancelled the review request._';
  if (details.status === 'unavailable') {
    return `### Review decision\n\n_${details.message ?? 'Review UI unavailable.'}_`;
  }

  const label =
    details.review === 'approve'
      ? 'Approved'
      : details.review === 'request_changes'
        ? 'Changes requested'
        : 'Rejected';
  const lines = ['### Review decision', '', label];
  if (details.comment) lines.push('', 'Comment:', '', `> ${details.comment}`);
  return lines.join('\n');
}
