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

  it('runs same-assistant-message ask through the editor and persists the answer', async () => {
    const proof = await runStructuredExchangeOrderingProof();

    expect(proof.scenario).toMatchObject({
      mission: 'Prove same-assistant-message ask collection.',
      evaluationFocus: 'Verify ask opens response UI and persists one durable question+answer result.',
      maxTurns: 1,
    });
    expect(proof.verdict).toEqual({ askUiOpenedBeforeResult: true, jsonlAskPersisted: true });
    expect(proof.eventOrder).toEqual(['ask:start', 'ui:editor', 'ask:end']);
    expect(proof.jsonlToolResultOrder).toEqual(['ask']);
    expect(proof.requestDetails).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      exchange_id: 'ordering-proof',
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      question: { body: 'What should the next parity proof check?' },
      answered: { text: 'Sequential ask ordering looks safe for the next parity proof.' },
    });
  }, 20_000);
});
