import type { EdgeRelation } from '@/shared/api-types.js';
import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';

const relationPolicies: Record<
  EdgeRelation,
  { sourceKinds: readonly KnowledgeKind[]; targetKinds: readonly KnowledgeKind[] }
> = {
  depends_on: {
    sourceKinds: ['decision', 'assumption', 'requirement', 'criterion'],
    targetKinds: ['goal', 'context', 'constraint', 'decision', 'assumption', 'requirement'],
  },
  derived_from: {
    sourceKinds: ['context', 'constraint', 'requirement', 'criterion', 'decision', 'assumption'],
    targetKinds: ['goal', 'term', 'context', 'constraint', 'decision', 'assumption', 'requirement'],
  },
  constrains: {
    sourceKinds: ['constraint'],
    targetKinds: ['goal', 'decision', 'requirement', 'criterion'],
  },
  verifies: {
    sourceKinds: ['criterion'],
    targetKinds: ['requirement'],
  },
  refines: {
    sourceKinds: knowledgeKinds,
    targetKinds: knowledgeKinds,
  },
};

export function supportsKnowledgeRelationship(
  relation: EdgeRelation,
  sourceKind: KnowledgeKind,
  targetKind: KnowledgeKind,
): boolean {
  const policy = relationPolicies[relation];
  return policy.sourceKinds.includes(sourceKind) && policy.targetKinds.includes(targetKind);
}
