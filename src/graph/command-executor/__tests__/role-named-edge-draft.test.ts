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
  proof: {
    category: 'proof',
    oracle: 'oracle-ref',
    claim: { existing: 2 },
    stance: 'for',
    rationale: 'proves',
  },
  support: {
    category: 'support',
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
  boundary: {
    category: 'boundary',
    boundary: 'boundary-ref',
    subject: { existing: 5 },
    rationale: 'bounds',
  },
  composition: {
    category: 'composition',
    whole: 'whole-ref',
    part: { existing: 6 },
    rationale: 'contains',
  },
  association: {
    category: 'association',
    a: 'peer-a',
    b: { existing: 7 },
    rationale: 'related',
  },
  supersession: {
    category: 'supersession',
    successor: 'successor-ref',
    predecessor: { existing: 8 },
    rationale: 'supersedes',
  },
} as const satisfies Record<(typeof EDGE_CATEGORIES)[number], RoleNamedEdgeDraft>;

describe('RoleNamedEdgeDraft', () => {
  it('covers every stored edge category exactly once', () => {
    expect(Object.keys(EDGE_DRAFT_FIXTURES).sort()).toEqual([...EDGE_CATEGORIES].sort());
  });

  it('matches metadata endpoint roles for every non-peer category', () => {
    for (const category of EDGE_CATEGORIES) {
      if (category === 'association') {
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

      if (category === 'association') {
        const associationFixture = EDGE_DRAFT_FIXTURES.association;
        expect(normalized).toMatchObject({
          category,
          source: associationFixture.a,
          target: associationFixture.b,
          rationale: associationFixture.rationale,
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

  it('preserves stance only for proof and support edges', () => {
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.proof).stance).toBe('for');
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.support).stance).toBe('against');
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
        category: 'proof',
        oracle: 'oracle-ref',
        claim: 'claim-ref',
      } as unknown as RoleNamedEdgeDraft),
    ).toThrow('proof edges require stance "for" or "against".');
  });

  it('maps association peers to storage source and target explicitly', () => {
    expect(normalizeRoleNamedEdgeDraft(EDGE_DRAFT_FIXTURES.association)).toEqual({
      category: 'association',
      source: 'peer-a',
      target: { existing: 7 },
      rationale: 'related',
    });
  });
});
