// V3.0 card 2: read side of the reconciliation_need queue.
//
// The producer half (open needs on hard-impact apply) shipped in card 1; this
// handler exposes those rows so the patch-list overlay can render the
// "Pending review" section. Resolution actions and the resolve endpoint
// arrive in card 3.

import type { Request, Response } from 'express';

import type { MutationErrorResponse } from '@/shared/api-types.js';

import { getSpecification, listOpenReconciliationNeeds, type DB, type ReconciliationNeed } from './db.js';

export interface ListOpenReconciliationNeedsResponse {
  openNeeds: ReconciliationNeed[];
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

  const openNeeds = listOpenReconciliationNeeds(db, specificationId);
  res.json({ openNeeds } satisfies ListOpenReconciliationNeedsResponse);
}
