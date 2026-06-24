import { describe, expect, it } from 'vitest';

import { EDGE_CATEGORIES } from '../../schema/kinds.js';
import { EDGE_CATEGORY_METADATA, edgeEndpointRole } from '../category-policy.js';

const EXPECTED_EDGE_CATEGORY_METADATA = {
  dependency: {
    sourceRole: 'dependency',
    targetRole: 'dependent',
    affected: 'target',
    impactKind: 'cascade',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  witness: {
    sourceRole: 'oracle',
    targetRole: 'claim',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: true,
    criteriaHelpSignal: true,
    projectionEffect: 'none',
  },
  rationale: {
    sourceRole: 'support',
    targetRole: 'claim',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: true,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  realization: {
    sourceRole: 'abstract',
    targetRole: 'concrete',
    affected: 'target',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  refinement: {
    sourceRole: 'abstract',
    targetRole: 'concrete',
    affected: 'target',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  exclusion: {
    sourceRole: 'boundary',
    targetRole: 'subject',
    affected: 'target',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  composition: {
    sourceRole: 'whole',
    targetRole: 'part',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  cross_reference: {
    sourceRole: 'peer',
    targetRole: 'peer',
    affected: null,
    impactKind: 'none',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'none',
  },
  supersession: {
    sourceRole: 'successor',
    targetRole: 'predecessor',
    affected: 'source',
    impactKind: 'advisory',
    stanceRequired: false,
    criteriaHelpSignal: false,
    projectionEffect: 'hide_predecessor_from_active_context',
  },
} as const satisfies typeof EDGE_CATEGORY_METADATA;

describe('EDGE_CATEGORY_METADATA', () => {
  it('covers every stored edge category exactly once', () => {
    expect(Object.keys(EDGE_CATEGORY_METADATA).sort()).toEqual([...EDGE_CATEGORIES].sort());
    expect(EDGE_CATEGORY_METADATA).toEqual(EXPECTED_EDGE_CATEGORY_METADATA);
  });

  it('declares one affected endpoint and pins stance-bearing categories', () => {
    for (const [category, metadata] of Object.entries(EDGE_CATEGORY_METADATA)) {
      if (category === 'dependency') {
        expect(metadata.impactKind).toBe('cascade');
      } else {
        expect(metadata.impactKind).not.toBe('cascade');
      }

      if (metadata.impactKind === 'none') {
        expect(metadata.affected).toBeNull();
      } else {
        expect(metadata.affected).not.toBeNull();
      }
    }

    expect(
      Object.entries(EDGE_CATEGORY_METADATA)
        .filter(([, metadata]) => metadata.stanceRequired)
        .map(([category]) => category)
        .sort(),
    ).toEqual(['rationale', 'witness']);
  });

  it('maps endpoint geometry to semantic roles', () => {
    expect(edgeEndpointRole('dependency', 'source')).toBe('dependency');
    expect(edgeEndpointRole('dependency', 'target')).toBe('dependent');
    expect(edgeEndpointRole('witness', 'source')).toBe('oracle');
    expect(edgeEndpointRole('witness', 'target')).toBe('claim');
    expect(edgeEndpointRole('cross_reference', 'source')).toBe('peer');
    expect(edgeEndpointRole('cross_reference', 'target')).toBe('peer');
  });
});
