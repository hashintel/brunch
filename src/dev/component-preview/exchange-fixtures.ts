import type { PresentQuestionParams } from '../../.pi/extensions/exchanges/schemas/index.js';
import { formatPresentQuestion } from '../../agents/contexts/exchanges/present-question.js';
import { projectPresentQuestion } from '../../projections/exchanges/present-question.js';

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
