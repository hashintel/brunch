import type { AskDetails } from '../../../exchanges/schemas/index.js';
import type { RenderElision } from './render-honesty.js';

function optionLines(details: AskDetails): string[] {
  const options = details.question.options ?? [];
  const answered = 'answered' in details ? details.answered : undefined;
  if (!answered || (!('choice' in answered) && !('choices' in answered))) return [];

  const selected = 'choice' in answered ? [answered.choice] : answered.choices;
  const selectedIds = new Set(selected.map((choice) => choice.id));
  const listedRows = options.map((option) => {
    const selected = selectedIds.has(option.id);
    const marker = selected ? '[x]' : '[ ]';
    const label = selected ? `__${option.label}__` : `~~${option.label}~~`;
    const description = option.description ? ` — ${option.description}` : '';
    return `- ${marker} ${label}${description}`;
  });
  const writeInRows = selected
    .filter((choice) => !options.some((option) => option.id === choice.id))
    .map((choice) => `- [x] __${choice.label}__`);
  return [...listedRows, ...writeInRows];
}

export function formatAsk(details: AskDetails): string {
  const lines = [details.question.body];
  const options = optionLines(details);
  if (options.length > 0) lines.push('', ...options);

  if ('answered' in details) {
    const { answered } = details;
    if ('text' in answered) {
      lines.push('', `**Answer:** ${answered.text}`);
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    } else if ('choice' in answered) {
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    } else {
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    }
  } else if ('cancelled' in details) {
    lines.push('');
    lines.push(`_${details.cancelled.message ?? 'User cancelled.'}_`);
  } else {
    lines.push('');
    lines.push(`_${details.unavailable.message}_`);
  }

  return lines.join('\n');
}

export const ASK_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'transport schema tag, not user-facing answer content' },
  { path: 'v', reason: 'transport schema version, not user-facing answer content' },
  { path: 'exchange_id', reason: 'correlation id, not transcript prose' },
  { path: 'tool_meta.*', reason: 'tool-chain routing metadata, not transcript prose' },
  { path: 'question.options.*.id', reason: 'stable option ids are represented by ordered option labels' },
  { path: 'question.multiple', reason: 'selection mode is conveyed by the checked-option rendering' },
  { path: 'answered.choice.id', reason: 'stable option id is represented by the selected option label' },
  {
    path: 'answered.choice.kind',
    reason: 'the selected label carries the user-facing answer; write-ins keep their label',
  },
  { path: 'answered.choices.*.id', reason: 'stable option ids are represented by the answer list labels' },
  {
    path: 'answered.choices.*.kind',
    reason: 'the selected labels carry the user-facing answer; write-ins keep their label',
  },
  { path: 'answered.options.*.id', reason: 'stable option ids are represented by ordered option labels' },
];
