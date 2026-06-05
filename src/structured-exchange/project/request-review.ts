import type { RequestReviewDetails } from '../../.pi/extensions/structured-exchange/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
  zRequestReviewDetails,
} from '../../.pi/extensions/structured-exchange/schemas/index.js';

export type ReviewDecision = 'approve' | 'request_changes' | 'reject';

export function projectRequestReview(input: {
  readonly exchangeId: string;
  readonly status: 'answered' | 'cancelled' | 'unavailable';
  readonly review?: ReviewDecision | undefined;
  readonly comment?: string | undefined;
  readonly message?: string | undefined;
}): RequestReviewDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_review_set' as const,
      curr: 'request_review' as const,
    },
  };
  if (input.status === 'cancelled') return zRequestReviewDetails.parse({ ...base, cancelled: {} });
  if (input.status === 'unavailable') {
    return zRequestReviewDetails.parse({
      ...base,
      unavailable: { message: input.message ?? 'request_review requires interactive UI' },
    });
  }
  const review = input.review ?? 'reject';
  if (review === 'request_changes') {
    return zRequestReviewDetails.parse({
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' },
      answered: { decision: review, comment: input.comment ?? '' },
    });
  }
  return zRequestReviewDetails.parse({
    ...base,
    tool_meta: { ...base.tool_meta, next: 'capture_review' },
    answered: {
      decision: review,
      ...(input.comment !== undefined ? { comment: input.comment } : {}),
    },
  });
}
