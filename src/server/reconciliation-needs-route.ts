// V3.0 card 2: read side of the reconciliation_need queue.
//
// The producer half (open needs on hard-impact apply) shipped in card 1; this
// handler exposes those rows so the patch-list overlay can render the
// "Pending review" section. Resolution actions and the resolve endpoint
// arrive in card 3.

import type { Request, Response } from 'express';

import type { MutationErrorResponse } from '@/shared/api-types.js';

import {
  getKnowledgeItem,
  getReconciliationNeed,
  getSpecification,
  listOpenReconciliationNeeds,
  resolveReconciliationNeed,
  type DB,
  type ReconciliationNeed,
} from './db.js';

// Card 3 (V3.1 setup): the wire shape extends the persistent row with the
// target item's live current content, so the client's Edit-target inline
// form can pre-fill without mounting a separate items query. Read-time
// enrichment only — never written to the table.
export type ReconciliationNeedView = ReconciliationNeed & {
  target_current_content: string | null;
};

export interface ListOpenReconciliationNeedsResponse {
  openNeeds: ReconciliationNeedView[];
}

export interface ResolveReconciliationNeedResponse {
  resolved: true;
}

export function handleListOpenReconciliationNeeds(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    res.status(400).json({ error: 'Invalid specification ID' } satisfies MutationErrorResponse);
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    res.status(404).json({ error: 'Specification not found' } satisfies MutationErrorResponse);
    return;
  }

  // Per-row getKnowledgeItem keeps this simple at the cost of N+1 lookups;
  // open-need counts are small (single-digit per spec in practice) so a
  // join layer is premature. Promote to drizzle leftJoin if N grows or if
  // a manual walkthrough surfaces latency.
  const rows = listOpenReconciliationNeeds(db, specificationId);
  const openNeeds: ReconciliationNeedView[] = rows.map((row) => {
    const target = getKnowledgeItem(db, row.target_item_id);
    return { ...row, target_current_content: target?.content ?? null };
  });
  res.json({ openNeeds } satisfies ListOpenReconciliationNeedsResponse);
}

/**
 * V3.0 card 3: idempotent open→resolved transition for one reconciliation_need
 * row. Closes invariant I112's fifth clause. The transition does not mutate
 * any knowledge_item content — users wanting to edit the cascade target use
 * the existing inline-edit affordance separately. V3.1's reconciliation agent
 * may introduce richer resolution kinds (auto-confirm / auto-edit /
 * substantive) without changing this endpoint's contract.
 */
export function handleResolveReconciliationNeed(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  const needId = Number(req.params.needId);
  if (Number.isNaN(specificationId) || Number.isNaN(needId)) {
    res.status(400).json({ error: 'Invalid IDs' } satisfies MutationErrorResponse);
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    res.status(404).json({ error: 'Specification not found' } satisfies MutationErrorResponse);
    return;
  }

  const need = getReconciliationNeed(db, needId);
  if (!need || need.specification_id !== specificationId) {
    res.status(404).json({ error: 'Reconciliation need not found' } satisfies MutationErrorResponse);
    return;
  }

  resolveReconciliationNeed(db, needId);

  res.json({ resolved: true } satisfies ResolveReconciliationNeedResponse);
}
