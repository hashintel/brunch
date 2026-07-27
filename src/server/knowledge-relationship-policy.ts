import type { EdgeRelation } from '@/shared/api-types.js';
import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';

export type KnowledgeRelationshipEndpoint = 'source' | 'target';
export type KnowledgeRelationshipSnapshotBucket = 'dependencies' | 'dependents' | 'evidence' | 'refinements';
export type KnowledgeRelationshipChangeKind = 'needs_confirmation' | 'supersedes';

export interface KnowledgeRelationshipChangeImpact {
  affectedEndpoint: KnowledgeRelationshipEndpoint | null;
  kind: KnowledgeRelationshipChangeKind | null;
}

export interface KnowledgeRelationshipPolicy {
  relation: EdgeRelation;
  sourceKinds: readonly KnowledgeKind[];
  targetKinds: readonly KnowledgeKind[];
  sourceLabel: string;
  targetLabel: string;
  sourceSnapshotBucket: KnowledgeRelationshipSnapshotBucket;
  targetSnapshotBucket: KnowledgeRelationshipSnapshotBucket;
  sourceChanged: KnowledgeRelationshipChangeImpact;
  targetChanged: KnowledgeRelationshipChangeImpact;
}

const noChangeImpact = Object.freeze({
  affectedEndpoint: null,
  kind: null,
}) satisfies KnowledgeRelationshipChangeImpact;

export const knowledgeRelationshipPolicies = Object.freeze({
  depends_on: {
    relation: 'depends_on',
    sourceKinds: ['decision', 'assumption', 'requirement', 'criterion'],
    targetKinds: ['goal', 'context', 'constraint', 'decision', 'assumption', 'requirement'],
    sourceLabel: 'depends on',
    targetLabel: 'is depended on by',
    sourceSnapshotBucket: 'dependencies',
    targetSnapshotBucket: 'dependents',
    sourceChanged: noChangeImpact,
    targetChanged: { affectedEndpoint: 'source', kind: 'needs_confirmation' },
  },
  derived_from: {
    relation: 'derived_from',
    sourceKinds: ['context', 'constraint', 'requirement', 'criterion', 'decision', 'assumption'],
    targetKinds: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption', 'requirement'],
    sourceLabel: 'is derived from',
    targetLabel: 'is source for',
    sourceSnapshotBucket: 'dependencies',
    targetSnapshotBucket: 'dependents',
    sourceChanged: noChangeImpact,
    targetChanged: { affectedEndpoint: 'source', kind: 'supersedes' },
  },
  constrains: {
    relation: 'constrains',
    sourceKinds: ['constraint'],
    targetKinds: ['goal', 'decision', 'requirement', 'criterion'],
    sourceLabel: 'constrains',
    targetLabel: 'is constrained by',
    sourceSnapshotBucket: 'dependents',
    targetSnapshotBucket: 'dependencies',
    sourceChanged: { affectedEndpoint: 'target', kind: 'needs_confirmation' },
    targetChanged: noChangeImpact,
  },
  verifies: {
    relation: 'verifies',
    sourceKinds: ['criterion'],
    targetKinds: ['requirement'],
    sourceLabel: 'verifies',
    targetLabel: 'is verified by',
    sourceSnapshotBucket: 'evidence',
    targetSnapshotBucket: 'evidence',
    sourceChanged: { affectedEndpoint: 'target', kind: 'needs_confirmation' },
    targetChanged: { affectedEndpoint: 'source', kind: 'needs_confirmation' },
  },
  refines: {
    relation: 'refines',
    sourceKinds: knowledgeKinds,
    targetKinds: knowledgeKinds,
    sourceLabel: 'refines',
    targetLabel: 'is refined by',
    sourceSnapshotBucket: 'refinements',
    targetSnapshotBucket: 'refinements',
    sourceChanged: noChangeImpact,
    targetChanged: { affectedEndpoint: 'source', kind: 'supersedes' },
  },
}) satisfies Readonly<Record<EdgeRelation, KnowledgeRelationshipPolicy>>;

export function getKnowledgeRelationshipPolicy(relation: EdgeRelation): KnowledgeRelationshipPolicy {
  return knowledgeRelationshipPolicies[relation];
}

export function getKnowledgeRelationshipEndpointLabel(
  relation: EdgeRelation,
  endpoint: KnowledgeRelationshipEndpoint,
): string {
  const policy = getKnowledgeRelationshipPolicy(relation);
  return endpoint === 'source' ? policy.sourceLabel : policy.targetLabel;
}

export function getKnowledgeRelationshipChangeImpact(
  relation: EdgeRelation,
  changedEndpoint: KnowledgeRelationshipEndpoint,
): KnowledgeRelationshipChangeImpact {
  const policy = getKnowledgeRelationshipPolicy(relation);
  return changedEndpoint === 'source' ? policy.sourceChanged : policy.targetChanged;
}

export function supportsKnowledgeRelationship(
  relation: EdgeRelation,
  sourceKind: KnowledgeKind,
  targetKind: KnowledgeKind,
): boolean {
  const policy = getKnowledgeRelationshipPolicy(relation);
  return policy.sourceKinds.includes(sourceKind) && policy.targetKinds.includes(targetKind);
}
