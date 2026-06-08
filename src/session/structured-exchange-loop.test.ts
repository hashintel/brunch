import { describe, expect, it } from 'vitest';

import type { BrunchSessionEnvelope } from './brunch-session-envelope.js';
import { createSessionBindingData } from './session-binding.js';
import {
  acceptedResponseFromParams,
  nextDeterministicStructuredExchange,
  pendingExchangeFromEnvelope,
  type PendingStructuredExchange,
} from './structured-exchange-loop.js';

const header = { type: 'session', id: 'session-1', cwd: '/tmp/brunch-project', timestamp: 0 } as const;
const binding = createSessionBindingData({ specId: 1 });
const bindingEntry = {
  id: 'binding-1',
  type: 'custom',
  parentId: 'session-1',
  timestamp: 0,
  customType: 'brunch.session_binding',
  data: binding,
} as const;

describe('structured exchange loop helpers', () => {
  it('materializes accepted text responses as request_answer tool results', () => {
    const pending = nextDeterministicStructuredExchange(1);

    const accepted = acceptedResponseFromParams(pending, {
      exchangeId: pending.exchangeId,
      answer: { text: 'A local product specification workspace.' },
    });

    expect(accepted).toMatchObject({
      ok: true,
      answer: { text: 'A local product specification workspace.' },
      toolResultMessage: {
        role: 'toolResult',
        toolName: 'request_answer',
        content: [{ text: '### Response\n\nA local product specification workspace.' }],
        details: {
          schema: 'brunch.structured_exchange.request',
          exchange_id: pending.exchangeId,
          tool_meta: { curr: 'request_answer' },
          answered: { text: 'A local product specification workspace.' },
        },
      },
    });
  });

  it('materializes accepted single-select responses as request_choice tool results', () => {
    const pending = nextDeterministicStructuredExchange(0);

    const accepted = acceptedResponseFromParams(pending, {
      exchangeId: pending.exchangeId,
      answer: { optionId: 'new-from-scratch' },
      note: 'This is greenfield.',
    });

    expect(accepted).toMatchObject({
      ok: true,
      answer: { optionId: 'new-from-scratch', label: 'Yes — this is new from scratch' },
      toolResultMessage: {
        toolName: 'request_choice',
        content: [{ text: expect.stringContaining('> This is greenfield.') }],
        details: {
          tool_meta: { curr: 'request_choice' },
          answered: {
            comment: 'This is greenfield.',
            choice: { id: 'new-from-scratch', kind: 'listed' },
          },
        },
      },
    });
  });

  it('materializes accepted multi-select responses and requires comments for Other or None', () => {
    const pending = nextDeterministicStructuredExchange(2);

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { optionIds: ['transcript', 'other'] },
      }),
    ).toEqual({
      ok: false,
      message: 'Elicitation response requires a comment for Other or None selections',
    });

    const accepted = acceptedResponseFromParams(pending, {
      exchangeId: pending.exchangeId,
      answer: { optionIds: ['transcript', 'other'] },
      note: 'Also verify friction reporting.',
    });

    expect(accepted).toMatchObject({
      ok: true,
      answer: { optionIds: ['transcript', 'other'] },
      toolResultMessage: {
        toolName: 'request_choices',
        content: [{ text: expect.stringContaining('> Also verify friction reporting.') }],
        details: {
          tool_meta: { curr: 'request_choices' },
          answered: {
            comment: 'Also verify friction reporting.',
            choices: [{ id: 'transcript' }, { id: 'other', kind: 'other' }],
          },
        },
      },
    });
  });

  it('rejects response mode and option mismatches without materializing a tool result', () => {
    const pending = nextDeterministicStructuredExchange(0);

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { text: 'Wrong shape.' },
      }),
    ).toEqual({
      ok: false,
      message: 'Elicitation response mode does not match pending exchange',
    });
    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { optionId: 'missing-option' },
      }),
    ).toEqual({ ok: false, message: 'Invalid elicitation option' });
  });

  it('reconstructs a review-mode pending exchange from present_review_set details', () => {
    const reviewSet = {
      nodes: [{ draft_id: 'g1', plane: 'intent', kind: 'goal', title: 'Review graph proposals' }],
      edges: [],
    };
    const envelope: BrunchSessionEnvelope = {
      header: header as unknown as BrunchSessionEnvelope['header'],
      binding,
      entries: [
        header,
        bindingEntry,
        {
          id: 'present-review-set-1',
          type: 'message',
          parentId: 'binding-1',
          timestamp: 0,
          message: {
            role: 'toolResult',
            toolCallId: 'present-review-call-1',
            toolName: 'present_review_set',
            content: [{ type: 'text', text: '## Review cycle wiring\n\nReview this graph proposal.' }],
            details: {
              schema: 'brunch.structured_exchange.present',
              v: 1,
              exchange_id: 'review-cycle',
              tool_meta: { curr: 'present_review_set', next: 'request_review' },
              display: { heading: 'Review cycle wiring', body: 'Review this graph proposal.' },
              review_set: reviewSet,
            },
            isError: false,
          },
        },
      ] as unknown as BrunchSessionEnvelope['entries'],
    };

    expect(pendingExchangeFromEnvelope(envelope)).toMatchObject({
      exchangeId: 'review-cycle',
      mode: 'review',
      prompt: 'Review cycle wiring',
      reviewSet,
    });
  });

  it('materializes review decisions as request_review tool results and requires change comments', () => {
    const pending = {
      exchangeId: 'review-cycle',
      lens: 'intent',
      mode: 'review',
      prompt: 'Review cycle wiring',
      options: [],
      note: { allowed: true },
      reviewSet: {
        nodes: [{ draft_id: 'g1', plane: 'intent', kind: 'goal', title: 'Review graph proposals' }],
        edges: [],
      },
    } satisfies PendingStructuredExchange;

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'request_changes' } },
      }),
    ).toEqual({ ok: false, message: 'Review request_changes requires a comment' });

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'reject', comment: 'Not this batch.' } },
      }),
    ).toMatchObject({
      ok: true,
      answer: { review: { decision: 'reject', comment: 'Not this batch.' } },
      toolResultMessage: {
        toolName: 'request_review',
        details: {
          tool_meta: { prev: 'present_review_set', curr: 'request_review' },
          answered: { decision: 'reject', comment: 'Not this batch.' },
        },
      },
    });
  });

  it('reconstructs pending options from canonical structured present details', () => {
    const envelope: BrunchSessionEnvelope = {
      header: header as unknown as BrunchSessionEnvelope['header'],
      binding,
      entries: [
        header,
        bindingEntry,
        {
          id: 'present-options-1',
          type: 'message',
          parentId: 'binding-1',
          timestamp: 0,
          message: {
            role: 'toolResult',
            toolCallId: 'present-call-1',
            toolName: 'present_options',
            content: [
              {
                type: 'text',
                text: [
                  '## Choose proof quality',
                  '',
                  '### 1. Transcript fidelity',
                  '',
                  '**Rationale:** Pi JSONL keeps truth recoverable.',
                  '',
                  '<!-- option-id: transcript -->',
                ].join('\n'),
              },
            ],
            details: {
              schema: 'brunch.structured_exchange.present',
              v: 1,
              exchange_id: 'quality',
              tool_meta: { curr: 'present_options', next: 'request_choice' },
              display: { heading: 'Choose proof quality' },
              options: [
                {
                  id: 'transcript',
                  content: 'Transcript fidelity',
                  rationale: 'Pi JSONL keeps truth recoverable.',
                },
              ],
            },
            isError: false,
          },
        },
      ] as unknown as BrunchSessionEnvelope['entries'],
    };

    expect(pendingExchangeFromEnvelope(envelope)).toMatchObject({
      exchangeId: 'quality',
      mode: 'single-select',
      prompt: 'Choose proof quality',
      options: [
        {
          id: 'transcript',
          label: 'Transcript fidelity',
          content: 'Transcript fidelity',
          rationale: 'Pi JSONL keeps truth recoverable.',
        },
      ],
    });
  });
});
