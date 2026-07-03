import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  projectRequestAnswer,
  projectRequestChoice,
  projectRequestChoices,
  projectRequestReview,
} from '../../exchanges/projections/request-response.js';
import { parseElicitationScratchpadItem } from '../../session/elicitation-scratchpad.js';

describe('exchange capture contract proof', () => {
  it('treats answered free-text requests as answer-only capture material', async () => {
    const temptingOfferText =
      'Maybe Brunch should silently create a CAPTURE_OK receipt and persist every offered option.';
    const answerText = 'Keep capture as elicitor conduct; do not add a capture receipt.';

    const parsed = projectRequestAnswer({
      exchangeId: 'cc-01-answer-only',
      status: 'answered',
      answer: answerText,
    });

    expect('answered' in parsed).toBe(true);
    if (!('answered' in parsed)) throw new Error('expected answered request details');
    expect(parsed.answered.text).toBe(answerText);
    expect(JSON.stringify(parsed)).not.toContain(temptingOfferText);

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Answered free-text requests route only `answered.text`');
    expect(ingestGuidance).toContain(
      'The surrounding prompt or offer text is render context, not capture payload',
    );
  });

  it('treats choice echoes as render context unless selected', async () => {
    const options = [
      { id: 'commit', content: 'Commit the selected invariant.' },
      { id: 'defer', content: 'Defer every invariant until a later rewrite.' },
      { id: 'other', content: 'Other.' },
    ];

    const single = projectRequestChoice({
      exchangeId: 'cc-02-single-choice',
      respondsToPresentTool: 'present_question',
      status: 'answered',
      choice: { id: 'commit', label: 'Commit', kind: 'listed' },
      options,
      comment: 'Only the selected invariant is accepted.',
    });
    const multiple = projectRequestChoices({
      exchangeId: 'cc-02-multi-choice',
      status: 'answered',
      choices: [
        { id: 'commit', label: 'Commit', kind: 'listed' },
        { id: 'other', label: 'Other', kind: 'other' },
      ],
      options,
      comment: 'Also preserve the follow-up constraint.',
    });

    expect('answered' in single).toBe(true);
    if (!('answered' in single)) throw new Error('expected answered request_choice details');
    expect(single.answered.choice.id).toBe('commit');
    expect(single.answered.options.map((option) => option.id)).toContain('defer');

    expect('answered' in multiple).toBe(true);
    if (!('answered' in multiple)) throw new Error('expected answered request_choices details');
    expect(multiple.answered.choices.map((choice) => choice.id)).toEqual(['commit', 'other']);
    expect(multiple.answered.options.map((option) => option.id)).toContain('defer');

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Answered choice requests route only selected `choice`/`choices`');
    expect(ingestGuidance).toContain('Non-selected `answered.options` entries are option echo for rendering');
  });

  it('demotes cancelled ordinary requests to open scratchpad obligations without answer payload', async () => {
    const cancelledAnswer = projectRequestAnswer({ exchangeId: 'cc-03-answer-cancel', status: 'cancelled' });
    const cancelledChoice = projectRequestChoice({
      exchangeId: 'cc-03-choice-cancel',
      respondsToPresentTool: 'present_question',
      status: 'cancelled',
    });
    const cancelledChoices = projectRequestChoices({
      exchangeId: 'cc-03-choices-cancel',
      status: 'cancelled',
    });

    for (const cancelled of [cancelledAnswer, cancelledChoice, cancelledChoices]) {
      expect('cancelled' in cancelled).toBe(true);
      expect('answered' in cancelled).toBe(false);
    }

    expect(
      parseElicitationScratchpadItem({
        id: 'unanswered-ask',
        obligation: 'Re-ask whether the capture contract needs a receipt.',
        disposition: 'open',
      }),
    ).toMatchObject({ disposition: 'open' });
    expect(
      parseElicitationScratchpadItem({
        id: 'bad-disposition',
        obligation: 'Do not encode cancellation as a scratchpad disposition.',
        disposition: 'cancelled',
      }),
    ).toBeUndefined();

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain(
      'Cancelled ordinary requests carry no answer, choice, option, or offer payload',
    );
    expect(ingestGuidance).toContain('record an `open` scratchpad obligation');
  });

  it('treats unavailable ordinary requests as missing response rather than refusal or content', async () => {
    const unavailable = [
      projectRequestAnswer({
        exchangeId: 'cc-04-answer-unavailable',
        status: 'unavailable',
        message: 'request_answer requires interactive UI',
      }),
      projectRequestChoice({
        exchangeId: 'cc-04-choice-unavailable',
        respondsToPresentTool: 'present_question',
        status: 'unavailable',
        message: 'request_choice unavailable',
      }),
      projectRequestChoices({
        exchangeId: 'cc-04-choices-unavailable',
        status: 'unavailable',
        message: 'request_choices unavailable',
      }),
    ];

    for (const details of unavailable) {
      expect('unavailable' in details).toBe(true);
      expect('answered' in details).toBe(false);
      if (!('unavailable' in details)) throw new Error('expected unavailable request details');
      expect(details.unavailable.message.length).toBeGreaterThan(0);
    }

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Unavailable ordinary requests carry no response payload');
    expect(ingestGuidance).toContain('Do not read unavailability as user refusal or accepted content');
  });

  it('treats review request_changes as comment-only feedback without proposal capture', async () => {
    const details = projectRequestReview({
      exchangeId: 'cc-06-request-changes',
      status: 'answered',
      review: 'request_changes',
      comment: 'Keep the interface, but regenerate the persistence wording.',
    });

    expect('answered' in details).toBe(true);
    if (!('answered' in details)) throw new Error('expected answered request_review details');
    expect(details.answered).toEqual({
      decision: 'request_changes',
      comment: 'Keep the interface, but regenerate the persistence wording.',
    });
    expect(JSON.stringify(details)).not.toContain('createdNodes');
    expect(JSON.stringify(details)).not.toContain('entityDrafts');

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Review `request_changes` captures the comment as direct user material');
    expect(ingestGuidance).toContain('Do not capture the prior proposal payload');
  });

  it('treats review reject as a dead offer with no scratchpad obligation', async () => {
    const details = projectRequestReview({
      exchangeId: 'cc-07-reject',
      status: 'answered',
      review: 'reject',
      comment: 'This is the wrong direction.',
    });

    expect('answered' in details).toBe(true);
    if (!('answered' in details)) throw new Error('expected answered request_review details');
    expect(details.answered.decision).toBe('reject');
    expect(JSON.stringify(details)).not.toContain('entityDrafts');
    expect(JSON.stringify(details)).not.toContain('scratchpad');

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Review `reject` kills the offer');
    expect(ingestGuidance).toContain('Do not demote the rejected proposal into a scratchpad obligation');
  });

  it('treats cancelled proposal-chain reviews as no offer payload with optional unresolved intent', async () => {
    const details = projectRequestReview({
      exchangeId: 'cc-08-cancelled-review',
      status: 'cancelled',
      message: 'User cancelled review.',
    });

    expect('cancelled' in details).toBe(true);
    expect('answered' in details).toBe(false);
    expect(JSON.stringify(details)).not.toContain('entityDrafts');
    expect(JSON.stringify(details)).not.toContain('createdNodes');

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Cancelled proposal-chain reviews carry no offer payload');
    expect(ingestGuidance).toContain('Only unresolved intent may become an `open` scratchpad obligation');
  });
});
