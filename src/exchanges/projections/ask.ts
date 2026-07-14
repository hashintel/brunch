import {
  STRUCTURED_EXCHANGE_DETAILS_VERSION,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  zQuestionnaireAnswersFor,
  type AskDetails,
  type AskDigestConfirmationDetails,
  type AskQuestionnaireDetails,
  type AskQuestionEcho,
  type QuestionnaireAnswer,
  type QuestionnaireQuestion,
  type SelectedChoice,
} from '../schemas/index.js';

interface BaseAskProjectionInput {
  readonly exchangeId: string;
  readonly question: AskQuestionEcho;
}

type AskProjectionInput =
  | (BaseAskProjectionInput & {
      readonly status: 'answered';
      readonly answer: string;
      readonly comment?: string;
    })
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

const OTHER_ELABORATION_PROMPT = 'Describe your answer';

export function projectDigestQuestionnaire(input: {
  readonly exchangeId: string;
  readonly acceptsDigest: string;
  readonly acceptedAbstract: string;
  readonly questions: readonly QuestionnaireQuestion[];
  readonly answers: readonly QuestionnaireAnswer[];
}): AskQuestionnaireDetails {
  const answers = zQuestionnaireAnswersFor(input.questions).parse(input.answers);
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]));
  return {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'ask', next: 'capture_answer' },
    question: { body: 'Digest questionnaire' },
    accepts_digest: input.acceptsDigest,
    questionnaire: input.questions.map((question) => ({ question, answer: byId.get(question.id)! })),
    answered: { submitted: true, accepted_abstract: input.acceptedAbstract.trim() },
  };
}

export function projectDigestConfirmation(input: {
  readonly exchangeId: string;
  readonly acceptsDigest: string;
  readonly acceptedAbstract: string;
  readonly question: AskQuestionEcho & { readonly options: NonNullable<AskQuestionEcho['options']> };
  readonly choice: SelectedChoice;
}): AskDigestConfirmationDetails {
  return {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'ask', next: 'capture_choice' },
    question: input.question,
    accepts_digest: input.acceptsDigest,
    answered: {
      choice: input.choice,
      options: input.question.options.map(({ id, label, description }) => ({
        id,
        content: label,
        ...(description ? { rationale: description } : {}),
      })),
      accepted_abstract: input.acceptedAbstract.trim(),
    },
  };
}

export function askQuestionEcho(params: {
  readonly body: string;
  readonly options?: AskQuestionEcho['options'] | undefined;
  readonly multiple?: boolean | undefined;
  readonly commentPrompt?: string | undefined;
  readonly otherPrompt?: string | undefined;
  readonly allowOther?: boolean | undefined;
}): AskQuestionEcho {
  return {
    body: params.body,
    ...(params.options && params.options.length > 0 ? { options: params.options } : {}),
    ...(params.multiple ? { multiple: true } : {}),
    ...(params.commentPrompt ? { commentPrompt: params.commentPrompt } : {}),
    ...(params.otherPrompt
      ? { otherPrompt: params.otherPrompt }
      : params.allowOther
        ? { otherPrompt: OTHER_ELABORATION_PROMPT }
        : {}),
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
      answered: { text: input.answer, ...(input.comment ? { comment: input.comment } : {}) },
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
