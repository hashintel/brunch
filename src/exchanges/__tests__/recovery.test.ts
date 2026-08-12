import { describe, expect, it } from 'vitest';

import {
  classifyProviderStandaloneAskOccupancy,
  type EntryLike,
  findIncompleteStructuredExchangePresents,
} from '../recovery.js';
import {
  STRUCTURED_EXCHANGE_DETAILS_VERSION,
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
} from '../schemas/index.js';

describe('classifyProviderStandaloneAskOccupancy', () => {
  const call = (toolCallId: string, exchangeId: string, provider?: string): EntryLike => ({
    type: 'message',
    message: {
      role: 'assistant',
      ...(provider === undefined ? {} : { provider }),
      content: [
        { type: 'toolCall', id: toolCallId, name: 'ask', arguments: { exchangeId, body: 'Choose?' } },
      ],
    },
  });
  const result = (toolCallId: string, exchangeId: string, details?: unknown): EntryLike => ({
    type: 'message',
    message: {
      role: 'toolResult',
      toolName: 'ask',
      toolCallId,
      details: details ?? {
        schema: 'brunch.structured_exchange.request',
        v: 1,
        exchange_id: exchangeId,
        tool_meta: { curr: 'ask' },
        question: { body: 'Choose?' },
        answered: { text: 'Yes.' },
      },
    },
  });

  it('excludes Brunch synthetic asks while retaining provider and metadata-absent calls', () => {
    expect(
      classifyProviderStandaloneAskOccupancy([
        call('synthetic', 'offer', 'brunch'),
        call('provider', 'real', 'anthropic'),
        call('historical', 'legacy'),
      ]),
    ).toMatchObject([
      { status: 'unresolved', call: { toolCallId: 'provider' } },
      { status: 'unresolved', call: { toolCallId: 'historical' } },
    ]);
  });

  it('classifies unresolved, resolved, and complete-set protocol-invalid occupancy', () => {
    expect(classifyProviderStandaloneAskOccupancy([call('open', 'open-exchange')])).toMatchObject([
      { status: 'unresolved', call: { toolCallId: 'open' } },
    ]);
    expect(
      classifyProviderStandaloneAskOccupancy([
        call('closed', 'closed-exchange'),
        result('closed', 'closed-exchange'),
      ]),
    ).toMatchObject([{ status: 'resolved', call: { toolCallId: 'closed' } }]);

    for (const invalid of [result('bad', 'bad-exchange', { raw: 'pi' }), result('bad', 'other')]) {
      expect(
        classifyProviderStandaloneAskOccupancy([call('bad', 'bad-exchange', 'anthropic'), invalid]),
      ).toMatchObject([{ status: 'protocol_invalid', call: { toolCallId: 'bad' }, invalidResult: invalid }]);
    }

    expect(
      classifyProviderStandaloneAskOccupancy([
        call('mixed', 'mixed-exchange'),
        result('mixed', 'mixed-exchange'),
        result('unrelated', 'other'),
        result('mixed', 'mixed-exchange', { raw: 'poison' }),
      ]),
    ).toMatchObject([{ status: 'protocol_invalid', call: { toolCallId: 'mixed' } }]);
  });
});

describe('findIncompleteStructuredExchangePresents', () => {
  it('detects declared offer continuations and excludes completed exchanges', () => {
    const danglingQuestion = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'dangling-question',
      tool_meta: { curr: 'present_question', next: 'request_response' },
      response_kind: 'answer',
      display: { heading: 'Name the next step' },
    });
    const completedDigest = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'completed-digest',
      tool_meta: { curr: 'present_digest', next: 'ask' },
      display: { heading: 'Choose the already answered path' },
      continuation: freeTextContinuation('Choose the already answered path'),
      digest: { abstract: 'Keep the completed exchange closed.' },
    });
    const completedAsk = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'completed-digest',
      tool_meta: { prev: 'present_digest', curr: 'request_review', next: 'capture_review' },
      answered: { decision: 'approve', accepted_abstract: 'Keep the completed exchange closed.' },
    });
    const danglingDigest = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'dangling-digest',
      tool_meta: { curr: 'present_digest', next: 'ask' },
      display: { heading: 'Review source digest' },
      continuation: freeTextContinuation('Review source digest'),
      digest: { abstract: 'Digest before graph mapping.' },
    });
    const unrelatedEntry = toolResultEntry({ note: 'not structured exchange details' });

    expect(
      findIncompleteStructuredExchangePresents([
        unrelatedEntry,
        completedDigest,
        danglingQuestion,
        danglingDigest,
        completedAsk,
      ]),
    ).toEqual([
      {
        entry: danglingQuestion,
        details: danglingQuestion.message?.details,
        continuationTool: 'ask',
      },
      {
        entry: danglingDigest,
        details: danglingDigest.message?.details,
        continuationTool: 'ask',
      },
    ]);
  });
});

function freeTextContinuation(body: string) {
  return { tool: 'ask' as const, params: { body } };
}

function toolResultEntry(details: unknown): EntryLike {
  return {
    type: 'message',
    message: {
      role: 'toolResult',
      details,
    },
  };
}
