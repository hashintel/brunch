import { projectRequestChoice } from '../../../../structured-exchange/project/request-choice.js';
import { projectRequestChoices } from '../../../../structured-exchange/project/request-choices.js';
import type { SelectedChoice } from '../schemas/index.js';

export type StructuredExchangeMode = 'single-select' | 'multi-select';

export interface StructuredExchangeOption {
  label: string;
  value: string;
  description?: string;
}

export type StructuredExchangeAnswer =
  | { type: 'option'; label: string; value: string; index: number }
  | { type: 'other'; label: string; value: string };

export interface StructuredExchangeEditorPrefillParams {
  question: string;
  context?: string;
  exchangeId?: string;
  mode: StructuredExchangeMode;
  options: StructuredExchangeOption[];
}

interface StructuredExchangeEditorResponse {
  status: 'answered' | 'cancelled';
  answers: StructuredExchangeAnswer[];
  note: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function answerSortRank(answer: StructuredExchangeAnswer): number {
  return answer.type === 'option' ? answer.index : Number.MAX_SAFE_INTEGER - 1;
}

function sortAnswers(answers: StructuredExchangeAnswer[]): StructuredExchangeAnswer[] {
  return [...answers].sort((a, b) => answerSortRank(a) - answerSortRank(b));
}

function parseEditorAnswer(value: unknown): StructuredExchangeAnswer | null {
  if (!isRecord(value)) return null;

  if (value.type === 'option') {
    if (
      typeof value.label !== 'string' ||
      typeof value.value !== 'string' ||
      typeof value.index !== 'number' ||
      !Number.isInteger(value.index) ||
      value.index < 1
    ) {
      return null;
    }
    return { type: 'option', label: value.label, value: value.value, index: value.index };
  }

  if (value.type === 'other') {
    if (typeof value.label !== 'string' || typeof value.value !== 'string') return null;
    return { type: 'other', label: value.label, value: value.value };
  }

  return null;
}

function selectedChoice(answer: StructuredExchangeAnswer): SelectedChoice {
  if (answer.type === 'other') return { id: 'other', label: answer.label, kind: 'other' };
  return { id: answer.value, label: answer.label, kind: 'listed' };
}

function responseText(
  status: 'answered' | 'cancelled' | 'unavailable',
  answers: StructuredExchangeAnswer[],
  note: string,
  message?: string,
): string {
  const selected = answers
    .map((answer) =>
      answer.type === 'option' ? `${answer.index}. ${answer.label}` : `Other: ${answer.label}`,
    )
    .join('\n');
  return status === 'answered'
    ? [`User selected:${selected ? `\n${selected}` : ''}`, note ? `Note: ${note}` : undefined]
        .filter(Boolean)
        .join('\n')
    : (message ?? `User ${status} the question`);
}

export function buildStructuredExchangeEditorPrefill(params: StructuredExchangeEditorPrefillParams): string {
  const payload: Record<string, unknown> = {
    schema: 'brunch.structured_exchange.editor',
    schemaVersion: 1,
    question: params.question,
    mode: params.mode,
    options: params.options.map((option, index) => ({
      index: index + 1,
      label: option.label,
      value: option.value,
      ...(option.description ? { description: option.description } : {}),
    })),
    instructions: [
      'Edit only response.',
      'For a selected listed option, add an answer like {"type":"option","label":"Alpha","value":"alpha","index":1}.',
      'For Other, add an answer like {"type":"other","label":"Custom answer","value":"Custom answer"}.',
      'Set response.note to a string. Use "" when there is no additional note.',
    ],
    response: { status: 'cancelled', answers: [], note: '' },
  };
  if (params.context !== undefined) payload.context = params.context;
  return JSON.stringify(payload, null, 2);
}

export function parseStructuredExchangeEditorResponse(
  value: string,
): StructuredExchangeEditorResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const response = parsed.response;
  if (!isRecord(response)) return null;
  if (response.status === 'cancelled') return { status: 'cancelled', answers: [], note: '' };
  if (response.status !== 'answered') return null;
  if (!Array.isArray(response.answers) || typeof response.note !== 'string') return null;

  const answers = response.answers.map(parseEditorAnswer);
  if (answers.some((answer) => answer === null)) return null;
  return {
    status: 'answered',
    answers: sortAnswers(answers as StructuredExchangeAnswer[]),
    note: response.note,
  };
}

export function structuredExchangeResultFromEditor(
  params: StructuredExchangeEditorPrefillParams,
  edited: string | undefined,
) {
  const response = parseStructuredExchangeEditorResponse(edited ?? '');
  const exchangeId = params.exchangeId ?? `rpc-editor:${params.question}`;
  if (edited === undefined || response?.status === 'cancelled') {
    const details =
      params.mode === 'multi-select'
        ? projectRequestChoices({ exchangeId, status: 'cancelled' })
        : projectRequestChoice({ exchangeId, respondsToPresentTool: 'present_options', status: 'cancelled' });
    return {
      content: [
        { type: 'text' as const, text: responseText('cancelled', [], '', 'User cancelled the question') },
      ],
      details,
    };
  }

  if (!response || response.answers.length === 0) {
    const details =
      params.mode === 'multi-select'
        ? projectRequestChoices({
            exchangeId,
            status: 'unavailable',
            message: 'Editor response did not include a valid answer',
          })
        : projectRequestChoice({
            exchangeId,
            respondsToPresentTool: 'present_options',
            status: 'unavailable',
            message: 'Editor response did not include a valid answer',
          });
    return {
      content: [
        {
          type: 'text' as const,
          text: responseText('unavailable', [], '', 'Editor response did not include a valid answer'),
        },
      ],
      details,
    };
  }

  if (params.mode === 'multi-select') {
    const details = projectRequestChoices({
      exchangeId,
      status: 'answered',
      choices: response.answers.map(selectedChoice),
      comment: response.note.trim() || undefined,
    });
    return {
      content: [{ type: 'text' as const, text: responseText('answered', response.answers, response.note) }],
      details,
    };
  }

  const details = projectRequestChoice({
    exchangeId,
    respondsToPresentTool: 'present_options',
    status: 'answered',
    choice: selectedChoice(response.answers[0]!),
    comment: response.note.trim() || undefined,
  });
  return {
    content: [{ type: 'text' as const, text: responseText('answered', response.answers, response.note) }],
    details,
  };
}
