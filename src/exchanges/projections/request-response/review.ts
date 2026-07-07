import type { RequestReviewDetails } from '../../schemas/index.js';
import { STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA, zRequestReviewDetails } from '../../schemas/index.js';

export type { RequestReviewDetails };
export type ReviewDecision = 'approve' | 'request_changes' | 'reject';
export type ReviewPresentTool = 'present_review_set' | 'present_digest';

type RequestReviewProjectionInput =
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: 'approve';
      readonly comment?: string | undefined;
      readonly respondsToPresentTool: 'present_review_set';
    }
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: 'approve';
      readonly acceptedAbstract: string;
      readonly comment?: string | undefined;
      readonly respondsToPresentTool: 'present_digest';
    }
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: 'request_changes';
      readonly comment: string;
      readonly respondsToPresentTool: ReviewPresentTool;
    }
  | {
      readonly exchangeId: string;
      readonly status: 'answered';
      readonly review: 'reject';
      readonly comment?: string | undefined;
      readonly respondsToPresentTool: ReviewPresentTool;
    }
  | {
      readonly exchangeId: string;
      readonly status: 'cancelled' | 'unavailable';
      readonly message?: string | undefined;
      readonly respondsToPresentTool: ReviewPresentTool;
    };

export function projectRequestReview(input: RequestReviewProjectionInput): RequestReviewDetails {
  if (input.respondsToPresentTool === 'present_digest') {
    const base = {
      schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
      v: 1 as const,
      exchange_id: input.exchangeId,
      tool_meta: { prev: 'present_digest' as const, curr: 'request_review' as const },
    };
    return projectRequestReviewWithBase(input, base);
  }

  const base = {
    schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
    v: 1 as const,
    exchange_id: input.exchangeId,
    tool_meta: { prev: 'present_review_set' as const, curr: 'request_review' as const },
  };
  return projectRequestReviewWithBase(input, base);
}

function projectRequestReviewWithBase(
  input: RequestReviewProjectionInput,
  base: Pick<RequestReviewDetails, 'schema' | 'v' | 'exchange_id' | 'tool_meta'>,
): RequestReviewDetails {
  if (input.status === 'answered' && input.review === 'request_changes') {
    return zRequestReviewDetails.parse({
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered: { decision: input.review, comment: input.comment },
    });
  }
  if (input.status === 'answered' && input.review === 'approve') {
    const answered =
      input.respondsToPresentTool === 'present_digest'
        ? {
            decision: 'approve' as const,
            accepted_abstract: input.acceptedAbstract,
            ...(input.comment !== undefined ? { comment: input.comment } : {}),
          }
        : {
            decision: 'approve' as const,
            ...(input.comment !== undefined ? { comment: input.comment } : {}),
          };
    return zRequestReviewDetails.parse({
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered,
    });
  }
  if (input.status === 'answered') {
    return zRequestReviewDetails.parse({
      ...base,
      tool_meta: { ...base.tool_meta, next: 'capture_review' as const },
      answered: {
        decision: 'reject',
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    });
  }
  if (input.status === 'cancelled') return zRequestReviewDetails.parse({ ...base, cancelled: {} });
  return zRequestReviewDetails.parse({
    ...base,
    unavailable: { message: input.message ?? 'request_review requires interactive UI' },
  });
}
