import { describe, expect, it } from 'vitest';

import {
  orderingExtensionSource,
  runStructuredExchangeOrderingProof,
} from '../structured-exchange-ordering-proof.js';

describe('structured-exchange ordering proof', () => {
  it('generates an extension without importing build-excluded dev modules', () => {
    const source = orderingExtensionSource(
      '/repo/src/.pi/extensions/exchanges/index.ts',
      '/repo/src/probes/faux-provider.ts',
    );

    expect(source).toContain('/repo/src/probes/faux-provider.ts');
    expect(source).not.toContain('/src/dev/');
  });

  it.skip('runs same-assistant-message present_question before request_response with sequential tools', async () => {
    const proof = await runStructuredExchangeOrderingProof();

    expect(proof.scenario).toMatchObject({
      mission: 'Prove same-assistant-message present/request structured-exchange ordering.',
      evaluationFocus:
        'Verify sequential present_question persists before request_response opens response UI.',
      maxTurns: 1,
    });
    expect(proof.verdict).toEqual({
      presentResultBeforeRequestUi: true,
      jsonlPresentBeforeRequest: true,
    });
    expect(proof.eventOrder).toEqual([
      'present_question:start',
      'present_question:end',
      'request_response:start',
      'ui:editor',
      'request_response:end',
    ]);
    expect(proof.jsonlToolResultOrder).toEqual(['present_question', 'request_response']);
    expect(proof.presentDetails).toMatchObject({
      schema: 'brunch.structured_exchange.present',
      exchange_id: 'ordering-proof',
      tool_meta: { curr: 'present_question', next: 'request_response' },
      response_kind: 'answer',
      display: { heading: 'What should the next parity proof check?' },
    });
    expect(proof.requestDetails).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      exchange_id: 'ordering-proof',
      tool_meta: { prev: 'present_question', curr: 'request_answer' },
      answered: { text: 'Sequential ordering looks safe for the next parity proof.' },
    });
  }, 20_000);
});
