import { describe, expect, it } from 'vitest';

import { projectPresentDigest } from '../../exchanges/projections/present-digest.js';
import { nextDeterministicStructuredExchange } from '../../probes/deterministic-exchange-script.js';
import type { BrunchSessionEnvelope } from '../brunch-session-envelope.js';
import { createSessionBindingData } from '../session-binding.js';
import {
  acceptedResponseFromParams,
  pendingExchangeFromEnvelope,
  syntheticExchangeToolCallMessage,
  type PendingStructuredExchange,
} from '../structured-exchange-loop.js';

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
  it('defaults synthetic ask replay to neutral exchange correlation', () => {
    expect(syntheticExchangeToolCallMessage('ask-standalone', 'ask').content[0].arguments).toEqual({
      exchangeId: 'ask-standalone',
    });
    expect(
      syntheticExchangeToolCallMessage('offer-continuation', 'ask', { continues: 'offer-continuation' })
        .content[0].arguments,
    ).toEqual({ continues: 'offer-continuation' });
  });

  it('rejects empty text responses without materializing a tool result', () => {
    const pending = nextDeterministicStructuredExchange(1);

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { text: '   ' },
      }),
    ).toEqual({ ok: false, message: 'Elicitation response requires answer text' });
  });

  it('materializes accepted text responses as ask tool results', () => {
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
        toolName: 'ask',
        content: [{ text: '## Answer\n\nA local product specification workspace.' }],
        details: {
          schema: 'brunch.structured_exchange.request',
          exchange_id: pending.exchangeId,
          tool_meta: { curr: 'request_answer' },
          answered: { text: 'A local product specification workspace.' },
        },
      },
    });
  });

  it('materializes accepted single-select responses as ask tool results', () => {
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
        toolName: 'ask',
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

  it('rejects single-select Other or None without a comment', () => {
    const pending = {
      ...nextDeterministicStructuredExchange(0),
      options: [
        { id: 'listed', label: 'Listed option', content: 'Listed option' },
        { id: 'none', label: 'None of these', content: 'None of these' },
      ],
    } satisfies PendingStructuredExchange;

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { optionId: 'none' },
      }),
    ).toEqual({
      ok: false,
      message: 'Elicitation response requires a comment for Other or None selections',
    });
  });

  it('materializes accepted multi-select responses and requires comments for Other or None', () => {
    const pending = nextDeterministicStructuredExchange(2);

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { optionIds: [] },
      }),
    ).toEqual({
      ok: false,
      message: 'Elicitation response requires at least one selected option',
    });

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
        toolName: 'ask',
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

  it('rejects multi-select None combined with other selections', () => {
    const pending = {
      ...nextDeterministicStructuredExchange(2),
      options: [
        { id: 'listed', label: 'Listed option', content: 'Listed option' },
        { id: 'none', label: 'None of these', content: 'None of these' },
      ],
    } satisfies PendingStructuredExchange;

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: pending.exchangeId,
        answer: { optionIds: ['listed', 'none'] },
        note: 'Contradictory selection.',
      }),
    ).toEqual({
      ok: false,
      message: 'Elicitation response cannot combine None with other selections',
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
      nodes: [
        {
          draft_id: 'g1',
          proposed_code: 'G1',
          plane: 'intent',
          kind: 'goal',
          title: 'Review graph proposals',
        },
      ],
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
            content: [{ type: 'text', text: '# Review cycle wiring\n\nReview this graph proposal.' }],
            details: {
              schema: 'brunch.structured_exchange.present',
              v: 1,
              exchange_id: 'review-cycle',
              tool_meta: { curr: 'present_review_set', next: 'ask' },
              display: { heading: 'Review cycle wiring', body: 'Review this graph proposal.' },
              continuation: {
                tool: 'ask',
                params: {
                  body: 'Review cycle wiring\n\nReview this graph proposal.',
                  options: [
                    { id: 'approve', label: 'Approve' },
                    { id: 'request_changes', label: 'Request changes' },
                    { id: 'reject', label: 'Reject' },
                  ],
                  commentPrompt: 'Required change request',
                },
              },
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

  it('reconstructs a review-mode pending exchange from present_digest details', () => {
    const envelope: BrunchSessionEnvelope = {
      header: header as unknown as BrunchSessionEnvelope['header'],
      binding,
      entries: [
        header,
        bindingEntry,
        {
          id: 'present-digest-1',
          type: 'message',
          parentId: 'binding-1',
          timestamp: 0,
          message: {
            role: 'toolResult',
            toolCallId: 'present-digest-call-1',
            toolName: 'present_digest',
            content: [{ type: 'text', text: '# Review source digest\n\nApprove before mapping.' }],
            details: projectPresentDigest({
              exchangeId: 'digest-cycle',
              heading: 'Review source digest',
              body: 'Approve before mapping.',
              digest: { abstract: 'The source asks for advisory capture before settlement.' },
            }).details,
            isError: false,
          },
        },
      ] as unknown as BrunchSessionEnvelope['entries'],
    };

    expect(pendingExchangeFromEnvelope(envelope)).toMatchObject({
      exchangeId: 'digest-cycle',
      mode: 'review',
      prompt: 'Review source digest',
      respondsToPresentTool: 'present_digest',
      digestAbstract: 'The source asks for advisory capture before settlement.',
      options: expect.arrayContaining([{ id: 'approve', label: 'Approve', content: 'Approve' }]),
    });
  });

  it('does not reconstruct a pending digest exchange from a blank abstract carrier', () => {
    const details = projectPresentDigest({
      exchangeId: 'digest-cycle',
      heading: 'Review source digest',
      body: 'Approve before mapping.',
      digest: { abstract: 'The source asks for advisory capture before settlement.' },
    }).details;
    const envelope: BrunchSessionEnvelope = {
      header: header as unknown as BrunchSessionEnvelope['header'],
      binding,
      entries: [
        header,
        bindingEntry,
        {
          id: 'present-digest-1',
          type: 'message',
          parentId: 'binding-1',
          timestamp: 0,
          message: {
            role: 'toolResult',
            toolCallId: 'present-digest-call-1',
            toolName: 'present_digest',
            content: [{ type: 'text', text: '# Review source digest\n\nApprove before mapping.' }],
            details: { ...details, digest: { ...details.digest, abstract: '   ' } },
            isError: false,
          },
        },
      ] as unknown as BrunchSessionEnvelope['entries'],
    };

    expect(pendingExchangeFromEnvelope(envelope)).toBeNull();
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
        nodes: [
          {
            draft_id: 'g1',
            proposed_code: 'G1',
            plane: 'intent',
            kind: 'goal',
            title: 'Review graph proposals',
          },
        ],
        edges: [],
      },
    } satisfies PendingStructuredExchange;

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'request_changes' } },
      }),
    ).toEqual({ ok: false, message: 'Review request_changes requires a comment' });

    expect(() =>
      acceptedResponseFromParams(pending, {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'request_changes', comment: '   ' } },
      }),
    ).not.toThrow();
    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: 'review-cycle',
        answer: { review: { decision: 'request_changes', comment: '   ' } },
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
        toolName: 'ask',
        details: {
          tool_meta: { prev: 'present_review_set', curr: 'request_review' },
          answered: { decision: 'reject', comment: 'Not this batch.' },
        },
      },
    });
  });

  it('materializes digest approval with an accepted abstract echo', () => {
    const pending = {
      exchangeId: 'digest-cycle',
      lens: 'intent',
      mode: 'review',
      prompt: 'Review source digest',
      options: [],
      note: { allowed: true },
      respondsToPresentTool: 'present_digest',
      digestAbstract: 'The accepted abstract is self-contained terminal evidence.',
    } satisfies PendingStructuredExchange;

    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: 'digest-cycle',
        answer: { review: { decision: 'request_changes' } },
      }),
    ).toEqual({ ok: false, message: 'Review request_changes requires a comment' });

    expect(() =>
      acceptedResponseFromParams(pending, {
        exchangeId: 'digest-cycle',
        answer: { review: { decision: 'request_changes', comment: '   ' } },
      }),
    ).not.toThrow();
    expect(
      acceptedResponseFromParams(pending, {
        exchangeId: 'digest-cycle',
        answer: { review: { decision: 'request_changes', comment: '   ' } },
      }),
    ).toEqual({ ok: false, message: 'Review request_changes requires a comment' });

    const accepted = acceptedResponseFromParams(pending, {
      exchangeId: 'digest-cycle',
      answer: { review: { decision: 'approve' } },
    });

    expect(accepted).toMatchObject({
      ok: true,
      toolResultMessage: {
        toolName: 'ask',
        details: {
          tool_meta: { prev: 'present_digest', curr: 'request_review' },
          answered: {
            decision: 'approve',
            accepted_abstract: 'The accepted abstract is self-contained terminal evidence.',
          },
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
            toolName: 'present_question',
            content: [
              {
                type: 'text',
                text: [
                  '# Choose proof quality',
                  '',
                  '## 1. Transcript fidelity',
                  '',
                  '**Rationale:** Pi JSONL keeps truth recoverable.',
                ].join('\n'),
              },
            ],
            details: {
              schema: 'brunch.structured_exchange.present',
              v: 1,
              exchange_id: 'quality',
              tool_meta: { curr: 'present_question', next: 'request_response' },
              response_kind: 'choice',
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

  it('round-trips present_candidates provenance so answers capture as candidates', () => {
    const envelope: BrunchSessionEnvelope = {
      header: header as unknown as BrunchSessionEnvelope['header'],
      binding,
      entries: [
        header,
        bindingEntry,
        {
          id: 'present-candidates-1',
          type: 'message',
          parentId: 'binding-1',
          timestamp: 0,
          message: {
            role: 'toolResult',
            toolCallId: 'present-call-1',
            toolName: 'present_candidates',
            content: [
              {
                type: 'text',
                text: ['# Pick a candidate', '', '## 1. Candidate A'].join('\n'),
              },
            ],
            details: {
              schema: 'brunch.structured_exchange.present',
              v: 1,
              exchange_id: 'cand',
              tool_meta: { curr: 'present_candidates', next: 'ask' },
              display: { heading: 'Pick a candidate' },
              continuation: {
                tool: 'ask',
                params: {
                  body: 'Pick a candidate',
                  options: [{ id: 'cand-a', label: 'Candidate A', description: 'try A' }],
                },
              },
              candidates: [
                {
                  id: 'cand-a',
                  title: 'Candidate A',
                  user_rubric: {
                    core_bet: 'try A',
                    best_fit: 'small teams',
                    cost_complexity: 'low',
                    covers_well: 'most cases',
                    main_risks: 'few',
                    lock_in_constraints: 'none',
                  },
                  meta_rubric: {},
                  graph_refs: [],
                },
              ],
            },
            isError: false,
          },
        },
      ] as unknown as BrunchSessionEnvelope['entries'],
    };

    const pending = pendingExchangeFromEnvelope(envelope);
    expect(pending).toMatchObject({
      exchangeId: 'cand',
      mode: 'single-select',
      respondsToPresentTool: 'present_candidates',
    });

    const accepted = acceptedResponseFromParams(pending!, {
      exchangeId: 'cand',
      answer: { optionId: 'cand-a' },
    });
    expect(accepted).toMatchObject({
      ok: true,
      toolResultMessage: {
        details: {
          tool_meta: { prev: 'present_candidates', curr: 'request_choice', next: 'capture_candidate' },
        },
      },
    });
  });
});
