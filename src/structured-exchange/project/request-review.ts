import {
  STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
  type StructuredExchangeRequestDetails,
} from '../../.pi/extensions/structured-exchange/shared/model.js';

export type ReviewDecision = 'approve' | 'request_changes' | 'reject';

export function projectRequestReview(input: {
  readonly toolCallId: string;
  readonly exchangeId: string;
  readonly status: 'answered' | 'cancelled' | 'unavailable';
  readonly review?: ReviewDecision | undefined;
  readonly comment?: string | undefined;
  readonly message?: string | undefined;
}): StructuredExchangeRequestDetails {
  return {
    schema: STRUCTURED_EXCHANGE_REQUEST_SCHEMA,
    schemaVersion: 1,
    exchangeId: input.exchangeId,
    requestTool: 'request_review',
    status: input.status,
    respondsTo: { exchangeId: input.exchangeId, presentTool: 'present_review_set' },
    ...(input.review !== undefined ? { review: input.review } : {}),
    ...(input.comment !== undefined ? { comment: input.comment } : {}),
    ...(input.message !== undefined ? { message: input.message } : {}),
    createdAtToolCallId: input.toolCallId,
  };
}
