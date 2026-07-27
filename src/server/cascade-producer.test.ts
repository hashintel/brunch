import { describe, expect, it } from 'vitest';

import { getCascadeChangeImpact, type CascadeRelation } from './cascade-producer.js';

const relations: CascadeRelation[] = ['depends_on', 'derived_from', 'constrains', 'verifies', 'refines'];

describe('getCascadeChangeImpact', () => {
  it('covers every knowledge_edge relation enum value for source and target endpoint changes', () => {
    for (const relation of relations) {
      expect(getCascadeChangeImpact(relation, 'source')).toHaveProperty('affectedEndpoint');
      expect(getCascadeChangeImpact(relation, 'target')).toHaveProperty('affectedEndpoint');
    }
  });

  it('opens needs for policy-affected source endpoints when the raw edge target changes', () => {
    expect(getCascadeChangeImpact('depends_on', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'needs_confirmation',
    });
    expect(getCascadeChangeImpact('derived_from', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'supersedes',
    });
    expect(getCascadeChangeImpact('verifies', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'needs_confirmation',
    });
    expect(getCascadeChangeImpact('refines', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'supersedes',
    });
  });

  it('opens needs for policy-affected target endpoints when the raw edge source changes', () => {
    expect(getCascadeChangeImpact('constrains', 'source')).toEqual({
      affectedEndpoint: 'target',
      kind: 'needs_confirmation',
    });
    expect(getCascadeChangeImpact('verifies', 'source')).toEqual({
      affectedEndpoint: 'target',
      kind: 'needs_confirmation',
    });
  });

  it('returns no impact when relation policy says the opposite endpoint does not owe review', () => {
    expect(getCascadeChangeImpact('depends_on', 'source')).toEqual({ affectedEndpoint: null, kind: null });
    expect(getCascadeChangeImpact('derived_from', 'source')).toEqual({ affectedEndpoint: null, kind: null });
    expect(getCascadeChangeImpact('constrains', 'target')).toEqual({ affectedEndpoint: null, kind: null });
    expect(getCascadeChangeImpact('refines', 'source')).toEqual({ affectedEndpoint: null, kind: null });
  });
});
