import { STRUCTURED_EXCHANGE_PRESENT_SCHEMA } from '../../.pi/extensions/structured-exchange/shared/model.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';

export interface PresentReviewSetDetails {
  readonly schema: typeof STRUCTURED_EXCHANGE_PRESENT_SCHEMA;
  readonly schemaVersion: 1;
  readonly exchangeId: string;
  readonly presentTool: 'present_review_set';
  readonly kind: 'review_set';
  readonly status: 'presented';
  readonly expectedRequest: { readonly tool: 'request_review'; readonly required: true };
  readonly createdAtToolCallId: string;
  readonly reviewSet: {
    readonly proposalEntryId?: string | undefined;
    readonly payload: ReviewSetProposalPayload;
  };
}

export interface PresentReviewSetProjection {
  readonly details: PresentReviewSetDetails;
  readonly payload: ReviewSetProposalPayload;
}

export function projectPresentReviewSet(input: {
  readonly toolCallId: string;
  readonly exchangeId: string;
  readonly proposalEntryId?: string | undefined;
  readonly payload: ReviewSetProposalPayload;
}): PresentReviewSetProjection {
  return {
    details: {
      schema: STRUCTURED_EXCHANGE_PRESENT_SCHEMA,
      schemaVersion: 1,
      exchangeId: input.exchangeId,
      presentTool: 'present_review_set',
      kind: 'review_set',
      status: 'presented',
      expectedRequest: { tool: 'request_review', required: true },
      createdAtToolCallId: input.toolCallId,
      reviewSet: {
        ...(input.proposalEntryId !== undefined ? { proposalEntryId: input.proposalEntryId } : {}),
        payload: input.payload,
      },
    },
    payload: input.payload,
  };
}
