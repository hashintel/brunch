import { formatMutateGraphResult } from '../agents/contexts/data-model/graph/commit-result.js';
import { formatRequestReview } from '../agents/contexts/exchanges/request-response.js';
import { projectRequestReview, type ReviewDecision } from '../exchanges/projections/request-response.js';
import {
  zPresentReviewSetDetails,
  type PresentReviewSetDetails,
  type ReviewSetDetailsPayload,
} from '../exchanges/schemas/index.js';
import type { CommandExecutor, MutateGraphSuccess } from '../graph/command-executor.js';
import type { ReviewSetProposalPayload } from '../graph/review-set.js';

export type ReviewSetSettlement =
  | {
      readonly status: 'settled';
      readonly accepted: MutateGraphSuccess;
      readonly details: ReturnType<typeof projectRequestReview>;
      readonly content: string;
    }
  | {
      readonly status: 'terminal';
      readonly details: ReturnType<typeof projectRequestReview>;
      readonly content: string;
    }
  | { readonly status: 'structural_illegal'; readonly diagnostics: readonly Record<string, unknown>[] };

/** Shared D27-L authority: validate persisted offer, commit, then mint its terminal. */
export function settleReviewSetResponse(input: {
  readonly persistedPresent: unknown;
  readonly decision: ReviewDecision;
  readonly comment?: string | undefined;
  readonly specId: number;
  readonly proposalEntryId?: string | undefined;
  readonly commandExecutor: Pick<CommandExecutor, 'acceptReviewSet'>;
}): ReviewSetSettlement {
  const parsed = zPresentReviewSetDetails.safeParse(input.persistedPresent);
  if (!parsed.success) {
    return {
      status: 'structural_illegal',
      diagnostics: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'presentReviewSet',
        message: issue.message,
      })),
    };
  }
  if (input.decision === 'request_changes' && !input.comment?.trim()) {
    return {
      status: 'structural_illegal',
      diagnostics: [{ field: 'review.comment', message: 'request_changes requires comment' }],
    };
  }
  if (input.decision !== 'approve') {
    const details = projectRequestReview({
      exchangeId: parsed.data.exchange_id,
      respondsToPresentTool: 'present_review_set',
      status: 'answered',
      review: input.decision,
      ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
    } as Parameters<typeof projectRequestReview>[0]);
    return { status: 'terminal', details, content: formatRequestReview(details) };
  }

  const accepted = input.commandExecutor.acceptReviewSet({
    specId: input.specId,
    proposalEntryId: input.proposalEntryId,
    payload: proposalFromPresent(parsed.data),
  });
  if (accepted.status === 'structural_illegal') {
    return { status: 'structural_illegal', diagnostics: accepted.diagnostics.map((item) => ({ ...item })) };
  }
  const details = projectRequestReview({
    exchangeId: parsed.data.exchange_id,
    respondsToPresentTool: 'present_review_set',
    status: 'answered',
    review: 'approve',
    ...(input.comment?.trim() ? { comment: input.comment.trim() } : {}),
  });
  return {
    status: 'settled',
    accepted,
    details,
    content: `${formatRequestReview(details)}\n\n${formatMutateGraphResult(accepted)}`,
  };
}

function proposalFromPresent(present: PresentReviewSetDetails): ReviewSetProposalPayload {
  const narrative = present.display.body?.trim() || present.display.heading.trim();
  return {
    schemaVersion: 1,
    lens: 'intent',
    epistemicStatus: 'asserted',
    grounding: { summary: narrative, support: [`present_review_set:${present.exchange_id}`] },
    pitch: { title: present.display.heading.trim(), narrative },
    entityDrafts: present.review_set.nodes.map((draft) => ({
      draftId: draft.draft_id,
      proposedCode: draft.proposed_code,
      plane: draft.plane,
      kind: draft.kind,
      title: draft.title,
      ...(draft.body !== undefined ? { body: draft.body } : {}),
      ...(draft.detail !== undefined ? { detail: draft.detail } : {}),
    })),
    edgeDrafts: present.review_set.edges.map(edgeFromDetails),
  };
}

type Edge = ReviewSetDetailsPayload['edges'][number];
type Ref = Extract<Edge, { category: 'dependency' }>['dependency'];
const ref = (value: Ref) =>
  'draft_id' in value ? { draftId: value.draft_id } : { existingCode: value.existing_code };
function edgeFromDetails(draft: Edge): ReviewSetProposalPayload['edgeDrafts'][number] {
  const rationale = draft.rationale !== undefined ? { rationale: draft.rationale } : {};
  switch (draft.category) {
    case 'dependency':
      return {
        category: draft.category,
        dependency: ref(draft.dependency),
        dependent: ref(draft.dependent),
        ...rationale,
      };
    case 'witness':
      return {
        category: draft.category,
        oracle: ref(draft.oracle),
        claim: ref(draft.claim),
        stance: draft.stance,
        ...rationale,
      };
    case 'rationale':
      return {
        category: draft.category,
        support: ref(draft.support),
        claim: ref(draft.claim),
        stance: draft.stance,
        ...rationale,
      };
    case 'realization':
      return {
        category: draft.category,
        abstract: ref(draft.abstract),
        concrete: ref(draft.concrete),
        ...rationale,
      };
    case 'refinement':
      return {
        category: draft.category,
        abstract: ref(draft.abstract),
        concrete: ref(draft.concrete),
        ...rationale,
      };
    case 'exclusion':
      return {
        category: draft.category,
        boundary: ref(draft.boundary),
        subject: ref(draft.subject),
        ...rationale,
      };
    case 'composition':
      return { category: draft.category, whole: ref(draft.whole), part: ref(draft.part), ...rationale };
    case 'cross_reference':
      return { category: draft.category, a: ref(draft.a), b: ref(draft.b), ...rationale };
    case 'supersession':
      return {
        category: draft.category,
        successor: ref(draft.successor),
        predecessor: ref(draft.predecessor),
        ...rationale,
      };
  }
}
