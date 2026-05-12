import { describe, expect, it, vi } from 'vitest';

import { classifyNeed } from './reconciliation-agent.js';

// Slice 4 inner-loop oracle (per SPEC.md §Verification Design row 553):
// state-machine + parse + purity tests over the classifier with a stubbed
// LLM. The middle-loop golden-fixture corpus (row 554) lives outside
// `npm run verify` and is its own slice; this file owns recoverability +
// label-vocabulary enforcement only.

const baseInput = {
  need: { id: 1, kind: 'needs_confirmation' as const, source_item_id: 10, target_item_id: 20 },
  sourceItem: { id: 10, content: 'Source updated' },
  targetItem: { id: 20, content: 'Target current' },
  sourcePreviousContent: 'Source original',
  sourceCurrentContent: 'Source updated',
  relationKind: 'depends_on',
};

describe('classifyNeed (state machine + parse)', () => {
  it('returns classified with classification=auto-confirm when the model returns that label', async () => {
    const stub = vi.fn().mockResolvedValue({ classification: 'auto-confirm', proposal: null });

    const result = await classifyNeed(baseInput, stub);

    expect(result.status).toBe('classified');
    expect(result.classification).toBe('auto-confirm');
    expect(result.proposal).toBeNull();
    expect(stub).toHaveBeenCalledTimes(1);
  });

  it('returns classified with a non-null proposal when the model returns auto-edit', async () => {
    const stub = vi.fn().mockResolvedValue({
      classification: 'auto-edit',
      proposal: 'Replace "user" with "customer" in target',
    });

    const result = await classifyNeed(baseInput, stub);

    expect(result.status).toBe('classified');
    expect(result.classification).toBe('auto-edit');
    expect(result.proposal).toBe('Replace "user" with "customer" in target');
  });

  it('returns classified with a one-sentence note when the model returns substantive', async () => {
    const stub = vi.fn().mockResolvedValue({
      classification: 'substantive',
      proposal: 'Decide whether the loosened bound still constrains the verifier.',
    });

    const result = await classifyNeed(baseInput, stub);

    expect(result.status).toBe('classified');
    expect(result.classification).toBe('substantive');
    expect(result.proposal).toBe('Decide whether the loosened bound still constrains the verifier.');
  });

  it('transitions to failed when the model throws, persisting the error message in proposal', async () => {
    const stub = vi.fn().mockRejectedValue(new Error('LLM timeout'));

    const result = await classifyNeed(baseInput, stub);

    expect(result.status).toBe('failed');
    expect(result.classification).toBeNull();
    expect(result.proposal).toBe('LLM timeout');
  });

  it('transitions to failed with a Parse error proposal when the model returns an invalid label', async () => {
    const stub = vi.fn().mockResolvedValue({ classification: 'maybe-confirm', proposal: null });

    const result = await classifyNeed(baseInput, stub);

    expect(result.status).toBe('failed');
    expect(result.classification).toBeNull();
    expect(result.proposal).toMatch(/^Parse error: /);
  });

  it('transitions to failed with a Parse error when the model returns a non-object', async () => {
    const stub = vi.fn().mockResolvedValue('auto-confirm');

    const result = await classifyNeed(baseInput, stub);

    expect(result.status).toBe('failed');
    expect(result.classification).toBeNull();
    expect(result.proposal).toMatch(/^Parse error: /);
  });

  it('is pure: the same input + same stubbed string yields the same output', async () => {
    const stub = vi.fn().mockResolvedValue({ classification: 'auto-confirm', proposal: null });

    const a = await classifyNeed(baseInput, stub);
    const b = await classifyNeed(baseInput, stub);

    expect(a).toEqual(b);
  });

  it('falls back to (no recorded snapshot) when source snapshot fields are null without throwing', async () => {
    const stub = vi.fn().mockResolvedValue({ classification: 'auto-confirm', proposal: null });

    const result = await classifyNeed(
      {
        ...baseInput,
        sourcePreviousContent: null,
        sourceCurrentContent: null,
      },
      stub,
    );

    expect(result.status).toBe('classified');
    expect(stub).toHaveBeenCalledTimes(1);
    const renderedPrompt = stub.mock.calls[0][0] as string;
    expect(renderedPrompt).toContain('(no recorded snapshot)');
  });

  it('falls back to (unknown) when relationKind is undefined without throwing', async () => {
    const stub = vi.fn().mockResolvedValue({ classification: 'substantive', proposal: 'note' });

    const result = await classifyNeed({ ...baseInput, relationKind: undefined }, stub);

    expect(result.status).toBe('classified');
    const renderedPrompt = stub.mock.calls[0][0] as string;
    expect(renderedPrompt).toContain('(unknown)');
  });
});
