import { describe, expect, it } from 'vitest';

import type { EdgeCategory } from '../schema/edges.js';
import { edgeImpact, relationFromAnchor, type EdgeRelation } from './direction.js';

describe('edgeImpact', () => {
  it('places the downstream endpoint per the impact axis, not source/target geometry', () => {
    // source upstream → target downstream
    expect(edgeImpact('dependency')).toEqual({ downstreamEndpoint: 'target', strength: 'cascade' });
    expect(edgeImpact('realization')).toEqual({ downstreamEndpoint: 'target', strength: 'advisory' });
    expect(edgeImpact('boundary')).toEqual({ downstreamEndpoint: 'target', strength: 'advisory' });
    // target upstream → source downstream
    expect(edgeImpact('proof')).toEqual({ downstreamEndpoint: 'source', strength: 'advisory' });
    expect(edgeImpact('support')).toEqual({ downstreamEndpoint: 'source', strength: 'advisory' });
    expect(edgeImpact('composition')).toEqual({ downstreamEndpoint: 'source', strength: 'advisory' });
    expect(edgeImpact('supersession')).toEqual({ downstreamEndpoint: 'source', strength: 'advisory' });
    // symmetric
    expect(edgeImpact('association')).toEqual({ downstreamEndpoint: 'none', strength: 'none' });
  });
});

describe('relationFromAnchor', () => {
  it('classifies a neighbor relative to the anchor by impact flow', () => {
    // dependency(dep → dependent): the dependency (source) is upstream.
    expect(relationFromAnchor('dependency', 'source').relation).toBe('downstream'); // anchor=dependency
    expect(relationFromAnchor('dependency', 'target').relation).toBe('upstream'); // anchor=dependent

    // realization(abstract → concrete): abstract (source) is upstream.
    expect(relationFromAnchor('realization', 'source').relation).toBe('downstream'); // anchor=abstract
    expect(relationFromAnchor('realization', 'target').relation).toBe('upstream'); // anchor=concrete

    // support(support → claim): the claim (target) is upstream.
    expect(relationFromAnchor('support', 'target').relation).toBe('downstream'); // anchor=claim
    expect(relationFromAnchor('support', 'source').relation).toBe('upstream'); // anchor=support

    // association is always lateral.
    expect(relationFromAnchor('association', 'source').relation).toBe('lateral');
    expect(relationFromAnchor('association', 'target').relation).toBe('lateral');
  });

  it('carries cascade strength only for dependency', () => {
    expect(relationFromAnchor('dependency', 'source').strength).toBe('cascade');
    expect(relationFromAnchor('support', 'target').strength).toBe('advisory');
    expect(relationFromAnchor('association', 'source').strength).toBe('none');
  });

  it('the E2 worked example: realizes is upstream, motivated-by is downstream', () => {
    // realization(check CH1 → evidence E2): E2 is the concrete target.
    const realizes: EdgeRelation = relationFromAnchor('realization', 'target').relation;
    // support(requirement REQ59 → evidence E2): E2 is the claim target.
    const motivatedBy: EdgeRelation = relationFromAnchor('support', 'target').relation;
    expect(realizes).toBe('upstream');
    expect(motivatedBy).toBe('downstream');
  });

  it('covers every category for both anchor roles without throwing', () => {
    const categories: readonly EdgeCategory[] = [
      'dependency',
      'proof',
      'support',
      'realization',
      'boundary',
      'composition',
      'association',
      'supersession',
    ];
    for (const category of categories) {
      for (const role of ['source', 'target'] as const) {
        expect(['upstream', 'downstream', 'lateral']).toContain(relationFromAnchor(category, role).relation);
      }
    }
  });
});
