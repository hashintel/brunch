import type {
  RequestAnswerDetails,
  RequestOutcomeKey,
} from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  zRequestAnswerDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';

export type { RequestAnswerDetails };
export function projectRequestAnswer(input: {
  readonly exchangeId: string;
  readonly status: RequestOutcomeKey;
  readonly answer?: string | undefined;
  readonly message?: string | undefined;
}): RequestAnswerDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_question' as const,
      curr: 'request_answer' as const,
    },
  };
  if (input.status === 'answered') {
    return zRequestAnswerDetails.parse({
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_answer' as const },
      answered: { text: input.answer?.trim() ?? '' },
    });
  }
  if (input.status === 'cancelled') {
    return zRequestAnswerDetails.parse({ ...base, cancelled: {} });
  }
  return zRequestAnswerDetails.parse({
    ...base,
    unavailable: { message: input.message ?? 'request_answer unavailable' },
  });
}
