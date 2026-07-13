import { describe, expect, it } from 'vitest';

import { extractSpecRecipe } from '../execution-recipe.js';
import { item } from './plan-synthesis-fixture.js';

const commitments = (decisions: { itemId: string; body: string }[]) => ({
  constraints: [],
  invariants: [],
  decisions: decisions.map((decision, index) => ({
    ...item(decision.itemId, 100 + index, decision.body),
    content: decision.body,
  })),
  verification: [],
});

describe('extractSpecRecipe', () => {
  it('extracts declared execution intents with provenance to the declaring node', () => {
    const extraction = extractSpecRecipe(
      commitments([
        { itemId: 'D1', body: 'Verification runs through cargo.\nexecute.verify: cargo test' },
        { itemId: 'D2', body: 'execute.build: cargo build --release' },
      ]),
    );

    expect(extraction.issues).toEqual([]);
    expect(extraction.required).toEqual([
      { id: 'spec.build', source: { kind: 'elicited', itemId: 'D2' } },
      { id: 'spec.verify', source: { kind: 'elicited', itemId: 'D1' } },
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
      commitments([
        { itemId: 'D1', body: 'execute.setup: rustup default stable\nexecute.setup: cargo fetch' },
      ]),
    );

    expect(extraction.provider?.capabilities['spec.setup']?.actions.setup).toEqual([
      { command: 'rustup', args: ['default', 'stable'] },
      { command: 'cargo', args: ['fetch'] },
    ]);
  });

  it('fails closed on shell composition instead of interpreting it', () => {
    const extraction = extractSpecRecipe(
      commitments([{ itemId: 'D1', body: 'execute.verify: cargo test && rm -rf /' }]),
    );

    expect(extraction.provider).toBeUndefined();
    expect(extraction.issues).toEqual([
      expect.objectContaining({ itemId: 'D1', reason: expect.stringContaining('shell operators') }),
    ]);
  });

  it('returns nothing for commitments without recipe lines', () => {
    const extraction = extractSpecRecipe(
      commitments([{ itemId: 'D1', body: 'Implementation language is Rust.' }]),
    );

    expect(extraction).toEqual({ provider: undefined, required: [], issues: [] });
  });

  it('accepts recipe lines declared on verification commitments', () => {
    const extraction = extractSpecRecipe({
      constraints: [],
      invariants: [],
      decisions: [],
      verification: [
        { ...item('VV2', 200, 'Run cargo test before milestones.\nexecute.verify: cargo test') },
      ],
    });

    expect(extraction.required).toEqual([{ id: 'spec.verify', source: { kind: 'elicited', itemId: 'VV2' } }]);
    expect(extraction.provider?.capabilities['spec.verify']?.actions.verify).toEqual([
      { command: 'cargo', args: ['test'] },
    ]);
  });
});
