import type { RequestReviewDetails } from '../../schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA } from '../../schemas/index.js';

export type { RequestReviewDetails };
export type ReviewDecision = 'approve' | 'request_changes' | 'reject';

type RequestReviewProjectionInput =
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: ReviewDecision;
      readonly comment?: string | undefined;
    }
  | {
      readonly exchangeId: string;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
    };

export function projectRequestReview(input: RequestReviewProjectionInput): RequestReviewDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_review_set' as const,
      curr: 'request_review' as const,
    },
  };
  if (input.status === 'answered' && input.review === 'request_changes') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' },
      answered: { decision: input.review, comment: input.comment ?? '' },
    };
  }
  if (input.status === 'answered') {
    if (input.review === 'approve') {
      return {
        ...base,
        tool_meta: { ...base.tool_meta, next: 'capture_review' },
        answered: {
          decision: 'approve',
          ...(input.comment !== undefined ? { comment: input.comment } : {}),
        },
      };
    }
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' },
      answered: {
        decision: 'reject',
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    };
  }
  if (input.status === 'cancelled') return { ...base, cancelled: {} };
  return {
    ...base,
    unavailable: { message: input.message ?? 'request_review requires interactive UI' },
  };
}
