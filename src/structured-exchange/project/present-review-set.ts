import type {
  PresentReviewSetDetails,
  ReviewSetDetailsPayload,
} from '../../.pi/extensions/structured-exchange/schemas/index.js';
import { STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA } from '../../.pi/extensions/structured-exchange/schemas/index.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';

export interface PresentReviewSetProjection {
  readonly details: PresentReviewSetDetails;
  readonly payload: ReviewSetProposalPayload;
}

export function projectPresentReviewSet(input: {
  readonly exchangeId: string;
  readonly payload: ReviewSetProposalPayload;
}): PresentReviewSetProjection {
  const body = input.payload.pitch.narrative.trim();
  return {
    details: {
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: 1,
      exchange_id: input.exchangeId,
      tool_meta: {
        curr: 'present_review_set',
        next: 'request_review',
      },
      display: {
        heading: input.payload.pitch.title.trim(),
        ...(body ? { body } : {}),
      },
      review_set: reviewSetDetailsPayload(input.payload),
    },
    payload: input.payload,
  };
}

function reviewSetDetailsPayload(payload: ReviewSetProposalPayload): ReviewSetDetailsPayload {
  return {
    nodes: payload.entityDrafts.map((draft) => ({
      draft_id: draft.draftId,
      plane: draft.plane,
      kind: draft.kind,
      title: draft.title,
      ...(draft.body !== undefined ? { body: draft.body } : {}),
      ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
    })),
    edges: payload.edgeDrafts.map((draft) => ({
      category: draft.category,
      source: endpointRefDetails(draft.source),
      target: endpointRefDetails(draft.target),
      ...(draft.stance === 'for' || draft.stance === 'against' ? { stance: draft.stance } : {}),
      ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
    })),
  };
}

function endpointRefDetails(
  value: ReviewSetProposalPayload['edgeDrafts'][number]['source'],
): ReviewSetDetailsPayload['edges'][number]['source'] {
  if ('draftId' in value) return { draft_id: value.draftId };
  return { existing_code: value.existingCode };
}
