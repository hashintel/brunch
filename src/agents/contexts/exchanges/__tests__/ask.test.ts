import { describe, expect, it } from 'vitest';

import { askQuestionEcho, projectAsk } from '../../../../exchanges/projections/ask.js';
import { zAskDetails } from '../../../../exchanges/schemas/index.js';
import { ASK_CONTENT_ELISIONS, formatAsk } from '../ask.js';
import { CANCELLED_TERMINAL } from '../option-echo.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';

const OPTIONS = [
  { id: 'thin-vertical', label: 'Thin vertical proof', description: 'Proves the seam first.' },
  { id: 'renderer-sweep', label: 'Renderer sweep', description: 'Closes the family after the head slice.' },
] as const;

const freeTextDetails = projectAsk({
  exchangeId: 'ask-free-text',
  question: askQuestionEcho({
    body: 'This is a **free-text** question. No options.\n\nWhat problem are we solving?',
    commentPrompt: 'Anything else the record should remember?',
  }),
  status: 'answered',
  answer: 'A graph-native spec workspace over the Pi harness.',
  comment: 'The comment arrived through commentPrompt.',
});

const singleChoiceDetails = projectAsk({
  exchangeId: 'ask-single-choice',
  question: askQuestionEcho({ body: 'Which direction should the next slice take?', options: [...OPTIONS] }),
  status: 'answered',
  choice: { id: 'renderer-sweep', label: 'Renderer sweep', kind: 'listed' },
  options: [...OPTIONS],
  comment: 'This closes the formatter family.',
});

const multiChoiceDetails = projectAsk({
  exchangeId: 'ask-multi-choice',
  question: askQuestionEcho({
    body: 'Select all priorities.',
    options: [...OPTIONS],
    multiple: true,
  }),
  status: 'answered',
  choices: [{ id: 'thin-vertical', label: 'Thin vertical proof', kind: 'listed' }],
  options: [...OPTIONS],
  comment: 'Start thin, then widen.',
});

const otherChoiceDetails = projectAsk({
  exchangeId: 'ask-other-choice',
  question: askQuestionEcho({
    body: 'Which direction should the next slice take?',
    options: [...OPTIONS, { id: 'other', label: 'Other' }],
    allowOther: true,
    commentPrompt: 'Why is this better than the listed choices?',
  }),
  status: 'answered',
  choice: { id: 'other', label: 'Do the schema echo first, then the formatter.', kind: 'other' },
  options: [...OPTIONS, { id: 'other', label: 'Other' }],
  comment: 'The listed choices did not name the comment framing problem.',
});

const cancelledDetails = projectAsk({
  exchangeId: 'ask-cancelled',
  question: askQuestionEcho({ body: 'Cancel me.' }),
  status: 'cancelled',
  message: 'User pressed escape.',
});

const unavailableDetails = projectAsk({
  exchangeId: 'ask-unavailable',
  question: askQuestionEcho({ body: 'No UI here.' }),
  status: 'unavailable',
  message: 'ask requires interactive UI',
});

const branchMatrix = [
  { name: 'ask answered — free text', details: freeTextDetails },
  { name: 'ask answered — single choice', details: singleChoiceDetails },
  { name: 'ask answered — multi choice', details: multiChoiceDetails },
  { name: 'ask answered — Other choice', details: otherChoiceDetails },
  { name: 'ask cancelled', details: cancelledDetails },
  { name: 'ask unavailable', details: unavailableDetails },
] as const;

describe('ask formatter', () => {
  it('omits empty question option arrays so echoes satisfy their schema', () => {
    const details = projectAsk({
      exchangeId: 'empty-options',
      status: 'answered',
      question: askQuestionEcho({ body: 'Name the next move.', options: [] }),
      answer: 'Keep it narrow.',
    });

    expect(details.question).toEqual({ body: 'Name the next move.' });
    expect(() => zAskDetails.parse(details)).not.toThrow();
  });

  it('carries comment and Other framing through the question echo', () => {
    expect(freeTextDetails.question).toMatchObject({
      commentPrompt: 'Anything else the record should remember?',
    });
    expect(otherChoiceDetails.question).toMatchObject({
      commentPrompt: 'Why is this better than the listed choices?',
      otherPrompt: 'Describe your answer',
    });
    expect(formatAsk(freeTextDetails)).toContain(
      '**Comment prompt:** Anything else the record should remember?',
    );
    expect(formatAsk(otherChoiceDetails)).toContain('**Other prompt:** Describe your answer');
  });

  it('renders cancellation as a labeled, self-describing next-turn signal', () => {
    expect(formatAsk(cancelledDetails).split('\n\n').at(-1)).toBe(CANCELLED_TERMINAL);
    expect(formatAsk(cancelledDetails)).not.toMatch(/\n_[^\n]+_$/u);
  });

  it('produces schema-valid details for every projected ask outcome branch', () => {
    for (const { details } of branchMatrix) {
      expect(() => zAskDetails.parse(details)).not.toThrow();
    }
  });

  it('declares every ask details leaf as rendered or intentionally elided, per outcome branch', () => {
    for (const { name, details } of branchMatrix) {
      expect(
        missingRenderedDetailsLeaves(details, formatAsk(details), { elisions: ASK_CONTENT_ELISIONS }),
        name,
      ).toEqual([]);
    }
  });

  it('locks transcript-shaped ask tuples across outcome branches', async () => {
    const markdown = branchMatrix
      .map(({ name, details }) => `# ${name}\n\n${formatAsk(details)}`)
      .join('\n\n---\n\n');

    await expect(markdown).toMatchFileSnapshot('../__snapshots__/ask-tuples.md');
  });
});
