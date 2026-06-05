import type { PresentOptionsProjection } from '../project/present-options.js';

function markdownEscape(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

export function formatPresentOptions(projection: PresentOptionsProjection): string {
  const lines = [`## ${projection.heading.trim()}`];
  const body = projection.body?.trim();
  if (body) lines.push('', body);
  projection.details.options.forEach((option, index) => {
    lines.push('', `### ${index + 1}. ${option.content.trim()}`);
    const rationale = option.rationale?.trim();
    if (rationale) lines.push('', `**Rationale:** ${rationale}`);
    lines.push('', `<!-- option-id: ${markdownEscape(option.id)} -->`);
  });
  return lines.join('\n');
}
