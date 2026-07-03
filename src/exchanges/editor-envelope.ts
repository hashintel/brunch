import {
  STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_VERSION,
  type RequestChoicesEditorChoice,
  type RequestChoicesEditorEnvelopeInput,
  type RequestChoicesEditorResponse,
  zRequestChoicesEditorReply,
} from './schemas/index.js';

export type { RequestChoicesEditorChoice, RequestChoicesEditorResponse };

export interface StructuredExchangeChoice {
  readonly id: string;
  readonly label: string;
}

export function buildRequestChoicesEditorPrefill(params: {
  prompt: string;
  choices: readonly StructuredExchangeChoice[];
  allowOther?: boolean;
  allowNone?: boolean;
  commentPrompt?: string;
}): string {
  const choices = [
    ...params.choices,
    ...(params.allowOther ? [{ id: 'other', label: 'Other' }] : []),
    ...(params.allowNone ? [{ id: 'none', label: 'None' }] : []),
  ];
  const envelope = {
    schema: STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_SCHEMA,
    schemaVersion: STRUCTURED_EXCHANGE_REQUEST_CHOICES_EDITOR_VERSION,
    prompt: params.prompt,
    mode: 'multi-choice',
    choices,
    instructions: [
      'Edit only response.',
      'Set response.status to answered or cancelled.',
      'For each selected choice, include its id in response.choices.',
      'Set response.comment to a string. Other or None requires a nonblank comment.',
    ],
    commentPrompt: params.commentPrompt ?? 'Optional comment',
    response: { status: 'cancelled', choices: [], comment: '' },
  } satisfies RequestChoicesEditorEnvelopeInput;
  return JSON.stringify(envelope, null, 2);
}

export function parseRequestChoicesEditorResponse(value: string): RequestChoicesEditorResponse | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  const reply = zRequestChoicesEditorReply.safeParse(parsed);
  return reply.success ? reply.data.response : null;
}
