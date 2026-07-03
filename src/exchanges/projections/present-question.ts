import type { PresentQuestionDetails, PresentQuestionParams } from '../schemas/index.js';
import { STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA } from '../schemas/index.js';

export interface PresentQuestionProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentQuestionDetails;
}

export function projectPresentQuestion(input: PresentQuestionParams): PresentQuestionProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const display = {
    heading,
    ...(body ? { body } : {}),
  };
  if (!input.options) {
    const details: PresentQuestionDetails = {
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: 1,
      exchange_id: input.exchangeId,
      tool_meta: { curr: 'present_question', next: 'request_response' },
      response_kind: 'answer',
      display,
    };
    return { heading, ...(body ? { body } : {}), details };
  }

  const details: PresentQuestionDetails = {
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'present_question', next: 'request_response' },
    response_kind: input.multiple ? 'choices' : 'choice',
    display,
    options: input.options.map((option) => ({
      id: option.id,
      content: option.content,
      ...(option.rationale !== undefined ? { rationale: option.rationale } : {}),
    })),
    ...(input.allowOther !== undefined ? { allow_other: input.allowOther } : {}),
    ...(input.allowNone !== undefined ? { allow_none: input.allowNone } : {}),
    ...(input.commentPrompt !== undefined ? { comment_prompt: input.commentPrompt } : {}),
  };
  return { heading, ...(body ? { body } : {}), details };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
