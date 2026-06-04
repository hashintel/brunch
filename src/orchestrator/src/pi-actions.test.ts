import { describe, expect, it } from 'vitest';

import { evaluateVerificationTargets, toolsForAction } from './pi-actions.js';

describe('evaluateVerificationTargets — done reflects real test execution', () => {
  it('done only when at least one target exists and every target passes', async () => {
    const { done } = await evaluateVerificationTargets([{ target: 'a' }, { target: 'b' }], async () => true);
    expect(done).toBe(true);
  });

  it('not done if any target fails, and reports per-target results', async () => {
    const { done, results } = await evaluateVerificationTargets(
      [{ target: 'a' }, { target: 'b' }],
      async (t) => t === 'a',
    );
    expect(done).toBe(false);
    expect(results).toEqual([
      { target: 'a', passed: true },
      { target: 'b', passed: false },
    ]);
  });

  it('not done when there are no verification targets (nothing proves it)', async () => {
    const { done } = await evaluateVerificationTargets([], async () => true);
    expect(done).toBe(false);
  });

  it('a throwing runner counts as a failed target', async () => {
    const { done } = await evaluateVerificationTargets([{ target: 'x' }], async () => {
      throw new Error('runner blew up');
    });
    expect(done).toBe(false);
  });
});

describe('pi-actions tool scoping', () => {
  it('evaluate-done is read-only — the evaluator cannot mutate the sandbox during evaluation', () => {
    const tools = toolsForAction('evaluate-done');
    expect(tools).toContain('read');
    expect(tools).not.toContain('write');
    expect(tools).not.toContain('edit');
    expect(tools).not.toContain('bash');
  });

  it('code-producing actions keep write-capable tools', () => {
    for (const action of ['write-tests', 'write-code', 'verify-epic']) {
      const tools = toolsForAction(action);
      expect(tools).toContain('read');
      expect(tools).toContain('write');
      expect(tools).toContain('edit');
      expect(tools).toContain('bash');
    }
  });
});
