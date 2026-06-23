import type {
  PresentReviewSetDetails,
  ReviewSetDetailsPayload,
} from '../../.pi/extensions/exchanges/schemas/index.js';
import {
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  zPresentReviewSetDetails,
} from '../../.pi/extensions/exchanges/schemas/index.js';
import { roleNamedEdgeDraftEndpoints } from '../../graph/command-executor/role-named-edge-draft.js';
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
  const details = zPresentReviewSetDetails.parse({
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: {
      curr: 'present_review_set',
      next: 'request_response',
    },
    display: {
      heading: input.payload.pitch.title.trim(),
      ...(body ? { body } : {}),
    },
    review_set: reviewSetDetailsPayload(input.payload),
  });
  return {
    details,
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
    edges: payload.edgeDrafts.map(reviewSetEdgeDetails),
  };
}

function reviewSetEdgeDetails(
  draft: ReviewSetProposalPayload['edgeDrafts'][number],
): ReviewSetDetailsPayload['edges'][number] {
  const { source, target } = roleNamedEdgeDraftEndpoints(draft);

  switch (draft.category) {
    case 'dependency':
      return {
        category: 'dependency',
        dependency: endpointRefDetails(source),
        dependent: endpointRefDetails(target),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'proof':
      return {
        category: 'proof',
        oracle: endpointRefDetails(source),
        claim: endpointRefDetails(target),
        stance: draft.stance,
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'support':
      return {
        category: 'support',
        support: endpointRefDetails(source),
        claim: endpointRefDetails(target),
        stance: draft.stance,
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'realization':
      return {
        category: 'realization',
        abstract: endpointRefDetails(source),
        concrete: endpointRefDetails(target),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'boundary':
      return {
        category: 'boundary',
        boundary: endpointRefDetails(source),
        subject: endpointRefDetails(target),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'composition':
      return {
        category: 'composition',
        whole: endpointRefDetails(source),
        part: endpointRefDetails(target),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'association':
      return {
        category: 'association',
        a: endpointRefDetails(source),
        b: endpointRefDetails(target),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'supersession':
      return {
        category: 'supersession',
        successor: endpointRefDetails(source),
        predecessor: endpointRefDetails(target),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
  }
}

function endpointRefDetails(value: { readonly draftId: string } | { readonly existingCode: string }) {
  if ('draftId' in value) return { draft_id: value.draftId };
  return { existing_code: value.existingCode };
}
