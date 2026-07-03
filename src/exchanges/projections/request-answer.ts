import type { RequestAnswerDetails } from '../../.pi/extensions/exchanges/schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA } from '../../.pi/extensions/exchanges/schemas/index.js';

export type { RequestAnswerDetails };
type RequestAnswerProjectionInput =
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly answer: string;
    }
  | {
      readonly exchangeId: string;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
    };

export function projectRequestAnswer(input: RequestAnswerProjectionInput): RequestAnswerDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_question' as const,
      curr: 'request_answer' as const,
    },
  };
  if (input.status === 'answered') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_answer' as const },
      answered: { text: input.answer.trim() },
    };
  }
  if (input.status === 'cancelled') {
    return { ...base, cancelled: {} };
  }
  return {
    ...base,
    unavailable: { message: input.message ?? 'request_answer unavailable' },
  };
}
