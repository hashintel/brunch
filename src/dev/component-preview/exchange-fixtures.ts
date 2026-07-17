import { formatAsk } from '../../agents/contexts/exchanges/ask.js';
import { formatPresentCandidates } from '../../agents/contexts/exchanges/present-candidates.js';
import { formatPresentDigest } from '../../agents/contexts/exchanges/present-digest.js';
import { formatPresentQuestion } from '../../agents/contexts/exchanges/present-question.js';
import {
  formatExchangeStructuralIllegal,
  formatPresentReviewSet,
} from '../../agents/contexts/exchanges/present-review-set.js';
import {
  formatRequestAnswer,
  formatRequestChoice,
  formatRequestChoices,
  formatRequestResponseDiagnostic,
  formatRequestReview,
} from '../../agents/contexts/exchanges/request-response.js';
import { projectAsk } from '../../exchanges/projections/ask.js';
import { projectPresentCandidates } from '../../exchanges/projections/present-candidates.js';
import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { projectPresentQuestion } from '../../exchanges/projections/present-question.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
import {
  projectRequestAnswer,
  projectRequestChoice,
  projectRequestChoices,
  projectRequestReview,
} from '../../exchanges/projections/request-response.js';
import type { PresentQuestionParams } from '../../exchanges/schemas/index.js';
import type { ReviewSetProposalPayload } from '../../graph/review-set.js';

export const askFixture = (() => {
  const question = {
    body: 'Which direction should the next slice take?',
    options: [
      { id: 'thin', label: 'Thin vertical proof', description: 'Proves the seam first.' },
      { id: 'sweep', label: 'Renderer sweep', description: 'Closes the family after the head slice.' },
    ],
  };
  const details = projectAsk({
    exchangeId: 'preview-ask',
    question,
    status: 'answered',
    choice: { id: 'thin', label: 'Thin vertical proof', kind: 'listed' },
    options: question.options,
    comment: 'This is the smallest proof.',
  });
  return {
    details,
    result: {
      content: [{ type: 'text' as const, text: formatAsk(details) }],
      details,
    },
  };
})();

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

export const presentDigestFixture = (() => {
  const params = {
    exchangeId: 'preview-digest',
    heading: 'Digest large source',
    body: 'Review this prose digest before any graph mapping.',
    digest: {
      abstract:
        'The source argues that the POC must keep capture lightweight: ingest should summarize raw material first, then map only accepted source-derived claims.',
      analysis:
        'The useful signal is the distinction between accepted source material and graph truth. The digest can feed mapping, but it does not commit nodes or edges.',
      recommendation:
        'Approve the digest after checking that it preserves the source constraints and omits graph proposals.',
    },
  };
  const projection = projectPresentDigest(params);
  return {
    params,
    projection,
    result: {
      content: [{ type: 'text' as const, text: formatPresentDigest(projection) }],
      details: projection.details,
    },
  };
})();

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
        settlement: 'settled' as const,
        plane: 'intent',
        kind: 'goal',
        title: 'Launch safely',
      },
      {
        draftId: 'req-rollback',
        proposedCode: 'REQ5',
        settlement: 'settled' as const,
        plane: 'intent',
        kind: 'requirement',
        title: 'Rollback is required',
        body: 'Rollback must be available before launch.',
      },
      {
        draftId: 'check-observable',
        proposedCode: 'CH3',
        settlement: 'settled' as const,
        plane: 'oracle',
        kind: 'check',
        title: 'Observe rollback path',
      },
    ],
    edgeDrafts: [
      {
        category: 'dependency',
        settlement: 'settled' as const,
        dependency: { draftId: 'req-rollback' },
        dependent: { draftId: 'goal-launch' },
      },
      {
        category: 'witness',
        settlement: 'settled' as const,
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

export const requestAnswerFixture = (() => {
  const details = projectRequestAnswer({
    exchangeId: 'preview-request-answer',
    status: 'answered',
    answer: 'Keep the transcript formatter as the public exchange surface.',
  });
  return {
    details,
    result: {
      content: [{ type: 'text' as const, text: formatRequestAnswer(details) }],
      details,
    },
  };
})();

export const requestChoiceFixture = (() => {
  // Legacy transcript compatibility fixture: present_question is retired as a
  // registered tool but remains a persisted-read discriminator.
  const details = projectRequestChoice({
    exchangeId: 'preview-request-choice',
    respondsToPresentTool: 'present_question',
    status: 'answered',
    choice: { id: 'preview', label: 'Preview parity', kind: 'listed' },
    options: [
      { id: 'preview', content: 'Preview parity', rationale: 'Keeps the gallery honest.' },
      { id: 'minimal', content: 'Minimal proof', rationale: 'Smaller but less visible.' },
    ],
    comment: 'The preview catches visual drift.',
  });
  return {
    details,
    result: {
      content: [{ type: 'text' as const, text: formatRequestChoice(details) }],
      details,
    },
  };
})();

export const requestChoicesFixture = (() => {
  const details = projectRequestChoices({
    exchangeId: 'preview-request-choices',
    status: 'answered',
    choices: [
      { id: 'coverage', label: 'Add coverage', kind: 'listed' },
      { id: 'other', label: 'Also run the preview', kind: 'other' },
    ],
    options: [
      { id: 'coverage', content: 'Add coverage', rationale: 'Locks the invariant.' },
      { id: 'docs', content: 'Update docs', rationale: 'Explains the decision.' },
    ],
    comment: 'Also run the preview.',
  });
  return {
    details,
    result: {
      content: [{ type: 'text' as const, text: formatRequestChoices(details) }],
      details,
    },
  };
})();

export const requestReviewFixture = (() => {
  const details = projectRequestReview({
    exchangeId: 'preview-request-review',
    status: 'answered',
    review: 'request_changes',
    respondsToPresentTool: 'present_review_set',
    comment: 'Name the outer oracle before closing the frontier.',
  });
  return {
    details,
    result: {
      content: [{ type: 'text' as const, text: formatRequestReview(details) }],
      details,
    },
  };
})();

export const requestTerminalFixture = (() => {
  const message = 'Waiting for a structured response.';
  const details = projectRequestAnswer({
    exchangeId: 'preview-request-terminal',
    status: 'unavailable',
    message,
  });
  return {
    details,
    result: {
      content: [{ type: 'text' as const, text: formatRequestResponseDiagnostic({ message }) }],
      details,
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
  },
};
