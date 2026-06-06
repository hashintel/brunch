/**
 * Canonical projection for `present_question` content.
 *
 * Input:
 * - domain prompt state for a Brunch structured question
 *
 * Output:
 * - normalized heading/body projection plus canonical Zod-authored details
 *
 * Used by:
 * - structured-exchange/format/present-question.ts
 * - session/structured-exchange-loop.ts
 * - .pi/extensions/exchanges/present-question.ts
 */

import type { PresentQuestionDetails } from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  zPresentQuestionDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export interface PresentQuestionProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentQuestionDetails;
}

export interface ProjectPresentQuestionInput {
  readonly exchangeId: string;
  readonly heading: string;
  readonly body?: string | undefined;
}

export function projectPresentQuestion(input: ProjectPresentQuestionInput): PresentQuestionProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const details = zPresentQuestionDetails.parse({
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: {
      curr: 'present_question',
      next: 'request_answer',
    },
    display: {
      heading,
      ...(body ? { body } : {}),
    },
  });
  return {
    heading,
    ...(body ? { body } : {}),
    details,
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
