import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import { edgeRelationSchema, type MutationErrorResponse } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

import { relationToKind } from './cascade-producer.js';
import {
  addKnowledgeRelationship,
  getDownstreamEdges,
  getDownstreamItems,
  getKnowledgeItem,
  getSpecification,
  getTurn,
  isItemInActiveReviewSet,
  openReconciliationNeedIfAbsent,
  removeKnowledgeRelationship,
  updateKnowledgeItemContent,
  type DB,
} from './db.js';
import { classifyEditImpact } from './edit-impact.js';
import { supportsKnowledgeRelationship } from './knowledge-relationship-policy.js';

// --- Schemas ---

const patchKnowledgeItemSchema = z.object({
  content: z.string().trim().min(1),
  rationale: z.string().trim().min(1).nullable().optional(),
  causedByTurnId: z.number().int().positive().optional(),
});

const edgeMutationSchema = z.object({
  fromItemId: z.number().int().positive(),
  toItemId: z.number().int().positive(),
  relation: edgeRelationSchema,
});

// --- Helpers ---

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error } satisfies MutationErrorResponse);
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error } satisfies MutationErrorResponse);
}

// --- Handlers ---

export function handlePatchKnowledgeItem(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  const itemId = Number(req.params.itemId);
  if (Number.isNaN(specificationId) || Number.isNaN(itemId)) {
    badRequest(res, 'Invalid IDs');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const item = getKnowledgeItem(db, itemId);
  if (!item || item.specification_id !== specificationId) {
    notFound(res, 'Knowledge item not found');
    return;
  }

  const parsed = patchKnowledgeItemSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid payload');
    return;
  }

  if (parsed.data.causedByTurnId != null) {
    const turn = getTurn(db, parsed.data.causedByTurnId);
    if (!turn || turn.specification_id !== specificationId) {
      badRequest(res, 'Invalid causedByTurnId');
      return;
    }
  }

  const downstream = getDownstreamItems(db, specificationId, itemId);
  const inReviewSet =
    isItemInActiveReviewSet(db, specificationId, itemId) ||
    downstream.some((downstreamItem) => isItemInActiveReviewSet(db, specificationId, downstreamItem.id));
  const impact = classifyEditImpact(downstream.length, inReviewSet);

  const affectedItems = downstream.map((d) => ({
    id: d.id,
    kind: d.kind,
    referenceCode: createKnowledgeReferenceCode(d.kind as any, d.kind_ordinal),
    content: d.content,
  }));

  const previousContent = item.content;
  const previousRationale = item.rationale;

  if (impact === 'hard') {
    // V3.0 (D139, I112): apply the source change AND open one
    // reconciliation_need per typed dependency edge incident on the changed
    // item. The partial unique index on (source, target, kind) makes
    // re-application idempotent. The patch list overlay surfaces these needs
    // as a Pending review section in card 2; for now the V2 client banner
    // continues to render off `impact === 'hard'`.
    const downstreamEdges = getDownstreamEdges(db, specificationId, itemId);
    const openedNeedIds = db.transaction((tx) => {
      updateKnowledgeItemContent(tx as unknown as DB, itemId, {
        content: parsed.data.content,
        rationale: parsed.data.rationale,
      });
      const opened: number[] = [];
      for (const edge of downstreamEdges) {
        const need = openReconciliationNeedIfAbsent(tx as unknown as DB, {
          specificationId,
          sourceItemId: itemId,
          targetItemId: edge.downstream_item_id,
          kind: relationToKind(edge.relation),
          causedByTurnId: parsed.data.causedByTurnId ?? null,
        });
        if (need !== null) opened.push(need.id);
      }
      return opened;
    });
    res.json({
      impact,
      affectedItems,
      updated: true,
      previousContent,
      previousRationale,
      openedNeedIds,
    });
    return;
  }

  updateKnowledgeItemContent(db, itemId, {
    content: parsed.data.content,
    rationale: parsed.data.rationale,
  });
  res.json({ impact, affectedItems, updated: true, previousContent, previousRationale });
}

export function handleValidateKnowledgeEdge(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    badRequest(res, 'Invalid specification ID');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const parsed = edgeMutationSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid payload');
    return;
  }

  const fromItem = getKnowledgeItem(db, parsed.data.fromItemId);
  const toItem = getKnowledgeItem(db, parsed.data.toItemId);

  if (!fromItem || fromItem.specification_id !== specificationId) {
    res.json({ valid: false, reason: 'Source item not found' });
    return;
  }
  if (!toItem || toItem.specification_id !== specificationId) {
    res.json({ valid: false, reason: 'Target item not found' });
    return;
  }

  const valid = supportsKnowledgeRelationship(parsed.data.relation, fromItem.kind, toItem.kind);
  res.json(
    valid ? { valid: true } : { valid: false, reason: 'Relationship not allowed between these item kinds' },
  );
}

export function handleCreateKnowledgeEdge(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    badRequest(res, 'Invalid specification ID');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const parsed = edgeMutationSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid payload');
    return;
  }

  const fromItem = getKnowledgeItem(db, parsed.data.fromItemId);
  const toItem = getKnowledgeItem(db, parsed.data.toItemId);

  if (!fromItem || fromItem.specification_id !== specificationId) {
    res.json({ created: false, reason: 'Source item not found' });
    return;
  }
  if (!toItem || toItem.specification_id !== specificationId) {
    res.json({ created: false, reason: 'Target item not found' });
    return;
  }

  const valid = supportsKnowledgeRelationship(parsed.data.relation, fromItem.kind, toItem.kind);
  if (!valid) {
    res.json({ created: false, reason: 'Relationship not allowed between these item kinds' });
    return;
  }

  const created = addKnowledgeRelationship(
    db,
    parsed.data.fromItemId,
    parsed.data.toItemId,
    parsed.data.relation,
  );
  if (!created) {
    res.json({ created: false, alreadyExisted: true });
    return;
  }
  res.status(201).json({ created: true });
}

export function handleDeleteKnowledgeEdge(db: DB, req: Request, res: Response): void {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    badRequest(res, 'Invalid specification ID');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const parsed = edgeMutationSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid payload');
    return;
  }

  const fromItem = getKnowledgeItem(db, parsed.data.fromItemId);
  const toItem = getKnowledgeItem(db, parsed.data.toItemId);

  if (!fromItem || fromItem.specification_id !== specificationId) {
    res.json({ deleted: false, reason: 'Source item not found' });
    return;
  }
  if (!toItem || toItem.specification_id !== specificationId) {
    res.json({ deleted: false, reason: 'Target item not found' });
    return;
  }

  const deleted = removeKnowledgeRelationship(
    db,
    parsed.data.fromItemId,
    parsed.data.toItemId,
    parsed.data.relation,
  );
  res.json({ deleted });
}
