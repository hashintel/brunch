import type { RoleNamedEdgeDraftOf } from '../../graph/command-executor/role-named-edge-draft.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';
type ReviewSetDetailsPlane = 'intent' | 'oracle' | 'design' | 'plan';

interface ReviewSetDetailsPayload {
  readonly nodes: readonly {
    readonly draft_id: string;
    readonly plane: ReviewSetDetailsPlane;
    readonly kind: string;
    readonly title: string;
    readonly body?: string | undefined;
    readonly detail?: unknown;
  }[];
  readonly edges: readonly ReviewSetDetailsEdgeDraft[];
}

type ReviewSetDetailsEndpointRef = { readonly draft_id: string } | { readonly existing_code: string };
type ReviewSetDetailsEdgeDraft = RoleNamedEdgeDraftOf<ReviewSetDetailsEndpointRef>;

export function reviewSetProposalPayloadFromDetails(input: {
  readonly exchangeId: string;
  readonly heading: string;
  readonly body?: string | undefined;
  readonly reviewSet: ReviewSetDetailsPayload;
}): ReviewSetProposalPayload {
  const narrative = input.body?.trim() || input.heading.trim();
  return {
    schemaVersion: 1,
    lens: 'intent',
    epistemicStatus: 'asserted',
    grounding: {
      summary: narrative,
      support: [`present_review_set:${input.exchangeId}`],
    },
    pitch: {
      title: input.heading.trim(),
      narrative,
    },
    entityDrafts: input.reviewSet.nodes.map((draft) => ({
      draftId: draft.draft_id,
      plane: draft.plane,
      kind: draft.kind,
      title: draft.title,
      ...(draft.body !== undefined ? { body: draft.body } : {}),
      ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
    })),
    edgeDrafts: input.reviewSet.edges.map(reviewSetEdgeDraftFromDetails),
  };
}

function endpointRefFromDetails(value: ReviewSetDetailsEndpointRef) {
  if ('draft_id' in value) return { draftId: value.draft_id };
  return { existingCode: value.existing_code };
}

function reviewSetEdgeDraftFromDetails(
  draft: ReviewSetDetailsEdgeDraft,
): ReviewSetProposalPayload['edgeDrafts'][number] {
  switch (draft.category) {
    case 'dependency':
      return {
        category: draft.category,
        dependency: endpointRefFromDetails(draft.dependency),
        dependent: endpointRefFromDetails(draft.dependent),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'witness':
      return {
        category: draft.category,
        oracle: endpointRefFromDetails(draft.oracle),
        claim: endpointRefFromDetails(draft.claim),
        stance: draft.stance,
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'rationale':
      return {
        category: draft.category,
        support: endpointRefFromDetails(draft.support),
        claim: endpointRefFromDetails(draft.claim),
        stance: draft.stance,
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'realization':
      return {
        category: draft.category,
        abstract: endpointRefFromDetails(draft.abstract),
        concrete: endpointRefFromDetails(draft.concrete),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'refinement':
      return {
        category: draft.category,
        abstract: endpointRefFromDetails(draft.abstract),
        concrete: endpointRefFromDetails(draft.concrete),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'exclusion':
      return {
        category: draft.category,
        boundary: endpointRefFromDetails(draft.boundary),
        subject: endpointRefFromDetails(draft.subject),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'composition':
      return {
        category: draft.category,
        whole: endpointRefFromDetails(draft.whole),
        part: endpointRefFromDetails(draft.part),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'cross_reference':
      return {
        category: draft.category,
        a: endpointRefFromDetails(draft.a),
        b: endpointRefFromDetails(draft.b),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
    case 'supersession':
      return {
        category: draft.category,
        successor: endpointRefFromDetails(draft.successor),
        predecessor: endpointRefFromDetails(draft.predecessor),
        ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
      };
  }
}
