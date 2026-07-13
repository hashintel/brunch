import { describe, expect, it } from 'vitest';

import {
  projectRequestAnswer,
  projectRequestChoice,
  projectRequestChoices,
  projectRequestReview,
} from '../../../../exchanges/projections/request-response.js';
import { CANCELLED_TERMINAL } from '../option-echo.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';
import {
  formatRequestAnswer,
  formatRequestChoice,
  formatRequestChoices,
  formatRequestReview,
  REQUEST_ANSWER_CONTENT_ELISIONS,
  REQUEST_CHOICE_CONTENT_ELISIONS,
  REQUEST_CHOICES_CONTENT_ELISIONS,
  REQUEST_REVIEW_CONTENT_ELISIONS,
} from '../request-response.js';

describe('request response formatters', () => {
  it('renders every cancellation as the canonical self-describing next-turn signal', () => {
    expect(
      formatRequestAnswer(projectRequestAnswer({ exchangeId: 'answer-cancelled', status: 'cancelled' })),
    ).toBe(CANCELLED_TERMINAL);
    expect(
      formatRequestChoice(
        projectRequestChoice({
          exchangeId: 'choice-cancelled',
          respondsToPresentTool: 'present_question',
          status: 'cancelled',
        }),
      ),
    ).toBe(CANCELLED_TERMINAL);
    expect(
      formatRequestChoices(projectRequestChoices({ exchangeId: 'choices-cancelled', status: 'cancelled' })),
    ).toBe(CANCELLED_TERMINAL);
    expect(
      formatRequestReview(
        projectRequestReview({
          exchangeId: 'review-cancelled',
          respondsToPresentTool: 'present_review_set',
          status: 'cancelled',
        }),
      ),
    ).toBe(CANCELLED_TERMINAL);
  });

  it('declares every request_answer details leaf as rendered or intentionally elided', () => {
    const details = projectRequestAnswer({
      exchangeId: 'answer-honesty',
      status: 'answered',
      answer: 'Use the structured exchange formatter as the public transcript surface.',
    });

    expect(
      missingRenderedDetailsLeaves(details, formatRequestAnswer(details), {
        elisions: REQUEST_ANSWER_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });

  it('declares every request_choice details leaf as rendered, represented, or intentionally elided', () => {
    const details = projectRequestChoice({
      exchangeId: 'choice-honesty',
      respondsToPresentTool: 'present_question',
      status: 'answered',
      choice: { id: 'preview', label: 'Preview parity', kind: 'listed' },
      options: [
        { id: 'preview', content: 'Preview parity', rationale: 'Keeps the gallery honest.' },
        { id: 'minimal', content: 'Minimal proof', rationale: 'Smaller but less visible.' },
      ],
      comment: 'The preview catches visual drift.',
    });

    expect(
      missingRenderedDetailsLeaves(details, formatRequestChoice(details), {
        elisions: REQUEST_CHOICE_CONTENT_ELISIONS,
        representations: {
          'answered.choice.label': ['__Preview parity__'],
          'answered.options.*.content': ['__Preview parity__', '__Minimal proof__'],
        },
      }),
    ).toEqual([]);
  });

  it('declares every request_choices details leaf as rendered, represented, or intentionally elided', () => {
    const details = projectRequestChoices({
      exchangeId: 'choices-honesty',
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

    expect(
      missingRenderedDetailsLeaves(details, formatRequestChoices(details), {
        elisions: REQUEST_CHOICES_CONTENT_ELISIONS,
        representations: {
          'answered.choices.*.label': ['__Add coverage__', '*Other:* Also run the preview'],
          'answered.options.*.content': ['__Add coverage__', '__Update docs__'],
        },
      }),
    ).toEqual([]);
  });

  it('declares every request_review details leaf as rendered, represented, or intentionally elided', () => {
    const details = projectRequestReview({
      exchangeId: 'review-honesty',
      status: 'answered',
      review: 'request_changes',
      respondsToPresentTool: 'present_review_set',
      comment: 'Name the outer oracle before closing the frontier.',
    });

    expect(
      missingRenderedDetailsLeaves(details, formatRequestReview(details), {
        elisions: REQUEST_REVIEW_CONTENT_ELISIONS,
        representations: {
          'answered.decision': ['changes requested'],
        },
      }),
    ).toEqual([]);
  });
});
