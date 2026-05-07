import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import { edgeRelationSchema, type MutationErrorResponse } from '@/shared/api-types.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';

import {
  addKnowledgeRelationship,
  getDownstreamItems,
  getKnowledgeItem,
  getSpecification,
  isItemInActiveReviewSet,
  removeKnowledgeRelationship,
  updateKnowledgeItemContent,
  type DB,
} from './db.js';
import { classifyEditImpact } from './edit-impact.js';
import { supportsKnowledgeRelationship } from './knowledge-relationship-policy.js';

// --- Schemas ---

const patchKnowledgeItemSchema = z.object({
  content: z.string().trim().min(1),
  rationale: z.string().trim().min(1).optional(),
});

const validateEdgeSchema = z.object({
  fromItemId: z.number().int().positive(),
  toItemId: z.number().int().positive(),
  relation: edgeRelationSchema,
});

const createEdgeSchema = z.object({
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

  const downstream = getDownstreamItems(db, specificationId, itemId);
  const inReviewSet = isItemInActiveReviewSet(db, specificationId, itemId);
  const impact = classifyEditImpact(downstream.length, inReviewSet);

  const affectedItems = downstream.map((d) => ({
    id: d.id,
    kind: d.kind,
    referenceCode: createKnowledgeReferenceCode(d.kind as any, d.kind_ordinal),
    content: d.content,
  }));

  if (impact === 'hard') {
    res.json({ impact, affectedItems, updated: false });
    return;
  }

  const previousContent = item.content;
  const previousRationale = item.rationale;
  updateKnowledgeItemContent(db, itemId, {
    content: parsed.data.content,
    rationale: parsed.data.rationale ?? null,
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

  const parsed = validateEdgeSchema.safeParse(req.body);
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

  const parsed = createEdgeSchema.safeParse(req.body);
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

  addKnowledgeRelationship(db, parsed.data.fromItemId, parsed.data.toItemId, parsed.data.relation);
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

  const parsed = createEdgeSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid payload');
    return;
  }

  removeKnowledgeRelationship(db, parsed.data.fromItemId, parsed.data.toItemId, parsed.data.relation);
  res.json({ deleted: true });
}
