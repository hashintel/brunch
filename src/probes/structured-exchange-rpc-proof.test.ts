import { describe, expect, it } from 'vitest';

import { runStructuredExchangeRpcProof } from './structured-exchange-rpc-proof.js';

describe('structured-exchange RPC proof', () => {
  it('round-trips multi-choice answers and comments through the Pi RPC editor envelope', async () => {
    const proof = await runStructuredExchangeRpcProof();

    expect(proof.scenario).toMatchObject({
      mission: expect.stringContaining('multi-choice structured exchange'),
      evaluationFocus: expect.stringContaining('optional comment'),
      maxTurns: 1,
    });
    expect(proof.editorRequest).toMatchObject({
      type: 'extension_ui_request',
      method: 'editor',
      title: 'Answer structured exchange as JSON',
    });
    expect(JSON.parse(proof.editorRequest.prefill ?? '{}')).toMatchObject({
      schema: 'brunch.structured_exchange.request_choices.editor',
      schemaVersion: 1,
      prompt: 'Which implementation path should the evaluator choose?',
      mode: 'multi-choice',
      choices: [
        { id: 'rpc-fallback', label: 'Ship RPC fallback' },
        { id: 'wait-web', label: 'Wait for web relay' },
        { id: 'blocker', label: 'Escalate blocker' },
      ],
      response: { status: 'cancelled', choices: [], comment: '' },
    });
    expect(proof.terminalDetails).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'structured-exchange-rpc-proof',
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
