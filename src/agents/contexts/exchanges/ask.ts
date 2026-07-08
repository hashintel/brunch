import type { AskDetails } from '../../../exchanges/schemas/index.js';
import type { RenderElision } from './render-honesty.js';

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
    if ('text' in answered) {
      lines.push(answered.text);
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    } else if ('choice' in answered) {
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
