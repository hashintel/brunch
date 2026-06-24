import type { RequestChoiceDetails } from '../../projections/exchanges/request-choice.js';

export function formatRequestChoice(details: RequestChoiceDetails): string {
  if ('cancelled' in details) return '# Response\n\n_User cancelled the request._';
  if ('unavailable' in details) return `# Response\n\n_${details.unavailable.message}_`;
  const lines = ['# Response', '', `Selected: **${details.answered.choice.label}**`];
  if (details.answered.comment) lines.push('', 'Comment:', '', `> ${details.answered.comment}`);
  return lines.join('\n');
}
