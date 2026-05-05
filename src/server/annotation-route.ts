import type { Request, Response } from 'express';
import { z } from 'zod';

import type { MutationErrorResponse } from '@/shared/api-types.js';
import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';

import {
  createAnnotation,
  deleteAnnotation,
  getAnnotation,
  getAnnotationsForSpecification,
  getEntitiesForSpecificationByMode,
  getSpecification,
  type Annotation,
  type DB,
} from './db.js';

const createAnnotationRequestSchema = z
  .object({
    itemKind: z.enum(knowledgeKinds),
    itemId: z.number().int().positive(),
    summary: z.string().trim().min(1),
    body: z.string().trim(),
    selectionStart: z.number().int().nonnegative().optional(),
    selectionEnd: z.number().int().nonnegative().optional(),
  })
  .refine(
    (value) => {
      if (value.selectionStart === undefined && value.selectionEnd === undefined) return true;
      if (value.selectionStart === undefined || value.selectionEnd === undefined) return false;
      return value.selectionStart <= value.selectionEnd;
    },
    { message: 'selectionStart and selectionEnd must both be present and ordered' },
  );

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error } satisfies MutationErrorResponse);
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error } satisfies MutationErrorResponse);
}

function resolveItemId(db: DB, specificationId: number, kind: KnowledgeKind, itemId: number): number | null {
  const entities = getEntitiesForSpecificationByMode(db, specificationId, 'project-wide');
  if (kind === 'assumption') {
    return entities.assumptions.some((entity) => entity.id === itemId) ? itemId : null;
  }
  const collection = (() => {
    switch (kind) {
      case 'goal':
        return entities.goals;
      case 'term':
        return entities.terms;
      case 'context':
        return entities.contexts;
      case 'constraint':
        return entities.constraints;
      case 'requirement':
        return entities.requirements;
      case 'criterion':
        return entities.criteria;
      case 'decision':
        return entities.decisions;
    }
  })();
  return collection.some((entity) => entity.id === itemId) ? itemId : null;
}

export function handleCreateAnnotation(db: DB, req: Request, res: Response): void {
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
  const parsed = createAnnotationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid annotation payload');
    return;
  }
  const resolvedItemId = resolveItemId(db, specificationId, parsed.data.itemKind, parsed.data.itemId);
  if (resolvedItemId === null) {
    notFound(res, 'Item not found in specification');
    return;
  }
  const annotation = createAnnotation(db, specificationId, {
    knowledgeItemId: resolvedItemId,
    summary: parsed.data.summary,
    body: parsed.data.body,
    selectionStart: parsed.data.selectionStart,
    selectionEnd: parsed.data.selectionEnd,
  });
  res.status(201).json(annotation satisfies Annotation);
}

export function handleListAnnotations(db: DB, req: Request, res: Response): void {
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
  const annotations = getAnnotationsForSpecification(db, specificationId);
  res.json(annotations satisfies Annotation[]);
}

export function handleDeleteAnnotation(db: DB, req: Request, res: Response): void {
  const annotationId = Number(req.params.annotationId);
  if (Number.isNaN(annotationId)) {
    badRequest(res, 'Invalid annotation ID');
    return;
  }
  const annotation = getAnnotation(db, annotationId);
  if (!annotation) {
    res.status(204).end();
    return;
  }
  deleteAnnotation(db, annotationId);
  res.status(204).end();
}
