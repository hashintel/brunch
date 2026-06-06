import type { RequestChoicesDetails } from '../../projections/structured-exchange/request-choices.js';

function markdownEscape(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

export function formatRequestChoices(details: RequestChoicesDetails): string {
  if ('cancelled' in details) return '### Response\n\n_User cancelled the request._';
  if ('unavailable' in details) return `### Response\n\n_${details.unavailable.message}_`;

  const lines = ['### Response'];
  if (details.answered.choices.length > 0) {
    lines.push('', ...details.answered.choices.map((choice) => `- ${markdownEscape(choice.label)}`));
  }
  if (details.answered.comment) lines.push('', 'Comment:', '', `> ${details.answered.comment}`);
  return lines.join('\n');
}
