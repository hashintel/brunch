import {
  STRUCTURED_EXCHANGE_DETAILS_VERSION,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  type AskDetails,
  type AskQuestionEcho,
  type SelectedChoice,
} from '../schemas/index.js';

interface BaseAskProjectionInput {
  readonly exchangeId: string;
  readonly question: AskQuestionEcho;
}

type AskProjectionInput =
  | (BaseAskProjectionInput & { readonly status: 'answered'; readonly answer: string })
  | (BaseAskProjectionInput & {
      readonly status: 'answered';
      readonly choice: SelectedChoice;
      readonly options: NonNullable<AskQuestionEcho['options']>;
      readonly comment?: string;
    })
  | (BaseAskProjectionInput & {
      readonly status: 'answered';
      readonly choices: readonly SelectedChoice[];
      readonly options: NonNullable<AskQuestionEcho['options']>;
      readonly comment?: string;
    })
  | (BaseAskProjectionInput & { readonly status: 'cancelled'; readonly message?: string })
  | (BaseAskProjectionInput & { readonly status: 'unavailable'; readonly message: string });

export function askQuestionEcho(params: {
  readonly body: string;
  readonly options?: AskQuestionEcho['options'] | undefined;
  readonly multiple?: boolean | undefined;
}): AskQuestionEcho {
  return {
    body: params.body,
    ...(params.options ? { options: params.options } : {}),
    ...(params.multiple ? { multiple: true } : {}),
  };
}

export function projectAsk(input: AskProjectionInput): AskDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
    exchange_id: input.exchangeId,
    question: input.question,
  } as const;

  if (input.status === 'cancelled') {
    return {
      ...base,
      tool_meta: { curr: 'ask' },
      cancelled: input.message ? { message: input.message } : {},
    };
  }
  if (input.status === 'unavailable') {
    return { ...base, tool_meta: { curr: 'ask' }, unavailable: { message: input.message } };
  }
  if ('answer' in input) {
    return {
      ...base,
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      answered: { text: input.answer },
    };
  }
  if ('choices' in input) {
    return {
      ...base,
      tool_meta: { curr: 'ask', next: 'capture_choices' },
      question: { ...input.question, options: input.options, multiple: true },
      answered: {
        choices: [...input.choices],
        options: input.options.map(({ id, label, description }) => ({
          id,
          content: label,
          ...(description ? { rationale: description } : {}),
        })),
        ...(input.comment ? { comment: input.comment } : {}),
      },
    };
  }
  return {
    ...base,
    tool_meta: { curr: 'ask', next: 'capture_choice' },
    question: { ...input.question, options: input.options },
    answered: {
      choice: input.choice,
      options: input.options.map(({ id, label, description }) => ({
        id,
        content: label,
        ...(description ? { rationale: description } : {}),
      })),
      ...(input.comment ? { comment: input.comment } : {}),
    },
  };
}
