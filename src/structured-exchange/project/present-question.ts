/**
 * Canonical projection for `present_question` content.
 *
 * Input:
 * - StructuredExchangePresentDetails or equivalent domain prompt state
 *
 * Output:
 * - normalized heading/body projection for durable prompt-side content
 *
 * Used by:
 * - structured-exchange/format/present-question.ts
 * - session/structured-exchange-loop.ts
 * - .pi/extensions/structured-exchange/present-question.ts
 */

import {
  STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
  type StructuredExchangePresentDetails,
} from '../../.pi/extensions/structured-exchange/shared/model.js';

export interface PresentQuestionProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: StructuredExchangePresentDetails;
}

export interface ProjectPresentQuestionInput {
  readonly toolCallId: string;
  readonly exchangeId: string;
  readonly heading: string;
  readonly body?: string | undefined;
  readonly expectedRequestTool?: 'request_answer' | undefined;
}

export function projectPresentQuestion(input: ProjectPresentQuestionInput): PresentQuestionProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  return {
    heading,
    ...(body ? { body } : {}),
    details: {
      schema: STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
      schemaVersion: 1,
      exchangeId: input.exchangeId,
      presentTool: 'present_question',
      kind: 'question',
      status: 'presented',
      expectedRequest: {
        tool: input.expectedRequestTool ?? 'request_answer',
        required: true,
      },
      createdAtToolCallId: input.toolCallId,
    },
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
