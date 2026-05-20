import { sql } from 'drizzle-orm';

import type { DB } from '../db.js';

export interface CascadeIncidentEdge {
  source_item_id: number;
  target_item_id: number;
  changed_endpoint: 'source' | 'target';
  relation: 'depends_on' | 'derived_from' | 'constrains' | 'verifies' | 'refines';
}

/**
 * Enumerate all graph edges incident on the edited item. Relation policy, not
 * this raw source/target coordinate system, decides which opposite endpoint is
 * affected by the edit.
 */
export function getCascadeIncidentEdges(
  db: DB,
  specificationId: number,
  itemId: number,
): CascadeIncidentEdge[] {
  return db.all(sql`
    SELECT
      ke.from_item_id AS source_item_id,
      ke.to_item_id AS target_item_id,
      CASE WHEN ke.from_item_id = ${itemId} THEN 'source' ELSE 'target' END AS changed_endpoint,
      ke.relation
    FROM knowledge_edge ke
    JOIN knowledge_item source ON source.id = ke.from_item_id
    JOIN knowledge_item target ON target.id = ke.to_item_id
    WHERE (ke.from_item_id = ${itemId} OR ke.to_item_id = ${itemId})
      AND source.specification_id = ${specificationId}
      AND target.specification_id = ${specificationId}
    ORDER BY ke.from_item_id, ke.to_item_id, ke.relation
  `) as CascadeIncidentEdge[];
}

/**
 * An item is in an active review set if there is a `phase_outcome` with
 * `status = 'proposed'` for requirements or criteria, AND the item has a
 * `turn_knowledge_item` row linking it to that outcome's `proposal_turn_id`
 * with relation `'reviewed'`.
 */
export function isItemInActiveReviewSet(db: DB, specificationId: number, itemId: number): boolean {
  const rows = db.all(sql`
    SELECT 1
    FROM phase_outcome po
    JOIN turn_knowledge_item tki
      ON tki.turn_id = po.proposal_turn_id
      AND tki.item_id = ${itemId}
      AND tki.relation = 'reviewed'
    WHERE po.specification_id = ${specificationId}
      AND po.status = 'proposed'
      AND po.phase IN ('requirements', 'criteria')
    LIMIT 1
  `);
  return rows.length > 0;
}
