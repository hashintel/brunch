import { describe, expect, it } from 'vitest';

import { EDGE_CATEGORIES } from '../schema/kinds.js';
import { EDGE_CATEGORY_METADATA, edgeEndpointRole } from './category-policy.js';

const EXPECTED_EDGE_CATEGORY_METADATA = {
  dependency: {
    sourceRole: 'dependency',
    targetRole: 'dependent',
    impactOnSourceChange: 'cascade',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  proof: {
    sourceRole: 'oracle',
    targetRole: 'claim',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: true,
    projectionEffect: 'none',
  },
  support: {
    sourceRole: 'support',
    targetRole: 'claim',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  realization: {
    sourceRole: 'abstract',
    targetRole: 'concrete',
    impactOnSourceChange: 'advisory',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  boundary: {
    sourceRole: 'boundary',
    targetRole: 'subject',
    impactOnSourceChange: 'advisory',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  composition: {
    sourceRole: 'whole',
    targetRole: 'part',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  association: {
    sourceRole: 'peer',
    targetRole: 'peer',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'none',
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  supersession: {
    sourceRole: 'successor',
    targetRole: 'predecessor',
    impactOnSourceChange: 'none',
    impactOnTargetChange: 'advisory',
    criteriaHelpSignal: false,
    projectionEffect: 'hide_predecessor_from_active_context',
  },
} as const satisfies typeof EDGE_CATEGORY_METADATA;

describe('EDGE_CATEGORY_METADATA', () => {
  it('covers every stored edge category exactly once', () => {
    expect(Object.keys(EDGE_CATEGORY_METADATA).sort()).toEqual([...EDGE_CATEGORIES].sort());
    expect(EDGE_CATEGORY_METADATA).toEqual(EXPECTED_EDGE_CATEGORY_METADATA);
  });

  it('only dependency drives a hard cascade; reconciling categories are advisory', () => {
    for (const [category, metadata] of Object.entries(EDGE_CATEGORY_METADATA)) {
      const strengths = [metadata.impactOnSourceChange, metadata.impactOnTargetChange];
      if (category === 'dependency') {
        expect(strengths).toContain('cascade');
      } else {
        expect(strengths).not.toContain('cascade');
      }
      // A well-formed category drives impact in at most one direction.
      const driven = strengths.filter((s) => s !== 'none');
      expect(driven.length).toBeLessThanOrEqual(1);
    }
  });

  it('maps endpoint geometry to semantic roles', () => {
    expect(edgeEndpointRole('dependency', 'source')).toBe('dependency');
    expect(edgeEndpointRole('dependency', 'target')).toBe('dependent');
    expect(edgeEndpointRole('proof', 'source')).toBe('oracle');
    expect(edgeEndpointRole('proof', 'target')).toBe('claim');
    expect(edgeEndpointRole('association', 'source')).toBe('peer');
    expect(edgeEndpointRole('association', 'target')).toBe('peer');
  });
});
