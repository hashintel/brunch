import type { PresentQuestionProjection } from '../../../projections/exchanges/present-question.js';

export function formatPresentQuestion(projection: PresentQuestionProjection): string {
  const lines = [`# ${projection.heading.trim()}`];
  const body = projection.body?.trim();
  if (body) lines.push('', body);

  if ('options' in projection.details) {
    lines.push('', projection.details.response_kind === 'choices' ? 'Choose one or more:' : 'Choose one:');
    projection.details.options.forEach((option, index) => {
      lines.push(`${index + 1}. ${option.content.trim()}`);
      const rationale = option.rationale?.trim();
      if (rationale) lines.push(`   why: ${rationale}`);
    });
    if (projection.details.allow_other) lines.push('Other is allowed.');
    if (projection.details.allow_none) lines.push('None is allowed.');
    const commentPrompt = projection.details.comment_prompt?.trim();
    if (commentPrompt) lines.push(`Optional comment: ${commentPrompt}`);
  }

  return lines.join('\n');
}
