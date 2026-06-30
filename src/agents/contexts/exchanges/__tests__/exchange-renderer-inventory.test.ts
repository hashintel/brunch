import { describe, expect, it } from 'vitest';

import { projectPresentQuestion } from '../../../../projections/exchanges/present-question.js';
import { projectRequestAnswer } from '../../../../projections/exchanges/request-answer.js';
import { projectRequestChoice } from '../../../../projections/exchanges/request-choice.js';
import { projectRequestChoices } from '../../../../projections/exchanges/request-choices.js';
import { projectRequestReview } from '../../../../projections/exchanges/request-review.js';
import { formatPresentQuestion } from '../present-question.js';
import { formatRequestAnswer } from '../request-answer.js';
import { formatRequestChoice } from '../request-choice.js';
import { formatRequestChoices } from '../request-choices.js';
import { formatRequestResponseDiagnostic } from '../request-response.js';
import { formatRequestReview } from '../request-review.js';

describe('structured-exchange renderer inventory', () => {
  it('covers the request/present result renderers not snapshot-locked elsewhere', async () => {
    await expect(
      formatPresentQuestion(
        projectPresentQuestion({
          exchangeId: 'ex-1',
          heading: 'Choose a direction',
          body: 'Pick one option.',
          options: [{ id: 'a', content: 'Alpha', rationale: 'Fastest path.' }],
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-present.md');

    await expect(
      formatRequestAnswer(
        projectRequestAnswer({ exchangeId: 'ex-1', status: 'answered', answer: 'Freeform answer' }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-answer.md');

    await expect(
      formatRequestChoice(
        projectRequestChoice({
          exchangeId: 'ex-1',
          respondsToPresentTool: 'present_question',
          status: 'answered',
          choice: { id: 'a', label: 'Alpha', kind: 'listed' },
          comment: 'Because.',
        }),
      ),
    ).toMatchFileSnapshot('../__snapshots__/exchange-renderer-inventory-choice.md');

    await expect(
      formatRequestChoices(
        projectRequestChoices({
          exchangeId: 'ex-1',
          status: 'answered',
          choices: [{ id: 'a', label: 'Alpha*', kind: 'listed' }],
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
