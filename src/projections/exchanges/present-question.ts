import type {
  PresentQuestionDetails,
  PresentQuestionParams,
} from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  zPresentQuestionDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export interface PresentQuestionProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentQuestionDetails;
}

export function projectPresentQuestion(input: PresentQuestionParams): PresentQuestionProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const responseKind = input.options ? (input.multiple ? 'choices' : 'choice') : 'answer';
  const details = zPresentQuestionDetails.parse({
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'present_question', next: 'request_response' },
    response_kind: responseKind,
    display: {
      heading,
      ...(body ? { body } : {}),
    },
    ...(input.options
      ? {
          options: input.options.map((option) => ({
            id: option.id,
            content: option.content,
            ...(option.rationale !== undefined ? { rationale: option.rationale } : {}),
          })),
          ...(input.allowOther !== undefined ? { allow_other: input.allowOther } : {}),
          ...(input.allowNone !== undefined ? { allow_none: input.allowNone } : {}),
          ...(input.commentPrompt !== undefined ? { comment_prompt: input.commentPrompt } : {}),
        }
      : {}),
  });
  return { heading, ...(body ? { body } : {}), details };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
