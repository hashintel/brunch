import { describe, expect, it } from 'vitest';
import * as z from 'zod';

import {
  zRequestAnswerDetails,
  zRequestChoiceDetails,
  zRequestChoicesDetails,
  zRequestDetails,
  zRequestReviewDetails,
} from '../index.js';

function expectJsonSchemaExport(schema: z.ZodType) {
  expect(() => z.toJSONSchema(schema, { unrepresentable: 'throw' })).not.toThrow();
}

describe('structured exchange request schemas', () => {
  const answerBase = {
    schema: 'brunch.structured_exchange.request',
    v: 1,
    exchange_id: 'problem-frame',
    tool_meta: {
      prev: 'present_question',
      curr: 'request_answer',
      next: 'capture_answer',
    },
  };

  it('parses answered, cancelled, and unavailable outcomes', () => {
    expect(
      zRequestAnswerDetails.parse({
        ...answerBase,
        answered: {
          text: 'The hard part is coherence across sessions.',
        },
      }),
    ).toMatchObject({
      answered: { text: 'The hard part is coherence across sessions.' },
    });

    expect(
      zRequestAnswerDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'problem-frame',
        tool_meta: { prev: 'present_question', curr: 'request_answer' },
        cancelled: { message: 'User cancelled.' },
      }),
    ).toMatchObject({ cancelled: { message: 'User cancelled.' } });

    expect(
      zRequestAnswerDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'problem-frame',
        tool_meta: { prev: 'present_question', curr: 'request_answer' },
        unavailable: { message: 'request_answer requires interactive UI.' },
      }),
    ).toMatchObject({
      unavailable: { message: 'request_answer requires interactive UI.' },
    });
  });

  it('rejects empty free-text answers', () => {
    expect(() =>
      zRequestAnswerDetails.parse({
        ...answerBase,
        answered: { text: '   ' },
      }),
    ).toThrow(/answer text cannot be empty/);
  });

  it('rejects missing or multiple terminal outcomes', () => {
    expect(() => zRequestAnswerDetails.parse(answerBase)).toThrow();
    expect(() =>
      zRequestAnswerDetails.parse({
        ...answerBase,
        answered: { text: 'Yes.' },
        cancelled: { message: 'User cancelled.' },
      }),
    ).toThrow();
  });

  it('keeps comment on answered payloads and message on terminal runtime payloads', () => {
    expect(
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain-shape',
        tool_meta: {
          prev: 'present_question',
          curr: 'request_choice',
          next: 'capture_choice',
        },
        answered: {
          choice: {
            id: 'local-first',
            label: 'Local-first app',
            kind: 'listed',
          },
          options: [{ id: 'local-first', content: 'Local-first app' }],
          comment: 'This fits the POC constraints.',
        },
      }),
    ).toMatchObject({ answered: { comment: 'This fits the POC constraints.' } });

    expect(() =>
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain-shape',
        tool_meta: { prev: 'present_question', curr: 'request_choice' },
        cancelled: { message: 'User cancelled.' },
        comment: 'human text in the wrong place',
      }),
    ).toThrow();

    expect(() =>
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain-shape',
        tool_meta: { prev: 'present_question', curr: 'request_choice' },
        answered: {
          choice: {
            id: 'local-first',
            label: 'Local-first app',
            kind: 'listed',
          },
          options: [{ id: 'local-first', content: 'Local-first app' }],
          message: 'runtime text in the wrong place',
        },
      }),
    ).toThrow();
  });

  it('rejects blank answered option echo content', () => {
    for (const content of ['', '   ', '\n\t']) {
      expect(() =>
        zRequestChoiceDetails.parse({
          schema: 'brunch.structured_exchange.request',
          v: 1,
          exchange_id: 'domain-shape',
          tool_meta: { prev: 'present_question', curr: 'request_choice', next: 'capture_choice' },
          answered: {
            choice: { id: 'local-first', label: 'Local-first app', kind: 'listed' },
            options: [{ id: 'local-first', content }],
          },
        }),
      ).toThrow(/cannot be empty/);
    }
  });

  it('supports candidate choices and requires comments for other or none choices', () => {
    expect(
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'candidate-direction',
        tool_meta: {
          prev: 'present_candidates',
          curr: 'request_choice',
          next: 'capture_candidate',
        },
        answered: {
          choice: {
            id: 'candidate-local-workbench',
            label: 'Local workbench for graph-native specs',
            kind: 'listed',
          },
          options: [{ id: 'candidate-local-workbench', content: 'Local workbench for graph-native specs' }],
        },
      }),
    ).toMatchObject({ tool_meta: { prev: 'present_candidates' } });

    expect(
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain-shape-other',
        tool_meta: {
          prev: 'present_question',
          curr: 'request_choice',
          next: 'capture_choice',
        },
        answered: {
          choice: { id: 'other', label: 'Something else entirely', kind: 'other' },
          options: [{ id: 'local-first', content: 'Local-first app' }],
          comment: 'The intended option is not listed.',
        },
      }),
    ).toMatchObject({ answered: { choice: { kind: 'other' } } });

    expect(() =>
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain-shape',
        tool_meta: { prev: 'present_question', curr: 'request_choice' },
        answered: {
          choice: { id: 'none', label: 'None of these', kind: 'none' },
          options: [{ id: 'local-first', content: 'Local-first app' }],
        },
      }),
    ).toThrow();
    expect(() =>
      zRequestChoiceDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'domain-shape-other',
        tool_meta: { prev: 'present_question', curr: 'request_choice' },
        answered: {
          choice: { id: 'other', label: 'Something else entirely', kind: 'other' },
          options: [{ id: 'local-first', content: 'Local-first app' }],
        },
      }),
    ).toThrow();
  });

  it('parses multiple choices and requires comments for other or none selections', () => {
    expect(
      zRequestChoicesDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'open-risks',
        tool_meta: {
          prev: 'present_question',
          curr: 'request_choices',
          next: 'capture_choices',
        },
        answered: {
          choices: [
            { id: 'transport', label: 'Transport contract', kind: 'listed' },
            {
              id: 'other',
              label: 'Schema source-of-truth drift',
              kind: 'other',
            },
          ],
          options: [
            { id: 'transport', content: 'Transport contract' },
            { id: 'ux', content: 'User experience' },
          ],
          comment: 'Keep schema drift visible.',
        },
      }),
    ).toMatchObject({
      answered: { choices: [{ id: 'transport' }, { id: 'other' }] },
    });

    expect(() =>
      zRequestChoicesDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'open-risks',
        tool_meta: { prev: 'present_question', curr: 'request_choices' },
        answered: {
          choices: [{ id: 'none', label: 'None of these', kind: 'none' }],
          options: [{ id: 'transport', content: 'Transport contract' }],
        },
      }),
    ).toThrow();
  });

  it('parses digest review terminals with accepted abstract echo and no next on non-answered outcomes', () => {
    expect(
      zRequestReviewDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'digest-large-source',
        tool_meta: {
          prev: 'present_digest',
          curr: 'request_review',
          next: 'capture_review',
        },
        answered: {
          decision: 'approve',
          accepted_abstract: 'The accepted abstract is the sweep-visible digest carrier.',
        },
      }),
    ).toMatchObject({ answered: { accepted_abstract: expect.stringContaining('sweep-visible') } });

    expect(() =>
      zRequestReviewDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'digest-large-source',
        tool_meta: { prev: 'present_digest', curr: 'request_review', next: 'capture_review' },
        cancelled: { message: 'User cancelled.' },
      }),
    ).toThrow();

    expect(
      zRequestReviewDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'digest-large-source',
        tool_meta: { prev: 'present_digest', curr: 'request_review' },
        unavailable: { message: 'request_response review requires interactive UI.' },
      }),
    ).toMatchObject({ unavailable: { message: expect.stringContaining('interactive UI') } });
  });

  it('rejects blank accepted digest abstract echoes', () => {
    for (const accepted_abstract of ['', '   ', '\n\t']) {
      expect(() =>
        zRequestReviewDetails.parse({
          schema: 'brunch.structured_exchange.request',
          v: 1,
          exchange_id: 'digest-large-source',
          tool_meta: {
            prev: 'present_digest',
            curr: 'request_review',
            next: 'capture_review',
          },
          answered: {
            decision: 'approve',
            accepted_abstract,
          },
        }),
      ).toThrow(/cannot be empty/);
    }
  });

  it('rejects none combined with other selections', () => {
    expect(() =>
      zRequestChoicesDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'open-risks',
        tool_meta: { prev: 'present_question', curr: 'request_choices' },
        answered: {
          choices: [
            { id: 'transport', label: 'Transport contract', kind: 'listed' },
            { id: 'none', label: 'None', kind: 'none' },
          ],
          options: [{ id: 'transport', content: 'Transport contract' }],
          comment: 'Contradictory selection.',
        },
      }),
    ).toThrow(/none cannot be combined/);
  });

  it('requires a comment for request_changes review decisions', () => {
    expect(
      zRequestReviewDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'review-set-17',
        tool_meta: {
          prev: 'present_review_set',
          curr: 'request_review',
          next: 'capture_review',
        },
        answered: {
          decision: 'approve',
          comment: 'This is ready to commit.',
        },
      }),
    ).toMatchObject({ answered: { decision: 'approve' } });

    expect(() =>
      zRequestReviewDetails.parse({
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: 'review-set-17',
        tool_meta: { prev: 'present_review_set', curr: 'request_review' },
        answered: { decision: 'request_changes' },
      }),
    ).toThrow();
  });

  it('exports request schemas to JSON Schema', () => {
    expectJsonSchemaExport(zRequestAnswerDetails);
    expectJsonSchemaExport(zRequestChoiceDetails);
    expectJsonSchemaExport(zRequestChoicesDetails);
    expectJsonSchemaExport(zRequestReviewDetails);
    expectJsonSchemaExport(zRequestDetails);
  });
});
