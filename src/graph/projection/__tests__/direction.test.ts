/**
 * The full reconciliation-impact matrix, executable.
 *
 * Direction is read from per-category impact metadata, NOT from source→target
 * storage geometry. Renderers rely on this coverage and never re-derive
 * direction themselves.
 */

import { describe, expect, it } from 'vitest';

import type { EdgeEndpoint, EdgeImpactStrength } from '../../policy/category-policy.js';
import type { EdgeCategory } from '../../schema/edges.js';
import { edgeImpact, relationFromAnchor, type EdgeImpact, type EdgeRelation } from '../direction.js';

interface ImpactCell {
  readonly category: EdgeCategory;
  readonly impact: EdgeImpact;
  /** Neighbor relation + strength when the anchor sits at each endpoint. */
  readonly fromSource: { relation: EdgeRelation; strength: EdgeImpactStrength };
  readonly fromTarget: { relation: EdgeRelation; strength: EdgeImpactStrength };
}

const MATRIX: readonly ImpactCell[] = [
  // source upstream → neighbor downstream when anchor is the source.
  {
    category: 'dependency',
    impact: { downstreamEndpoint: 'target', strength: 'cascade' },
    fromSource: { relation: 'downstream', strength: 'cascade' },
    fromTarget: { relation: 'upstream', strength: 'cascade' },
  },
  {
    category: 'realization',
    impact: { downstreamEndpoint: 'target', strength: 'advisory' },
    fromSource: { relation: 'downstream', strength: 'advisory' },
    fromTarget: { relation: 'upstream', strength: 'advisory' },
  },
  {
    category: 'refinement',
    impact: { downstreamEndpoint: 'target', strength: 'advisory' },
    fromSource: { relation: 'downstream', strength: 'advisory' },
    fromTarget: { relation: 'upstream', strength: 'advisory' },
  },
  {
    category: 'exclusion',
    impact: { downstreamEndpoint: 'target', strength: 'advisory' },
    fromSource: { relation: 'downstream', strength: 'advisory' },
    fromTarget: { relation: 'upstream', strength: 'advisory' },
  },
  // target upstream → neighbor upstream when anchor is the source.
  {
    category: 'witness',
    impact: { downstreamEndpoint: 'source', strength: 'advisory' },
    fromSource: { relation: 'upstream', strength: 'advisory' },
    fromTarget: { relation: 'downstream', strength: 'advisory' },
  },
  {
    category: 'rationale',
    impact: { downstreamEndpoint: 'source', strength: 'advisory' },
    fromSource: { relation: 'upstream', strength: 'advisory' },
    fromTarget: { relation: 'downstream', strength: 'advisory' },
  },
  {
    category: 'composition',
    impact: { downstreamEndpoint: 'source', strength: 'advisory' },
    fromSource: { relation: 'upstream', strength: 'advisory' },
    fromTarget: { relation: 'downstream', strength: 'advisory' },
  },
  {
    category: 'supersession',
    impact: { downstreamEndpoint: 'source', strength: 'advisory' },
    fromSource: { relation: 'upstream', strength: 'advisory' },
    fromTarget: { relation: 'downstream', strength: 'advisory' },
  },
  // symmetric → lateral both ways.
  {
    category: 'cross_reference',
    impact: { downstreamEndpoint: 'none', strength: 'none' },
    fromSource: { relation: 'lateral', strength: 'none' },
    fromTarget: { relation: 'lateral', strength: 'none' },
  },
];

describe('edgeImpact', () => {
  it.each(MATRIX)('$category impact axis', ({ category, impact }) => {
    expect(edgeImpact(category)).toEqual(impact);
  });
});

describe('relationFromAnchor', () => {
  const roles: readonly {
    endpoint: EdgeEndpoint;
    pick: keyof Pick<ImpactCell, 'fromSource' | 'fromTarget'>;
  }[] = [
    { endpoint: 'source', pick: 'fromSource' },
    { endpoint: 'target', pick: 'fromTarget' },
  ];

  for (const { endpoint, pick } of roles) {
    it.each(MATRIX)(`$category from ${endpoint} anchor`, (cell) => {
      expect(relationFromAnchor(cell.category, endpoint)).toEqual(cell[pick]);
    });
  }

  it('the E2 worked example: realizes is upstream, motivated-by is downstream', () => {
    // realization(check → evidence): E2 is the concrete target → upstream.
    expect(relationFromAnchor('realization', 'target').relation).toBe('upstream');
    // rationale(requirement → evidence): E2 is the claim target → downstream.
    expect(relationFromAnchor('rationale', 'target').relation).toBe('downstream');
  });
});
