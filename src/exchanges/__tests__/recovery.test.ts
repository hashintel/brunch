import { describe, expect, it } from 'vitest';

import { type EntryLike, findIncompleteStructuredExchangePresents } from '../recovery.js';
import {
  STRUCTURED_EXCHANGE_DETAILS_VERSION,
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
  STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
} from '../schemas/index.js';

describe('findIncompleteStructuredExchangePresents', () => {
  it('detects dangling structured-exchange presents and excludes completed exchanges', () => {
    const danglingPresent = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'dangling-question',
      tool_meta: { curr: 'present_question', next: 'request_response' },
      response_kind: 'answer',
      display: { heading: 'Name the next step' },
    });
    const completedPresent = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'completed-question',
      tool_meta: { curr: 'present_question', next: 'request_response' },
      response_kind: 'answer',
      display: { heading: 'Choose the already answered path' },
    });
    const completedRequest = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_REQUEST_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'completed-question',
      tool_meta: { prev: 'present_question', curr: 'request_answer', next: 'capture_answer' },
      answered: { text: 'Keep the completed exchange closed.' },
    });
    const danglingDigest = toolResultEntry({
      schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
      v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
      exchange_id: 'dangling-digest',
      tool_meta: { curr: 'present_digest', next: 'request_response' },
      display: { heading: 'Review source digest' },
      digest: { abstract: 'Digest before graph mapping.' },
    });
    const unrelatedEntry = toolResultEntry({ note: 'not structured exchange details' });

    expect(
      findIncompleteStructuredExchangePresents([
        unrelatedEntry,
        completedPresent,
        danglingPresent,
        danglingDigest,
        completedRequest,
      ]),
    ).toEqual([
      {
        entry: danglingPresent,
        details: danglingPresent.message?.details,
        continuationTool: 'request_response',
      },
      {
        entry: danglingDigest,
        details: danglingDigest.message?.details,
        continuationTool: 'request_response',
      },
    ]);
  });
});

function toolResultEntry(details: unknown): EntryLike {
  return {
    type: 'message',
    message: {
      role: 'toolResult',
      details,
    },
  };
}
