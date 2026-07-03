import type { PresentQuestionParams } from '../../.pi/extensions/exchanges/schemas/index.js';
import { formatPresentQuestion } from '../../agents/contexts/exchanges/present-question.js';
import { formatPresentReviewSet } from '../../agents/contexts/exchanges/present-review-set.js';
import { projectPresentQuestion } from '../../exchanges/projections/present-question.js';
import { projectPresentReviewSet } from '../../exchanges/projections/present-review-set.js';
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
