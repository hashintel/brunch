import type { PresentQuestionProjection } from '../../../projections/exchanges/present-question.js';

export function formatPresentQuestion(projection: PresentQuestionProjection): string {
  const lines = [`# ${projection.heading.trim()}`];
  const body = projection.body?.trim();
  if (body) lines.push('', body);

  if ('options' in projection.details) {
    projection.details.options.forEach((option, index) => {
      lines.push('', `## ${index + 1}. ${option.content.trim()}`);
      const rationale = option.rationale?.trim();
      if (rationale) lines.push('', `**Rationale:** ${rationale}`);
    });
  }

  return lines.join('\n');
}
