import { describe, expect, it } from 'vitest';

import { extractSpecRecipe } from '../execution-recipe.js';
import { item } from './plan-synthesis-fixture.js';

const commitments = (body: string) => {
  const harness = {
    ...item('VV1', 100, body),
    title: 'Project execution harness',
    content: body,
  };
  return {
    constraints: [],
    invariants: [],
    decisions: [],
    verification: [harness],
    executionHarnesses: [harness],
  };
};

describe('extractSpecRecipe', () => {
  it('extracts declared execution intents with provenance to the declaring node', () => {
    const extraction = extractSpecRecipe(
      commitments(
        'Verification runs through cargo.\nexecute.build: cargo build --release\nexecute.verify: cargo test',
      ),
    );

    expect(extraction.issues).toEqual([]);
    expect(extraction.required).toEqual([
      { id: 'spec.build', source: { kind: 'elicited', itemId: 'VV1' } },
      { id: 'spec.verify', source: { kind: 'elicited', itemId: 'VV1' } },
    ]);
    expect(extraction.provider?.capabilities['spec.verify']?.actions.verify).toEqual([
      { command: 'cargo', args: ['test'] },
    ]);
    expect(extraction.provider?.capabilities['spec.build']?.actions.build).toEqual([
      { command: 'cargo', args: ['build', '--release'] },
    ]);
  });

  it('sequences repeated declarations of the same kind in node order', () => {
    const extraction = extractSpecRecipe(
      commitments('execute.setup: rustup default stable\nexecute.setup: cargo fetch'),
    );

    expect(extraction.provider?.capabilities['spec.setup']?.actions.setup).toEqual([
      { command: 'rustup', args: ['default', 'stable'] },
      { command: 'cargo', args: ['fetch'] },
    ]);
  });

  it('fails closed on shell composition instead of interpreting it', () => {
    const extraction = extractSpecRecipe(commitments('execute.verify: cargo test && rm -rf /'));

    expect(extraction.provider).toBeUndefined();
    expect(extraction.issues).toEqual([
      expect.objectContaining({ itemId: 'VV1', reason: expect.stringContaining('shell operators') }),
    ]);
  });

  it('returns nothing for commitments without recipe lines', () => {
    const extraction = extractSpecRecipe(commitments('Implementation language is Rust.'));

    expect(extraction).toEqual({ provider: undefined, required: [], issues: [] });
  });

  it('ignores recipe-like lines outside the projected canonical harness', () => {
    const harnessCommitments = commitments('execute.verify: cargo test');
    const extraction = extractSpecRecipe({
      ...harnessCommitments,
      decisions: [
        {
          ...item('D1', 200, 'execute.verify: unrelated-command'),
          content: 'execute.verify: unrelated-command',
        },
      ],
    });

    expect(extraction.required).toEqual([{ id: 'spec.verify', source: { kind: 'elicited', itemId: 'VV1' } }]);
    expect(extraction.provider?.capabilities['spec.verify']?.actions.verify).toEqual([
      { command: 'cargo', args: ['test'] },
    ]);
  });

  it('fails closed when multiple canonical harnesses claim command authority', () => {
    const first = commitments('execute.verify: cargo test').executionHarnesses[0]!;
    const second = {
      ...item('VV2', 200, 'execute.verify: npm test'),
      title: 'Project execution harness',
      content: 'execute.verify: npm test',
    };

    const extraction = extractSpecRecipe({
      constraints: [],
      invariants: [],
      decisions: [],
      verification: [first, second],
      executionHarnesses: [first, second],
    });

    expect(extraction.provider).toBeUndefined();
    expect(extraction.required).toEqual([]);
    expect(extraction.issues).toEqual([
      expect.objectContaining({ itemId: 'VV1', reason: expect.stringContaining('multiple settled') }),
      expect.objectContaining({ itemId: 'VV2', reason: expect.stringContaining('multiple settled') }),
    ]);
  });
});
