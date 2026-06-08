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
  readonly edges: readonly {
    readonly category: string;
    readonly source: ReviewSetDetailsEndpointRef;
    readonly target: ReviewSetDetailsEndpointRef;
    readonly stance?: 'for' | 'against' | undefined;
    readonly rationale?: string | undefined;
  }[];
}

type ReviewSetDetailsEndpointRef = { readonly draft_id: string } | { readonly existing_code: string };

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
    edgeDrafts: input.reviewSet.edges.map((draft) => ({
      category: draft.category,
      source: endpointRefFromDetails(draft.source),
      target: endpointRefFromDetails(draft.target),
      ...(draft.stance !== undefined ? { stance: draft.stance } : {}),
      ...(draft.rationale !== undefined ? { rationale: draft.rationale } : {}),
    })),
  };
}

function endpointRefFromDetails(
  value: ReviewSetDetailsPayload['edges'][number]['source'],
): ReviewSetProposalPayload['edgeDrafts'][number]['source'] {
  if ('draft_id' in value) return { draftId: value.draft_id };
  return { existingCode: value.existing_code };
}
