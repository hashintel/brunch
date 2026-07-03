import { describe, expect, it } from 'vitest';

import { presentQuestionOptionsFixture } from '../../../../dev/component-preview/exchange-fixtures.js';
import { projectPresentQuestion } from '../../../../exchanges/projections/present-question.js';
import { projectRequestAnswer } from '../../../../exchanges/projections/request-answer.js';
import { projectRequestChoice } from '../../../../exchanges/projections/request-choice.js';
import { projectRequestChoices } from '../../../../exchanges/projections/request-choices.js';
import { projectRequestReview } from '../../../../exchanges/projections/request-review.js';
import { formatPresentQuestion } from '../present-question.js';
import { formatRequestAnswer } from '../request-answer.js';
import { formatRequestChoice } from '../request-choice.js';
import { formatRequestChoices } from '../request-choices.js';
import { formatRequestResponseDiagnostic } from '../request-response.js';
import { formatRequestReview } from '../request-review.js';

describe('structured-exchange renderer inventory', () => {
  it('covers the request/present result renderers not snapshot-locked elsewhere', async () => {
    const freeTextQuestion = projectPresentQuestion({
      exchangeId: 'ex-answer',
      heading: 'What should change?',
      body: 'Name the product-facing improvement.',
    });
    await expect(
      [
        formatPresentQuestion(freeTextQuestion),
        formatRequestAnswer(
          projectRequestAnswer({ exchangeId: 'ex-answer', status: 'answered', answer: 'Make it clear.' }),
        ),
      ].join('\n\n'),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-question-answer-tuple.md');

    const choiceOptions = [
      { id: 'iterm', content: 'iTerm2', rationale: 'Already installed.' },
      { id: 'kitty', content: 'Kitty', rationale: 'Better keyboard protocol.' },
    ];
    const choiceQuestion = projectPresentQuestion({
      exchangeId: 'ex-choice',
      heading: 'Choose a terminal',
      body: 'Pick one option.',
      options: choiceOptions,
    });
    await expect(
      [
        formatPresentQuestion(choiceQuestion),
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
      ].join('\n\n'),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-question-choice-tuple.md');

    const choicesOptions = [
      { id: 'grammar', content: 'Grammar drift', rationale: 'Model-facing `content` is *contract-like*.' },
      { id: 'preview', content: 'Preview lag', rationale: 'Humans need a fast visual loop.' },
    ];
    const choicesQuestion = projectPresentQuestion({
      exchangeId: 'ex-choices',
      heading: 'Choose risks',
      body: 'Select every risk that should stay visible.',
      options: choicesOptions,
      multiple: true,
      allowOther: true,
    });
    await expect(
      [
        formatPresentQuestion(choicesQuestion),
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
      ].join('\n\n'),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-question-choices-tuple.md');

    await expect(
      formatRequestChoice(
        projectRequestChoice({
          exchangeId: 'ex-candidate',
          respondsToPresentTool: 'present_question',
          status: 'answered',
          choice: { id: 'a', label: 'Alpha', kind: 'listed' },
          options: [{ id: 'a', content: 'Alpha' }],
          comment: 'Because.',
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-choice.md');

    await expect(
      formatRequestChoices(
        projectRequestChoices({
          exchangeId: 'ex-1',
          status: 'answered',
          choices: [
            { id: 'a', label: 'Alpha*', kind: 'listed' },
            { id: 'c', label: 'Gamma', kind: 'listed' },
          ],
          options: [
            { id: 'a', content: 'Alpha*' },
            { id: 'b', content: 'Beta' },
            { id: 'c', content: 'Gamma' },
          ],
          comment: 'Both.',
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-choices.md');

    await expect(
      formatRequestResponseDiagnostic({ message: 'Waiting for a structured response.' }),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-diagnostic.md');

    await expect(
      formatRequestReview(
        projectRequestReview({
          exchangeId: 'ex-1',
          status: 'answered',
          review: 'request_changes',
          comment: 'Tighten scope.',
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-review.md');
  });

  it('locks the present_question model-facing content golden', async () => {
    // TUI renderResult is the Markdown pass-through of this same string (D104-L
    // revision 2026-07-02), so the content golden is the single snapshot family.
    await expect(presentQuestionOptionsFixture.result.content[0]?.text).toMatchFileSnapshot(
      '../__snapshots__/exchange-renderer-inventory-present-question-content.md',
    );
  });

  it('keeps unavailable/cancelled branches model-facing and explicit', async () => {
    await expect(
      formatRequestAnswer(projectRequestAnswer({ exchangeId: 'ex-1', status: 'cancelled' })),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-cancelled-answer.md');

    await expect(
      formatRequestChoice(
        projectRequestChoice({
          exchangeId: 'ex-1',
          respondsToPresentTool: 'present_question',
          status: 'unavailable',
          message: 'choice unavailable',
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-unavailable-choice.md');

    await expect(
      formatRequestChoices(
        projectRequestChoices({
          exchangeId: 'ex-1',
          status: 'unavailable',
          message: 'choices unavailable',
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-unavailable-choices.md');

    await expect(
      formatRequestReview(projectRequestReview({ exchangeId: 'ex-1', status: 'cancelled' })),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-cancelled-review.md');
  });
});
