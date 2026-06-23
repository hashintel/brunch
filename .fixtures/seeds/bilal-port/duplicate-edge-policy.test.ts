import { describe, expect, it } from 'vitest';

import {
  dedupeSeedEdgesByPrecedence,
  seedEdgeKey,
  type OriginTaggedEdge,
  type SeedEdgeIdentity,
} from './duplicate-edge-policy.js';

interface TestEdge extends SeedEdgeIdentity {
  readonly rationale: string | null;
}

function source(edge: TestEdge): OriginTaggedEdge<TestEdge> {
  return { edge, origin: 'source' };
}

function synthetic(edge: TestEdge): OriginTaggedEdge<TestEdge> {
  return { edge, origin: 'synthetic' };
}

const supportFor = (rationale: string | null): TestEdge => ({
  category: 'rationale',
  source_local_id: 1,
  target_local_id: 2,
  stance: 'for',
  rationale,
});

describe('seed-port duplicate-edge precedence policy', () => {
  it('keys edges by endpoint, category, and stance', () => {
    expect(seedEdgeKey(supportFor('a'))).toBe(seedEdgeKey(supportFor('b')));
    expect(seedEdgeKey(supportFor('a'))).not.toBe(
      seedEdgeKey({ ...supportFor('a'), stance: 'against' }),
    );
  });

  it('lets a ported source edge outrank a synthetic edge emitted first', () => {
    const result = dedupeSeedEdgesByPrecedence<TestEdge>([
      synthetic(supportFor(null)),
      source(supportFor('ported rationale')),
    ]);

    expect(result.duplicatesDropped).toBe(1);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.rationale).toBe('ported rationale');
  });

  it('lets a ported source edge outrank a synthetic edge emitted later', () => {
    const result = dedupeSeedEdgesByPrecedence<TestEdge>([
      source(supportFor('ported rationale')),
      synthetic(supportFor(null)),
    ]);

    expect(result.duplicatesDropped).toBe(1);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.rationale).toBe('ported rationale');
  });

  it('keeps the first edge when two source edges collide', () => {
    const result = dedupeSeedEdgesByPrecedence<TestEdge>([
      source(supportFor('first')),
      source(supportFor('second')),
    ]);

    expect(result.duplicatesDropped).toBe(1);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.rationale).toBe('first');
  });

  it('keeps every edge when keys are distinct', () => {
    const result = dedupeSeedEdgesByPrecedence<TestEdge>([
      source(supportFor('a')),
      source({ ...supportFor('b'), target_local_id: 3 }),
      synthetic({ ...supportFor(null), category: 'realization', stance: null }),
    ]);

    expect(result.duplicatesDropped).toBe(0);
    expect(result.edges).toHaveLength(3);
  });
});
