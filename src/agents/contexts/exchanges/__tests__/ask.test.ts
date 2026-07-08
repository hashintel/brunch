import { describe, expect, it } from 'vitest';

import { askQuestionEcho, projectAsk } from '../../../../exchanges/projections/ask.js';
import { zAskDetails } from '../../../../exchanges/schemas/index.js';
import { ASK_CONTENT_ELISIONS, formatAsk } from '../ask.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';

const OPTIONS = [
  { id: 'thin-vertical', label: 'Thin vertical proof', description: 'Proves the seam first.' },
  { id: 'renderer-sweep', label: 'Renderer sweep', description: 'Closes the family after the head slice.' },
] as const;

const freeTextDetails = projectAsk({
  exchangeId: 'ask-free-text',
  question: askQuestionEcho({
    body: 'This is a **free-text** question. No options.\n\nWhat problem are we solving?',
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
  { name: 'ask cancelled', details: cancelledDetails },
  { name: 'ask unavailable', details: unavailableDetails },
] as const;

describe('ask formatter', () => {
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
