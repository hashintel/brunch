import { formatPresentCandidates } from '../../agents/contexts/exchanges/present-candidates.js';
import { formatPresentQuestion } from '../../agents/contexts/exchanges/present-question.js';
import {
  formatExchangeStructuralIllegal,
  formatPresentReviewSet,
} from '../../agents/contexts/exchanges/present-review-set.js';
import { projectPresentCandidates } from '../../exchanges/projections/present-candidates.js';
import { projectPresentQuestion } from '../../exchanges/projections/present-question.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import type { PresentQuestionParams } from '../../exchanges/schemas/index.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';

function presentQuestionFixture(params: PresentQuestionParams) {
  const projection = projectPresentQuestion(params);
  return {
    params,
    projection,
    result: {
      content: [{ type: 'text' as const, text: formatPresentQuestion(projection) }],
      details: projection.details,
    },
  };
}

export const presentQuestionOptionsFixture = presentQuestionFixture({
  exchangeId: 'preview-question-options',
  heading: 'Which direction should the next slice take?',
  body: 'Pick the answer that best matches the current product risk.',
  options: [
    {
      id: 'thin',
      content: 'Thin vertical proof',
      rationale: 'Proves the seam before styling the neighborhood.',
    },
    { id: 'sweep', content: 'Renderer sweep', rationale: 'Closes the family once the head slice lands.' },
  ],
  multiple: true,
  allowOther: true,
  allowNone: true,
  commentPrompt: 'Add any constraint the options miss.',
});

export const presentQuestionFreeTextFixture = presentQuestionFixture({
  exchangeId: 'preview-question-free-text',
  heading: 'What would make this useful?',
  body: 'Answer in the vocabulary of the current Brunch session.',
});

export const presentQuestionFixtures = [
  presentQuestionOptionsFixture,
  presentQuestionFreeTextFixture,
] as const;

export const presentCandidatesFixture = (() => {
  const params = {
    exchangeId: 'preview-candidates',
    heading: 'Which architecture path should we try?',
    body: 'Compare the options before making the recognition-only choice.',
    candidates: [
      {
        id: 'local-first',
        title: 'Local-first workbench',
        user_rubric: {
          core_bet: 'Use the local graph as the product spine.',
          best_fit: 'Best when the POC needs fast iteration and inspectable state.',
          cost_complexity: 'Requires owning local persistence and recovery clearly.',
          covers_well: 'Covers transcript coherence, graph projection, and preview loops.',
          main_risks: 'Does not prove collaborative cloud semantics.',
          lock_in_constraints: 'Commits the POC to local-first assumptions.',
          recommendation: 'Choose this while the product shape is still moving.',
        },
        meta_rubric: {
          legibility_cost_of_knowing: 'Easy to inspect with local fixtures.',
          failure_modes: 'Can under-test multi-user timing.',
          coverage_range: 'Strong for current walkthrough risks.',
          commitment: 'Keeps cloud decisions deferred.',
        },
        graph_refs: [{ node_id: 'goal-local-workbench' }],
      },
      {
        id: 'cloud-handoff',
        title: 'Cloud handoff path',
        user_rubric: {
          core_bet: 'Prove collaboration and remote continuity first.',
          best_fit: 'Best when shared workspaces are already the launch risk.',
          cost_complexity: 'Adds account, sync, and conflict surfaces early.',
          covers_well: 'Covers multi-user handoff pressure.',
          main_risks: 'Can distract from the elicitation loop.',
          lock_in_constraints: 'Commits infrastructure before the interaction model settles.',
        },
        meta_rubric: {
          failure_modes: 'May widen scope before the transcript contract is stable.',
        },
        graph_refs: [{ node_id: 'goal-cloud-collaboration' }],
      },
    ],
  };
  const projection = projectPresentCandidates(params);
  return {
    params,
    projection,
    result: {
      content: [{ type: 'text' as const, text: formatPresentCandidates(projection) }],
      details: projection.details,
    },
  };
})();

export const presentReviewSetFixture = (() => {
  const payload = {
    schemaVersion: 1,
    lens: 'intent',
    epistemicStatus: 'asserted',
    grounding: {
      summary: 'Launch readiness needs rollback and observability.',
      support: ['User asked for launch readiness.'],
    },
    pitch: {
      title: 'Launch readiness review set',
      narrative: 'Review the launch-readiness commitments together.',
    },
    entityDrafts: [
      {
        draftId: 'goal-launch',
        proposedCode: 'G2',
        plane: 'intent',
        kind: 'goal',
        title: 'Launch safely',
      },
      {
        draftId: 'req-rollback',
        proposedCode: 'REQ5',
        plane: 'intent',
        kind: 'requirement',
        title: 'Rollback is required',
        body: 'Rollback must be available before launch.',
      },
      {
        draftId: 'check-observable',
        proposedCode: 'CH3',
        plane: 'oracle',
        kind: 'check',
        title: 'Observe rollback path',
      },
    ],
    edgeDrafts: [
      {
        category: 'dependency',
        dependency: { draftId: 'req-rollback' },
        dependent: { draftId: 'goal-launch' },
      },
      {
        category: 'witness',
        oracle: { draftId: 'check-observable' },
        claim: { draftId: 'goal-launch' },
        stance: 'for',
        rationale: 'The check proves the rollback path is visible.',
      },
    ],
  } satisfies ReviewSetProposalPayload;
  const projection = projectPresentReviewSet({ exchangeId: 'preview-review-set', payload });
  return {
    payload,
    projection,
    result: {
      content: [{ type: 'text' as const, text: formatPresentReviewSet(projection) }],
      details: projection.details,
    },
  };
})();

export const structuralIllegalFixture = {
  result: {
    content: [
      {
        type: 'text' as const,
        text: formatExchangeStructuralIllegal({
          diagnostics: [
            {
              field: 'review_set.nodes[0].proposed_code',
              message: 'Proposed graph code must be unique within the review set.',
            },
            {
              field: 'review_set.edges[1].dependency.draft_id',
              message:
                'Edge references draft id "missing-requirement", but no matching node draft was submitted.',
            },
          ],
        }),
      },
    ],
    details: {
      schema: 'brunch.structured_exchange.diagnostic',
      kind: 'STRUCTURAL_ILLEGAL',
    },
  },
};
