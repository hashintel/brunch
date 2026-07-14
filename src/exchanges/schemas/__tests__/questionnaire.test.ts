import { describe, expect, it } from 'vitest';

import { zAskParams, zQuestionnaireAnswersFor } from '../index.js';

const questions = [
  { id: 'goal', kind: 'free-text' as const, prompt: 'What matters?' },
  { id: 'shape', kind: 'single-select' as const, prompt: 'Which shape?', options: [{ id: 'a', label: 'A' }] },
  {
    id: 'risks',
    kind: 'multi-select' as const,
    prompt: 'Which risks?',
    options: [
      { id: 'x', label: 'X' },
      { id: 'y', label: 'Y' },
    ],
  },
];

describe('bounded ask questionnaire', () => {
  it('accepts fixed ordered free-text/single/multi questions and keyed answers', () => {
    expect(zAskParams.parse({ exchangeId: 'capture', acceptsDigest: 'digest-2', questions })).toMatchObject({
      questions,
    });
    expect(
      zQuestionnaireAnswersFor(questions).parse([
        { questionId: 'goal', kind: 'free-text', text: 'Fast feedback' },
        { questionId: 'shape', kind: 'single-select', optionId: 'a' },
        { questionId: 'risks', kind: 'multi-select', optionIds: ['x', 'y'] },
      ]),
    ).toHaveLength(3);
  });

  it('admits only the bounded no-material-question confirmation contract', () => {
    const confirmation = {
      exchangeId: 'confirm-digest',
      acceptsDigest: 'digest-final',
      body: 'Is this understanding complete?',
      options: [
        { id: 'confirm', label: 'Confirm' },
        { id: 'revise', label: 'Revise' },
      ],
    };
    expect(zAskParams.safeParse(confirmation).success).toBe(true);
    expect(zAskParams.safeParse({ ...confirmation, options: [{ id: 'yes', label: 'Yes' }] }).success).toBe(
      false,
    );
    expect(zAskParams.safeParse({ ...confirmation, multiple: true }).success).toBe(false);
  });

  it.each([
    { exchangeId: 'x', acceptsDigest: 'd', questions: [...questions, questions[0]] },
    { exchangeId: 'x', acceptsDigest: 'd', questions, layout: 'wizard' },
    { exchangeId: 'x', acceptsDigest: 'd', questions, conditionalBranches: [] },
  ])('rejects duplicate ids and generic forms vocabulary', (value) =>
    expect(zAskParams.safeParse(value).success).toBe(false),
  );

  it('rejects unknown, duplicate, missing, and invalid option answers', () => {
    const schema = zQuestionnaireAnswersFor(questions);
    expect(schema.safeParse([{ questionId: 'unknown', kind: 'free-text', text: 'x' }]).success).toBe(false);
    expect(
      schema.safeParse([
        { questionId: 'goal', kind: 'free-text', text: 'x' },
        { questionId: 'goal', kind: 'free-text', text: 'y' },
        { questionId: 'shape', kind: 'single-select', optionId: 'bad' },
        { questionId: 'risks', kind: 'multi-select', optionIds: ['x'] },
      ]).success,
    ).toBe(false);
  });
});
