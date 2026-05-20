import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

import { getCascadeChangeImpact } from './cascade-producer.js';
import {
  getCascadeIncidentEdges,
  getKnowledgeItem,
  isItemInActiveReviewSet,
  type DB,
  type ReconciliationNeedKind,
} from './db.js';
import { classifyEditImpact, type EditImpactTier } from './edit-impact.js';

export interface EditImpactAffectedItem {
  id: number;
  kind: string;
  referenceCode: string;
  content: string;
}

export interface EditImpactCascadeNeed {
  affectedItemId: number;
  kind: ReconciliationNeedKind;
}

export interface KnowledgeItemEditImpactProjection {
  impact: EditImpactTier;
  affectedItems: EditImpactAffectedItem[];
  cascadeNeeds: EditImpactCascadeNeed[];
}

export function buildKnowledgeItemEditImpactProjection(
  db: DB,
  specificationId: number,
  itemId: number,
): KnowledgeItemEditImpactProjection {
  const incidentEdges = getCascadeIncidentEdges(db, specificationId, itemId);
  const cascadeNeeds = incidentEdges.flatMap((edge) => {
    const impact = getCascadeChangeImpact(edge.relation, edge.changed_endpoint);
    if (impact.affectedEndpoint === null || impact.kind === null) return [];
    const affectedItemId = impact.affectedEndpoint === 'source' ? edge.source_item_id : edge.target_item_id;
    if (affectedItemId === itemId) return [];
    return [{ affectedItemId, kind: impact.kind }];
  });

  const affectedItemIds = [...new Set(cascadeNeeds.map((need) => need.affectedItemId))];
  const affectedItems = affectedItemIds.flatMap((affectedItemId) => {
    const affectedItem = getKnowledgeItem(db, affectedItemId);
    if (!affectedItem || affectedItem.specification_id !== specificationId) return [];
    return [
      {
        id: affectedItem.id,
        kind: affectedItem.kind,
        referenceCode: createKnowledgeReferenceCode(affectedItem.kind, affectedItem.kind_ordinal),
        content: affectedItem.content,
      },
    ];
  });

  const hasActiveReviewSetMembership =
    isItemInActiveReviewSet(db, specificationId, itemId) ||
    affectedItems.some((affectedItem) => isItemInActiveReviewSet(db, specificationId, affectedItem.id));

  return {
    impact: classifyEditImpact(affectedItems.length, hasActiveReviewSetMembership),
    affectedItems,
    cascadeNeeds,
  };
}
