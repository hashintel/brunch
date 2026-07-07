import type { AskDetails } from '../../../exchanges/schemas/index.js';

function optionLines(details: AskDetails): string[] {
  const options = details.question.options ?? [];
  if (options.length === 0) return [];
  const answered = 'answered' in details ? details.answered : undefined;
  const selectedIds = new Set<string>();
  if (answered && 'choice' in answered) selectedIds.add(answered.choice.id);
  if (answered && 'choices' in answered) for (const choice of answered.choices) selectedIds.add(choice.id);
  return [
    '## Options',
    '',
    ...options.map((option, index) => {
      const marker = selectedIds.has(option.id) ? '[x]' : '[ ]';
      const description = option.description ? ` — ${option.description}` : '';
      return `- ${marker} ${index + 1}. __${option.label}__${description}`;
    }),
  ];
}

export function formatAsk(details: AskDetails): string {
  const lines = ['## Question', '', details.question.body];
  const options = optionLines(details);
  if (options.length > 0) lines.push('', ...options);

  lines.push('', '## Answer', '');
  if ('answered' in details) {
    const { answered } = details;
    if ('text' in answered) lines.push(answered.text);
    else if ('choice' in answered) {
      lines.push(answered.choice.label);
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    } else {
      lines.push(...answered.choices.map((choice) => `- ${choice.label}`));
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    }
  } else if ('cancelled' in details) {
    lines.push(`_${details.cancelled.message ?? 'User cancelled.'}_`);
  } else {
    lines.push(`_${details.unavailable.message}_`);
  }

  return lines.join('\n');
}

export const ASK_CONTENT_ELISIONS = [] as const;
