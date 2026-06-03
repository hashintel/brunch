import { describe, expect, it } from 'vitest';

import type { BrunchSessionEnvelope } from './brunch-session-envelope.js';
import { createSessionBindingData } from './session-binding.js';
import {
  acceptedResponseFromParams,
  nextDeterministicElicitationExchange,
  pendingExchangeFromEnvelope,
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
    const pending = nextDeterministicElicitationExchange(1);

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
          exchangeId: pending.exchangeId,
          requestTool: 'request_answer',
          status: 'answered',
          answer: 'A local product specification workspace.',
        },
      },
    });
  });

  it('materializes accepted single-select responses as request_choice tool results', () => {
    const pending = nextDeterministicElicitationExchange(0);

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
          requestTool: 'request_choice',
          comment: 'This is greenfield.',
          choice: { id: 'new-from-scratch' },
        },
      },
    });
  });

  it('materializes accepted multi-select responses and requires comments for Other or None', () => {
    const pending = nextDeterministicElicitationExchange(2);

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
          requestTool: 'request_choices',
          comment: 'Also verify friction reporting.',
          choices: [{ id: 'transcript' }, { id: 'other' }],
        },
      },
    });
  });

  it('rejects response mode and option mismatches without materializing a tool result', () => {
    const pending = nextDeterministicElicitationExchange(0);

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

  it('reconstructs pending options from structured present markdown when details omit options', () => {
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
              schemaVersion: 1,
              exchangeId: 'quality',
              presentTool: 'present_options',
              kind: 'options',
              status: 'presented',
              expectedRequest: { tool: 'request_choice', required: true },
              createdAtToolCallId: 'present-call-1',
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
