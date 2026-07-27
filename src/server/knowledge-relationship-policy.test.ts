import { describe, expect, it } from 'vitest';

import { edgeRelationSchema, type EdgeRelation } from '@/shared/api-types.js';

import {
  getKnowledgeRelationshipChangeImpact,
  getKnowledgeRelationshipEndpointLabel,
  knowledgeRelationshipPolicies,
  supportsKnowledgeRelationship,
} from './knowledge-relationship-policy.js';

const edgeRelations = edgeRelationSchema.options;

describe('knowledge relationship policy registry', () => {
  it('declares endpoint validation, labels, snapshot buckets, and change impact for every relation', () => {
    expect(Object.keys(knowledgeRelationshipPolicies).sort()).toEqual([...edgeRelations].sort());

    expect(knowledgeRelationshipPolicies).toMatchObject({
      depends_on: {
        sourceSnapshotBucket: 'dependencies',
        targetSnapshotBucket: 'dependents',
        sourceChanged: { affectedEndpoint: null, kind: null },
        targetChanged: { affectedEndpoint: 'source', kind: 'needs_confirmation' },
      },
      derived_from: {
        sourceSnapshotBucket: 'dependencies',
        targetSnapshotBucket: 'dependents',
        sourceChanged: { affectedEndpoint: null, kind: null },
        targetChanged: { affectedEndpoint: 'source', kind: 'supersedes' },
      },
      constrains: {
        sourceSnapshotBucket: 'dependents',
        targetSnapshotBucket: 'dependencies',
        sourceChanged: { affectedEndpoint: 'target', kind: 'needs_confirmation' },
        targetChanged: { affectedEndpoint: null, kind: null },
      },
      verifies: {
        sourceSnapshotBucket: 'evidence',
        targetSnapshotBucket: 'evidence',
        sourceChanged: { affectedEndpoint: 'target', kind: 'needs_confirmation' },
        targetChanged: { affectedEndpoint: 'source', kind: 'needs_confirmation' },
      },
      refines: {
        sourceSnapshotBucket: 'refinements',
        targetSnapshotBucket: 'refinements',
        sourceChanged: { affectedEndpoint: null, kind: null },
        targetChanged: { affectedEndpoint: 'source', kind: 'supersedes' },
      },
    });

    for (const relation of edgeRelations) {
      const policy = knowledgeRelationshipPolicies[relation];

      expect(policy.relation).toBe(relation);
      expect(policy.sourceKinds.length).toBeGreaterThan(0);
      expect(policy.targetKinds.length).toBeGreaterThan(0);
      expect(policy.sourceLabel.length).toBeGreaterThan(0);
      expect(policy.targetLabel.length).toBeGreaterThan(0);
    }
  });

  it('preserves existing allow/deny behavior through supportsKnowledgeRelationship()', () => {
    const cases: Array<
      [
        EdgeRelation,
        Parameters<typeof supportsKnowledgeRelationship>[1],
        Parameters<typeof supportsKnowledgeRelationship>[2],
        boolean,
      ]
    > = [
      ['depends_on', 'requirement', 'goal', true],
      ['depends_on', 'goal', 'requirement', false],
      ['derived_from', 'context', 'goal', true],
      ['derived_from', 'goal', 'context', false],
      ['constrains', 'constraint', 'requirement', true],
      ['constrains', 'decision', 'requirement', false],
      ['verifies', 'criterion', 'requirement', true],
      ['verifies', 'requirement', 'criterion', false],
      ['refines', 'term', 'assumption', true],
    ];

    for (const [relation, sourceKind, targetKind, expected] of cases) {
      expect(supportsKnowledgeRelationship(relation, sourceKind, targetKind)).toBe(expected);
    }
  });

  it('renders endpoint-relative labels without reversing raw relation names', () => {
    expect(getKnowledgeRelationshipEndpointLabel('depends_on', 'source')).toBe('depends on');
    expect(getKnowledgeRelationshipEndpointLabel('depends_on', 'target')).toBe('is depended on by');

    expect(getKnowledgeRelationshipEndpointLabel('constrains', 'source')).toBe('constrains');
    expect(getKnowledgeRelationshipEndpointLabel('constrains', 'target')).toBe('is constrained by');

    expect(getKnowledgeRelationshipEndpointLabel('verifies', 'source')).toBe('verifies');
    expect(getKnowledgeRelationshipEndpointLabel('verifies', 'target')).toBe('is verified by');
  });

  it('returns explicit change-impact policy for source and target endpoint changes', () => {
    expect(getKnowledgeRelationshipChangeImpact('depends_on', 'source')).toEqual({
      affectedEndpoint: null,
      kind: null,
    });
    expect(getKnowledgeRelationshipChangeImpact('depends_on', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'needs_confirmation',
    });

    expect(getKnowledgeRelationshipChangeImpact('derived_from', 'source')).toEqual({
      affectedEndpoint: null,
      kind: null,
    });
    expect(getKnowledgeRelationshipChangeImpact('derived_from', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'supersedes',
    });

    expect(getKnowledgeRelationshipChangeImpact('constrains', 'source')).toEqual({
      affectedEndpoint: 'target',
      kind: 'needs_confirmation',
    });
    expect(getKnowledgeRelationshipChangeImpact('constrains', 'target')).toEqual({
      affectedEndpoint: null,
      kind: null,
    });

    expect(getKnowledgeRelationshipChangeImpact('verifies', 'source')).toEqual({
      affectedEndpoint: 'target',
      kind: 'needs_confirmation',
    });
    expect(getKnowledgeRelationshipChangeImpact('verifies', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'needs_confirmation',
    });

    expect(getKnowledgeRelationshipChangeImpact('refines', 'source')).toEqual({
      affectedEndpoint: null,
      kind: null,
    });
    expect(getKnowledgeRelationshipChangeImpact('refines', 'target')).toEqual({
      affectedEndpoint: 'source',
      kind: 'supersedes',
    });
  });
});
