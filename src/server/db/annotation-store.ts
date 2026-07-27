import { eq, type InferSelectModel } from 'drizzle-orm';

import type { DB } from '../db.js';
import * as schema from '../schema.js';

export type Annotation = InferSelectModel<typeof schema.annotation>;

export interface CreateAnnotationInput {
  knowledgeItemId: number;
  summary: string;
  body: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
}

export function createAnnotation(db: DB, specificationId: number, input: CreateAnnotationInput): Annotation {
  return db
    .insert(schema.annotation)
    .values({
      specification_id: specificationId,
      knowledge_item_id: input.knowledgeItemId,
      summary: input.summary,
      body: input.body,
      selection_start: input.selectionStart ?? null,
      selection_end: input.selectionEnd ?? null,
    })
    .returning()
    .get() as Annotation;
}

export function getAnnotationsForSpecification(db: DB, specificationId: number): Annotation[] {
  return db
    .select()
    .from(schema.annotation)
    .where(eq(schema.annotation.specification_id, specificationId))
    .orderBy(schema.annotation.created_at, schema.annotation.id)
    .all() as Annotation[];
}

export function getAnnotation(db: DB, annotationId: number): Annotation | undefined {
  return db.select().from(schema.annotation).where(eq(schema.annotation.id, annotationId)).get() as
    | Annotation
    | undefined;
}

export function deleteAnnotation(db: DB, annotationId: number): void {
  db.delete(schema.annotation).where(eq(schema.annotation.id, annotationId)).run();
}
