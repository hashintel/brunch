import { describe, expect, it } from 'vitest';

import { relationToKind, type CascadeRelation } from './cascade-producer.js';

describe('relationToKind', () => {
  // Table-driven assertion — keeps the V3.0 mapping reviewable in isolation.
  // For an edge `X --(relation)--> itemId` where itemId changes, the resulting
  // reconciliation_need.kind is what the user owes against X (the downstream).
  //
  // supersedes: X was built FROM itemId; source change invalidates X's foundation.
  // needs_confirmation: X may still hold but the user must re-check after the change.
  const cases: Array<{ relation: CascadeRelation; expected: 'supersedes' | 'needs_confirmation' }> = [
    { relation: 'depends_on', expected: 'needs_confirmation' },
    { relation: 'derived_from', expected: 'supersedes' },
    { relation: 'constrains', expected: 'needs_confirmation' },
    { relation: 'verifies', expected: 'needs_confirmation' },
    { relation: 'refines', expected: 'supersedes' },
  ];

  for (const { relation, expected } of cases) {
    it(`maps ${relation} → ${expected}`, () => {
      expect(relationToKind(relation)).toBe(expected);
    });
  }

  it('covers every knowledge_edge relation enum value', () => {
    // Sanity: if the schema enum widens, this list must be updated alongside relationToKind.
    const expected: CascadeRelation[] = ['depends_on', 'derived_from', 'constrains', 'verifies', 'refines'];
    expect(cases.map((c) => c.relation).sort()).toEqual(expected.sort());
  });
});
