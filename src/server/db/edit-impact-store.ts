import { sql } from 'drizzle-orm';

import type { DB } from '../db.js';

export interface DownstreamItem {
  id: number;
  kind: string;
  content: string;
  kind_ordinal: number;
}

/** Direct downstream items: items whose edges point TO the given item. */
export function getDownstreamItems(db: DB, specificationId: number, itemId: number): DownstreamItem[] {
  return db.all(sql`
    SELECT ki.id, ki.kind, ki.content, ki.kind_ordinal
    FROM knowledge_edge ke
    JOIN knowledge_item ki ON ki.id = ke.from_item_id
    WHERE ke.to_item_id = ${itemId}
      AND ki.specification_id = ${specificationId}
    ORDER BY ki.id
  `) as DownstreamItem[];
}

export interface DownstreamEdge {
  downstream_item_id: number;
  relation: 'depends_on' | 'derived_from' | 'constrains' | 'verifies' | 'refines';
}

/**
 * Like `getDownstreamItems` but preserves the edge relation alongside each
 * downstream item id. V3.0 cascade enumeration uses this to map each downstream
 * pair to a `reconciliation_need.kind`. The same (item_id, relation) tuple
 * yields one row even if the same downstream item appears via multiple
 * relations — the queue partial unique index dedupes by (source, target, kind).
 */
export function getDownstreamEdges(db: DB, specificationId: number, itemId: number): DownstreamEdge[] {
  return db.all(sql`
    SELECT ke.from_item_id AS downstream_item_id, ke.relation
    FROM knowledge_edge ke
    JOIN knowledge_item ki ON ki.id = ke.from_item_id
    WHERE ke.to_item_id = ${itemId}
      AND ki.specification_id = ${specificationId}
    ORDER BY ke.from_item_id, ke.relation
  `) as DownstreamEdge[];
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
