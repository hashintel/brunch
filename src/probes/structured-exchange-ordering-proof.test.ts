import { describe, expect, it } from 'vitest';

import { runStructuredExchangeOrderingProof } from './structured-exchange-ordering-proof.js';

describe('structured-exchange ordering proof', () => {
  it('runs same-assistant-message present_options before request_choice with sequential tools', async () => {
    const proof = await runStructuredExchangeOrderingProof();

    expect(proof.scenario).toMatchObject({
      mission: 'Prove same-assistant-message present/request structured-exchange ordering.',
      evaluationFocus: 'Verify sequential present_options persists before request_choice opens response UI.',
      maxTurns: 1,
    });
    expect(proof.verdict).toEqual({
      presentResultBeforeRequestUi: true,
      jsonlPresentBeforeRequest: true,
    });
    expect(proof.eventOrder).toEqual([
      'present_options:start',
      'present_options:end',
      'request_choice:start',
      'ui:select',
      'ui:input',
      'request_choice:end',
    ]);
    expect(proof.jsonlToolResultOrder).toEqual(['present_options', 'request_choice']);
    expect(proof.presentDetails).toMatchObject({
      schema: 'brunch.structured_exchange.present',
      exchange_id: 'ordering-proof',
      tool_meta: { curr: 'present_options', next: 'request_choice' },
      options: [
        { id: 'root', content: 'Keep src/pi-extensions.ts' },
        { id: 'tui', content: 'Move under src/tui-client' },
      ],
    });
    expect(proof.requestDetails).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      exchange_id: 'ordering-proof',
      tool_meta: { prev: 'present_options', curr: 'request_choice' },
      answered: {
        choice: { id: 'tui', label: 'Move under src/tui-client', kind: 'listed' },
        comment: 'Sequential ordering looks safe for the next parity proof.',
      },
    });
  }, 20_000);
});
