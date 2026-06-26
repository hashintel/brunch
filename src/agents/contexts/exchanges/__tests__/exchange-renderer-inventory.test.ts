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
  it('covers the request/present result renderers not snapshot-locked elsewhere', () => {
    expect(
      formatPresentQuestion(
        projectPresentQuestion({
          exchangeId: 'ex-1',
          heading: 'Choose a direction',
          body: 'Pick one option.',
          options: [{ id: 'a', content: 'Alpha', rationale: 'Fastest path.' }],
        }),
      ),
    ).toContain('## 1. Alpha');

    expect(
      formatRequestAnswer(
        projectRequestAnswer({ exchangeId: 'ex-1', status: 'answered', answer: 'Freeform answer' }),
      ),
    ).toContain('Freeform answer');
    expect(
      formatRequestChoice(
        projectRequestChoice({
          exchangeId: 'ex-1',
          respondsToPresentTool: 'present_question',
          status: 'answered',
          choice: { id: 'a', label: 'Alpha', kind: 'listed' },
          comment: 'Because.',
        }),
      ),
    ).toContain('Selected: **Alpha**');
    expect(
      formatRequestChoices(
        projectRequestChoices({
          exchangeId: 'ex-1',
          status: 'answered',
          choices: [{ id: 'a', label: 'Alpha*', kind: 'listed' }],
          comment: 'Both.',
        }),
      ),
    ).toContain('Alpha\\*');
    expect(formatRequestResponseDiagnostic({ message: 'Waiting for a structured response.' })).toContain(
      'Waiting for a structured response.',
    );
    expect(
      formatRequestReview(
        projectRequestReview({
          exchangeId: 'ex-1',
          status: 'answered',
          review: 'request_changes',
          comment: 'Tighten scope.',
        }),
      ),
    ).toContain('Changes requested');
  });

  it('keeps unavailable/cancelled branches model-facing and explicit', () => {
    expect(formatRequestAnswer(projectRequestAnswer({ exchangeId: 'ex-1', status: 'cancelled' }))).toContain(
      'User cancelled',
    );
    expect(
      formatRequestChoice(
        projectRequestChoice({
          exchangeId: 'ex-1',
          respondsToPresentTool: 'present_question',
          status: 'unavailable',
          message: 'choice unavailable',
        }),
      ),
    ).toContain('choice unavailable');
    expect(
      formatRequestChoices(
        projectRequestChoices({
          exchangeId: 'ex-1',
          status: 'unavailable',
          message: 'choices unavailable',
        }),
      ),
    ).toContain('choices unavailable');
    expect(formatRequestReview(projectRequestReview({ exchangeId: 'ex-1', status: 'cancelled' }))).toContain(
      'User cancelled',
    );
  });
});
