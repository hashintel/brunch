// Hard-impact cascade projection over relation policy (D146, D150, I113, I118).
//
// When a hard-impact edit mutates an intent item, the server enumerates
// incident knowledge_edge rows and asks relation policy which opposite endpoint,
// if any, owes renewed judgment. Raw edge direction is only the coordinate system
// for identifying source/target endpoints; it does not itself decide cascade
// impact.

import type { EdgeRelation } from '@/shared/api-types.js';

import type { ReconciliationNeedKind } from './db.js';
import {
  getKnowledgeRelationshipChangeImpact,
  type KnowledgeRelationshipEndpoint,
} from './knowledge-relationship-policy.js';

export type CascadeRelation = EdgeRelation;

export interface CascadeChangeImpact {
  affectedEndpoint: KnowledgeRelationshipEndpoint | null;
  kind: ReconciliationNeedKind | null;
}

export function getCascadeChangeImpact(
  relation: CascadeRelation,
  changedEndpoint: KnowledgeRelationshipEndpoint,
): CascadeChangeImpact {
  return getKnowledgeRelationshipChangeImpact(relation, changedEndpoint);
}

export function relationToKind(relation: CascadeRelation): ReconciliationNeedKind {
  const impact = getCascadeChangeImpact(relation, 'target');
  if (impact.kind === null) {
    throw new Error(`Relation ${relation} has no target-change cascade kind`);
  }
  return impact.kind;
}
