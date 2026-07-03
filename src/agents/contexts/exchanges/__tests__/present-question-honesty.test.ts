import { describe, expect, it } from 'vitest';

import {
  presentQuestionFreeTextFixture,
  presentQuestionOptionsFixture,
} from '../../../../dev/component-preview/exchange-fixtures.js';
import { projectPresentQuestion } from '../../../../exchanges/projections/present-question.js';
import {
  projectRequestAnswer,
  projectRequestChoice,
  projectRequestChoices,
} from '../../../../exchanges/projections/request-response.js';
import { formatPresentQuestion, PRESENT_QUESTION_CONTENT_ELISIONS } from '../present-question.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';
import { formatRequestAnswer, formatRequestChoice, formatRequestChoices } from '../request-response.js';

describe('present_question content render-honesty', () => {
  it('locks transcript-shaped question tuples across response forms', async () => {
    const choiceOptions = [
      { id: 'iterm', content: 'iTerm2', rationale: 'Already installed.' },
      { id: 'kitty', content: 'Kitty', rationale: 'Better keyboard protocol.' },
    ];
    const choicesOptions = [
      { id: 'grammar', content: 'Grammar drift', rationale: 'Model-facing `content` is contract-like.' },
      { id: 'preview', content: 'Preview lag', rationale: 'Humans need a fast visual loop.' },
    ];

    const transcript = [
      section(
        'free-text answered',
        formatPresentQuestion(
          projectPresentQuestion({
            exchangeId: 'ex-answer',
            heading: 'What should change?',
            body: 'Name the product-facing improvement.',
          }),
        ),
        formatRequestAnswer(
          projectRequestAnswer({ exchangeId: 'ex-answer', status: 'answered', answer: 'Make it clear.' }),
        ),
      ),
      section(
        'single-choice answered',
        formatPresentQuestion(
          projectPresentQuestion({
            exchangeId: 'ex-choice',
            heading: 'Choose a terminal',
            body: 'Pick one option.',
            options: choiceOptions,
          }),
        ),
        formatRequestChoice(
          projectRequestChoice({
            exchangeId: 'ex-choice',
            respondsToPresentTool: 'present_question',
            status: 'answered',
            choice: { id: 'kitty', label: 'Kitty', kind: 'listed' },
            options: choiceOptions,
            comment: 'Better for keyboard-heavy sessions.',
          }),
        ),
      ),
      section(
        'multi-choice answered with write-in',
        formatPresentQuestion(
          projectPresentQuestion({
            exchangeId: 'ex-choices',
            heading: 'Choose risks',
            body: 'Select every risk that should stay visible.',
            options: choicesOptions,
            multiple: true,
            allowOther: true,
          }),
        ),
        formatRequestChoices(
          projectRequestChoices({
            exchangeId: 'ex-choices',
            status: 'answered',
            choices: [
              { id: 'grammar', label: 'Grammar drift', kind: 'listed' },
              { id: 'other', label: 'Schema source-of-truth drift', kind: 'other' },
            ],
            options: choicesOptions,
            comment: 'Both affect re-entry.',
          }),
        ),
      ),
      section(
        'cancelled free-text',
        formatPresentQuestion(presentQuestionFreeTextFixture.projection),
        formatRequestAnswer(projectRequestAnswer({ exchangeId: 'ex-1', status: 'cancelled' })),
      ),
      section(
        'unavailable single-choice',
        formatPresentQuestion(presentQuestionOptionsFixture.projection),
        formatRequestChoice(
          projectRequestChoice({
            exchangeId: 'ex-1',
            respondsToPresentTool: 'present_question',
            status: 'unavailable',
            message: 'choice unavailable',
          }),
        ),
      ),
    ].join('\n\n');

    await expect(transcript).toMatchFileSnapshot('../__snapshots__/question-tuples.md');
  });

  it('declares every details leaf as rendered or intentionally elided (options form)', () => {
    const content = formatPresentQuestion(presentQuestionOptionsFixture.projection);

    expect(
      missingRenderedDetailsLeaves(presentQuestionOptionsFixture.result.details, content, {
        elisions: PRESENT_QUESTION_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });

  it('declares every details leaf as rendered or intentionally elided (free-text form)', () => {
    const content = formatPresentQuestion(presentQuestionFreeTextFixture.projection);

    expect(
      missingRenderedDetailsLeaves(presentQuestionFreeTextFixture.result.details, content, {
        elisions: PRESENT_QUESTION_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });
});

function section(label: string, ...entries: readonly string[]): string {
  return [`# ${label}`, ...entries].join('\n\n');
}
