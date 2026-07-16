import type { AskDetails } from '../../../exchanges/schemas/index.js';
import { CANCELLED_TERMINAL } from './option-echo.js';
import type { RenderElision } from './render-honesty.js';

type OrdinaryAskDetails = Exclude<AskDetails, { readonly questionnaire: unknown }>;

function optionLines(details: OrdinaryAskDetails): string[] {
  const options = details.question.options ?? [];
  const answered = 'answered' in details ? details.answered : undefined;
  if (!answered || (!('choice' in answered) && !('choices' in answered))) return [];

  const selected = 'choice' in answered ? [answered.choice] : answered.choices;
  const selectedById = new Map(selected.map((choice) => [choice.id, choice]));
  const listedRows = options.map((option) => {
    const selected = selectedById.get(option.id);
    const marker = selected ? '[x]' : '[ ]';
    const selectedLabel = selected?.kind === 'other' ? `${option.label}: ${selected.label}` : option.label;
    const label = selected ? `__${selectedLabel}__` : `~~${option.label}~~`;
    const description = option.description ? ` — ${option.description}` : '';
    return `- ${marker} ${label}${description}`;
  });
  const writeInRows = selected
    .filter((choice) => !options.some((option) => option.id === choice.id))
    .map((choice) => `- [x] __${choice.label}__`);
  return [...listedRows, ...writeInRows];
}

function framingLines(details: OrdinaryAskDetails): string[] {
  const lines: string[] = [];
  if (details.question.commentPrompt) lines.push(`**Comment prompt:** ${details.question.commentPrompt}`);
  if (details.question.otherPrompt) lines.push(`**Other prompt:** ${details.question.otherPrompt}`);
  return lines;
}

export function formatAsk(details: AskDetails): string {
  if ('questionnaire' in details) {
    const lines = [`Accepted digest: ${details.answered.accepted_abstract}`];
    for (const { question, answer } of details.questionnaire) {
      const labels =
        'options' in question
          ? new Map(question.options.map((option) => [option.id, option.label]))
          : undefined;
      const rendered =
        answer.kind === 'free-text'
          ? answer.text
          : answer.kind === 'single-select'
            ? (labels?.get(answer.optionId) ?? answer.optionId)
            : answer.optionIds.map((id) => labels?.get(id) ?? id).join(', ');
      lines.push('', `**${question.prompt}**`, rendered);
    }
    return lines.join('\n');
  }
  const ordinary = details as OrdinaryAskDetails;
  const lines = [ordinary.question.body];
  const framing = framingLines(ordinary);
  if (framing.length > 0) lines.push('', ...framing);
  const options = optionLines(ordinary);
  if (options.length > 0) lines.push('', ...options);

  if ('answered' in ordinary) {
    const { answered } = ordinary;
    if ('text' in answered) {
      lines.push('', `**Answer:** ${answered.text}`);
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    } else if ('choice' in answered) {
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    } else {
      if (answered.comment) lines.push('', `_${answered.comment}_`);
    }
  } else if ('cancelled' in ordinary) {
    lines.push('');
    lines.push(CANCELLED_TERMINAL);
  } else {
    lines.push('');
    lines.push(`_${ordinary.unavailable.message}_`);
  }

  return lines.join('\n');
}

export const ASK_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'transport schema tag, not user-facing answer content' },
  { path: 'v', reason: 'transport schema version, not user-facing answer content' },
  { path: 'exchange_id', reason: 'correlation id, not transcript prose' },
  { path: 'tool_meta.*', reason: 'tool-chain routing metadata, not transcript prose' },
  {
    path: 'cancelled.message',
    reason: 'implementation detail replaced by canonical next-turn cancellation guidance',
  },
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
