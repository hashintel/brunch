import { describe, expect, it } from 'vitest';

import { runStructuredExchangeRpcProof } from './structured-exchange-rpc-proof.js';

describe('structured-exchange RPC proof', () => {
  it('round-trips option answers and notes through Pi RPC editor fallback', async () => {
    const proof = await runStructuredExchangeRpcProof();

    expect(proof.scenario).toMatchObject({
      mission: expect.stringContaining('option-based structured exchange'),
      evaluationFocus: expect.stringContaining('optional note'),
      maxTurns: 1,
    });
    expect(proof.editorRequest).toMatchObject({
      type: 'extension_ui_request',
      method: 'editor',
      title: 'Answer structured exchange as JSON',
    });
    expect(JSON.parse(proof.editorRequest.prefill ?? '{}')).toMatchObject({
      schema: 'brunch.structured_exchange.editor',
      schemaVersion: 1,
      question: 'Which implementation path should the evaluator choose?',
      mode: 'multi-select',
      options: [
        { index: 1, label: 'Ship RPC fallback', value: 'rpc-fallback' },
        { index: 2, label: 'Wait for web relay', value: 'wait-web' },
        { index: 3, label: 'Escalate blocker', value: 'blocker' },
      ],
    });
    expect(proof.terminalDetails).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      v: 1,
      tool_meta: { prev: 'present_options', curr: 'request_choices', next: 'capture_choices' },
      answered: {
        choices: [{ id: 'rpc-fallback', label: 'Ship RPC fallback', kind: 'listed' }],
        comment: 'Proceed, but report any relay friction separately.',
      },
      probe: {
        name: 'structured-exchange-rpc-proof',
        transport: 'pi-rpc-editor',
      },
      frictionReport: { blockers: [], frictions: [] },
    });
    expect(proof.sessionFile).toContain('.brunch/sessions');
  }, 20_000);
});
