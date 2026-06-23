import { describe, expect, it } from 'vitest';

import { EDGE_CATEGORY_METADATA } from '../../policy/category-policy.js';
import { EDGE_CATEGORIES } from '../../schema/kinds.js';
import { normalizeRoleNamedEdgeDraft, type RoleNamedEdgeDraft } from '../role-named-edge-draft.js';

const EDGE_DRAFT_FIXTURES = {
  dependency: {
    category: 'dependency',
    dependency: 'dep-ref',
    dependent: { existing: 1 },
    rationale: 'depends',
  },
  witness: {
    category: 'witness',
    oracle: 'oracle-ref',
    claim: { existing: 2 },
    stance: 'for',
    rationale: 'proves',
  },
  rationale: {
    category: 'rationale',
    support: 'support-ref',
    claim: { existing: 3 },
    stance: 'against',
    rationale: 'supports',
  },
  realization: {
    category: 'realization',
    abstract: 'abstract-ref',
    concrete: { existing: 4 },
    rationale: 'realizes',
  },
  refinement: {
    category: 'refinement',
    abstract: 'refinement-abstract-ref',
    concrete: { existing: 5 },
    rationale: 'refines',
  },
  exclusion: {
    category: 'exclusion',
    boundary: 'boundary-ref',
    subject: { existing: 6 },
    rationale: 'bounds',
  },
  composition: {
    category: 'composition',
    whole: 'whole-ref',
    part: { existing: 7 },
    rationale: 'contains',
  },
  cross_reference: {
    category: 'cross_reference',
    a: 'peer-a',
    b: { existing: 8 },
    rationale: 'related',
  },
  supersession: {
    category: 'supersession',
    successor: 'successor-ref',
    predecessor: { existing: 9 },
    rationale: 'supersedes',
  },
} as const satisfies Record<(typeof EDGE_CATEGORIES)[number], RoleNamedEdgeDraft>;

describe('RoleNamedEdgeDraft', () => {
  it('covers every stored edge category exactly once', () => {
    expect(Object.keys(EDGE_DRAFT_FIXTURES).sort()).toEqual([...EDGE_CATEGORIES].sort());
  });

  it('matches metadata endpoint roles for every non-peer category', () => {
    for (const category of EDGE_CATEGORIES) {
      if (category === 'cross_reference') {
        continue;
      }

      const fixture = EDGE_DRAFT_FIXTURES[category];
      const metadata = EDGE_CATEGORY_METADATA[category];
      const endpointFields = Object.keys(fixture)
        .filter((key) => key !== 'category' && key !== 'rationale' && key !== 'stance')
        .sort();

      expect(endpointFields).toEqual([metadata.sourceRole, metadata.targetRole].sort());
    }
  });

  it('normalizes role-named drafts through category metadata', () => {
    for (const category of EDGE_CATEGORIES) {
      const fixture = EDGE_DRAFT_FIXTURES[category];
      const normalized = normalizeRoleNamedEdgeDraft(fixture);

      if (category === 'cross_reference') {
        const cross_referenceFixture = EDGE_DRAFT_FIXTURES.cross_reference;
        expect(normalized).toMatchObject({
          category,
          source: cross_referenceFixture.a,
          target: cross_referenceFixture.b,
          rationale: cross_referenceFixture.rationale,
        });
        continue;
      }

      const metadata = EDGE_CATEGORY_METADATA[category];
      expect(normalized).toMatchObject({
        category,
        source: fixture[metadata.sourceRole as keyof typeof fixture],
        target: fixture[metadata.targetRole as keyof typeof fixture],
        rationale: fixture.rationale,
      });
    }
  });

  it('preserves stance only for witness and rationale edges', () => {
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.witness).stance).toBe('for');
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.rationale).stance).toBe('against');
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.dependency).stance).toBeUndefined();

    expect(() =>
      normalizeRoleNamedEdgeDraft({
        category: 'dependency',
        dependency: 'dep-ref',
        dependent: 'dependent-ref',
        stance: 'for',
      } as unknown as RoleNamedEdgeDraft),
    ).toThrow('dependency edges do not accept stance.');

    expect(() =>
      normalizeRoleNamedEdgeDraft({
        category: 'witness',
        oracle: 'oracle-ref',
        claim: 'claim-ref',
      } as unknown as RoleNamedEdgeDraft),
    ).toThrow('witness edges require stance "for" or "against".');
  });

  it('maps cross_reference peers to storage source and target explicitly', () => {
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.cross_reference)).toEqual({
      category: 'cross_reference',
      source: 'peer-a',
      target: { existing: 8 },
      rationale: 'related',
    });
  });
});
