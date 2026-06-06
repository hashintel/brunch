import type { RequestAnswerDetails } from '../../.pi/extensions/exchanges/schemas/index.js';

export function formatRequestAnswer(details: RequestAnswerDetails): string {
  if ('cancelled' in details) return '### Response\n\n_User cancelled the request._';
  if ('unavailable' in details) return `### Response\n\n_${details.unavailable.message}_`;
  return ['### Response', '', details.answered.text].join('\n');
}
