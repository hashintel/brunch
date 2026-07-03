import { describe, expect, it } from 'vitest';

import { deriveGraphFactSeed, renderGraphFactSeed } from '../graph-fact-seed.js';

describe('deriveGraphFactSeed', () => {
  it('reports lsn, per-kind counts, and zero-count kinds with their latest-expected band', () => {
    const seed = deriveGraphFactSeed({
      lsn: 7,
      nodes: [
        { kind: 'goal', kindOrdinal: 1 },
        { kind: 'goal', kindOrdinal: 2 },
      ] as never,
    });

    expect(seed.lsn).toBe(7);
    expect(seed.nodeCountsByKind.goal).toBe(2);
    expect(seed.nodeCountsByKind.context).toBeUndefined();
    const contextEntry = seed.zeroCountKinds.find((entry) => entry.kind === 'context');
    expect(contextEntry).toEqual({ kind: 'context', band: 'elicitation' });
    const goalEntry = seed.zeroCountKinds.find((entry) => entry.kind === 'goal');
    expect(goalEntry).toBeUndefined();
  });
});

describe('renderGraphFactSeed', () => {
  it('renders raw facts only, never a score, rank, or readiness judgment', () => {
    const rendered = renderGraphFactSeed(
      deriveGraphFactSeed({
        lsn: 3,
        nodes: [{ kind: 'goal', kindOrdinal: 1 }] as never,
      }),
    );

    expect(rendered).toContain('lsn: 3');
    expect(rendered).toContain('goal=1');
    expect(rendered).toContain('context');
    expect(rendered).not.toMatch(/readiness|score|coverage|rank|importance/i);
  });

  it('renders node counts in canonical node-kind order independent of input order', () => {
    const rendered = renderGraphFactSeed(
      deriveGraphFactSeed({
        lsn: 3,
        nodes: [
          { kind: 'criterion', kindOrdinal: 1 },
          { kind: 'goal', kindOrdinal: 1 },
          { kind: 'criterion', kindOrdinal: 2 },
        ] as never,
      }),
    );

    expect(rendered).toContain('node counts by kind: goal=1, criterion=2');
  });
});
