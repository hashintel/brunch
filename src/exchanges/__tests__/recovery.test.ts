import { describe, expect, it } from 'vitest';

import { type EntryLike, findIncompleteStructuredExchangePresents } from '../recovery.js';
import {
  STRUCTURED_EXCHANGE_DETAILS_VERSION,
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
} from '../schemas/index.js';

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
      continuation: reviewContinuation('Choose the already answered path'),
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
      continuation: reviewContinuation('Review source digest'),
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

function reviewContinuation(body: string) {
  return {
    tool: 'ask' as const,
    params: {
      body,
      options: [
        { id: 'approve', label: 'Approve' },
        { id: 'request_changes', label: 'Request changes' },
        { id: 'reject', label: 'Reject' },
      ],
    },
  };
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
