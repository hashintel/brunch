import { describe, expect, it } from 'vitest';

import {
  buildStructuredExchangeEditorPrefill,
  parseStructuredExchangeEditorResponse,
  structuredExchangeResultFromEditor,
} from '../extensions/structured-exchange/index.js';

describe('structured exchange JSON-editor fallback compatibility helpers', () => {
  it('builds schema-tagged editor prefill for the raw Pi RPC fallback proof', () => {
    const prefill = buildStructuredExchangeEditorPrefill({
      question: 'Pick paths',
      context: 'Use the fallback.',
      mode: 'multi-select',
      options: [
        { label: 'Alpha', value: 'a' },
        { label: 'Beta', value: 'b', description: 'Second' },
      ],
    });

    expect(JSON.parse(prefill)).toMatchObject({
      schema: 'brunch.structured_exchange.editor',
      schemaVersion: 1,
      question: 'Pick paths',
      context: 'Use the fallback.',
      mode: 'multi-select',
      options: [
        { index: 1, label: 'Alpha', value: 'a' },
        { index: 2, label: 'Beta', value: 'b', description: 'Second' },
      ],
      response: { status: 'cancelled', answers: [], note: '' },
    });
  });

  it('parses answered editor JSON with explicit empty notes', () => {
    const parsed = parseStructuredExchangeEditorResponse(
      JSON.stringify({
        response: {
          status: 'answered',
          answers: [{ type: 'option', label: 'Beta', value: 'b', index: 2 }],
          note: '',
        },
      }),
    );

    expect(parsed).toEqual({
      status: 'answered',
      answers: [{ type: 'option', label: 'Beta', value: 'b', index: 2 }],
      note: '',
    });
  });

  it('returns canonical request details for the existing RPC proof', () => {
    const prefill = JSON.parse(
      buildStructuredExchangeEditorPrefill({
        question: 'Pick paths',
        exchangeId: 'paths-1',
        mode: 'single-select',
        options: [{ label: 'Alpha', value: 'a' }],
      }),
    );
    prefill.response = {
      status: 'answered',
      answers: [{ type: 'option', label: 'Alpha', value: 'a', index: 1 }],
      note: 'Add context',
    };

    const result = structuredExchangeResultFromEditor(
      {
        question: 'Pick paths',
        exchangeId: 'paths-1',
        mode: 'single-select',
        options: [{ label: 'Alpha', value: 'a' }],
      },
      JSON.stringify(prefill),
    );

    expect(result.details).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'paths-1',
      tool_meta: { prev: 'present_options', curr: 'request_choice' },
      answered: {
        choice: { id: 'a', label: 'Alpha', kind: 'listed' },
        comment: 'Add context',
      },
    });
  });
});
