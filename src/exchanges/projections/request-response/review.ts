import type { RequestReviewDetails } from '../../schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA } from '../../schemas/index.js';

export type { RequestReviewDetails };
export type ReviewDecision = 'approve' | 'request_changes' | 'reject';

type ReviewSetReviewProjectionInput =
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: ReviewDecision;
      readonly comment?: string | undefined;
      readonly respondsToPresentTool?: 'present_review_set';
    }
  | {
      readonly exchangeId: string;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
      readonly respondsToPresentTool?: 'present_review_set' | undefined;
    };

type DigestReviewProjectionInput =
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: ReviewDecision;
      readonly acceptedAbstract?: string | undefined;
      readonly comment?: string | undefined;
      readonly respondsToPresentTool: 'present_digest';
    }
  | {
      readonly exchangeId: string;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
      readonly respondsToPresentTool: 'present_digest';
    };

type RequestReviewProjectionInput = ReviewSetReviewProjectionInput | DigestReviewProjectionInput;

export function projectRequestReview(input: RequestReviewProjectionInput): RequestReviewDetails {
  if (input.respondsToPresentTool === 'present_digest') return projectDigestReview(input);
  return projectReviewSetReview(input);
}

function projectReviewSetReview(input: ReviewSetReviewProjectionInput): RequestReviewDetails {
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
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered: { decision: input.review, comment: input.comment ?? '' },
    };
  }
  if (input.status === 'answered' && input.review === 'approve') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered: {
        decision: 'approve',
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    };
  }
  if (input.status === 'answered') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
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

function projectDigestReview(input: DigestReviewProjectionInput): RequestReviewDetails {
  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: {
      prev: 'present_digest' as const,
      curr: 'request_review' as const,
    },
  };
  if (input.status === 'answered' && input.review === 'request_changes') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered: { decision: input.review, comment: input.comment ?? '' },
    };
  }
  if (input.status === 'answered' && input.review === 'approve') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered: {
        decision: 'approve',
        accepted_abstract: input.acceptedAbstract ?? '',
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    };
  }
  if (input.status === 'answered') {
    return {
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
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
