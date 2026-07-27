import { and, eq, type InferSelectModel } from 'drizzle-orm';

import type { EdgeRelation } from '@/shared/api-types.js';
import { reviewSetSchema, type BrunchAssistantPart, type ReviewSetData } from '@/shared/chat.js';
import { createKnowledgeReferenceCode, knowledgeKindRegistry } from '@/shared/knowledge.js';
import { normalizeReviewSetForDisplay } from '@/shared/review-diffing.js';
import { getPersistedReviewAction } from '@/shared/specification-state.js';

import type { DB } from '../db.js';
import { supportsKnowledgeRelationship } from '../knowledge-relationship-policy.js';
import { safeDeserializeAssistantParts } from '../parts.js';
import * as schema from '../schema.js';
import {
  addKnowledgeRelationship,
  createKnowledgeItem,
  linkKnowledgeItemToTurn,
  type KnowledgeItem,
} from './intent-graph-store.js';

type Turn = InferSelectModel<typeof schema.turn>;

function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

function getKnowledgeItemsForSpecificationByKind(
  db: DB,
  specificationId: number,
  kind: (typeof knowledgeKindRegistry)[number]['kind'],
): KnowledgeItem[] {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(eq(schema.knowledgeItem.specification_id, specificationId), eq(schema.knowledgeItem.kind, kind)),
    )
    .all() as KnowledgeItem[];
}

function findKnowledgeItemByReferenceCode(
  db: DB,
  specificationId: number,
  referenceCode: string,
): KnowledgeItem | undefined {
  for (const entry of knowledgeKindRegistry) {
    const item = getKnowledgeItemsForSpecificationByKind(db, specificationId, entry.kind).find(
      (candidate) => createKnowledgeReferenceCode(candidate.kind, candidate.kind_ordinal) === referenceCode,
    );
    if (item) {
      return item;
    }
  }

  return undefined;
}

function getPersistedReviewSetForTurn(turn: Pick<Turn, 'assistant_parts'> | undefined): ReviewSetData | null {
  const persistedReviewSet = safeDeserializeAssistantParts(turn?.assistant_parts).find(
    (part): part is Extract<BrunchAssistantPart, { type: 'data-review-set' }> =>
      part.type === 'data-review-set',
  );
  if (!persistedReviewSet) {
    return null;
  }

  const parsedReviewSet = reviewSetSchema.safeParse(persistedReviewSet.data);
  return parsedReviewSet.success ? parsedReviewSet.data : null;
}

function findExistingKnowledgeItemForReviewSetItem(
  db: DB,
  specificationId: number,
  kind: 'requirement' | 'criterion',
  content: string,
): KnowledgeItem | undefined {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        eq(schema.knowledgeItem.kind, kind),
        eq(schema.knowledgeItem.content, content),
      ),
    )
    .orderBy(schema.knowledgeItem.id)
    .get() as KnowledgeItem | undefined;
}

function getTurnLineageToRoot(db: DB, turnId: number): Turn[] {
  const lineage: Turn[] = [];
  let currentTurn = getTurn(db, turnId);

  while (currentTurn) {
    lineage.push(currentTurn);
    currentTurn = currentTurn.parent_turn_id ? getTurn(db, currentTurn.parent_turn_id) : undefined;
  }

  return lineage.reverse();
}

function getEffectiveAcceptedReviewSetForTurn(
  db: DB,
  turnId: number,
  phase: 'requirements' | 'criteria',
): ReviewSetData | null {
  let normalizedReviewSet: ReviewSetData | null = null;

  for (const turn of getTurnLineageToRoot(db, turnId)) {
    if (turn.phase !== phase) {
      continue;
    }

    const reviewSet = getPersistedReviewSetForTurn(turn);
    if (!reviewSet || reviewSet.phase !== phase) {
      continue;
    }

    if (turn.id !== turnId && !getPersistedReviewAction(turn)) {
      continue;
    }

    normalizedReviewSet = normalizedReviewSet
      ? normalizeReviewSetForDisplay(reviewSet, normalizedReviewSet)
      : reviewSet;

    if (turn.id === turnId) {
      return normalizedReviewSet;
    }
  }

  return normalizedReviewSet;
}

function persistReviewSetGroundingRelationships({
  db,
  specificationId,
  phase,
  sourceItem,
  grounding,
}: {
  db: DB;
  specificationId: number;
  phase: 'requirements' | 'criteria';
  sourceItem: KnowledgeItem;
  grounding: ReviewSetData['items'][number]['grounding'];
}): void {
  for (const ref of grounding ?? []) {
    const targetItem = findKnowledgeItemByReferenceCode(db, specificationId, ref.code);
    const relation: EdgeRelation =
      phase === 'criteria' && targetItem?.kind === 'requirement' ? 'verifies' : 'derived_from';

    if (
      !targetItem ||
      sourceItem.id === targetItem.id ||
      sourceItem.specification_id !== targetItem.specification_id ||
      !supportsKnowledgeRelationship(relation, sourceItem.kind, targetItem.kind)
    ) {
      continue;
    }

    addKnowledgeRelationship(db, sourceItem.id, targetItem.id, relation);
  }
}

function materializeAcceptedReviewSetItems(
  db: DB,
  specificationId: number,
  turnId: number,
  phase: 'requirements' | 'criteria',
): number[] {
  const reviewSet = getEffectiveAcceptedReviewSetForTurn(db, turnId, phase);
  if (!reviewSet || reviewSet.phase !== phase) {
    throw new Error(
      `Cannot materialize accepted ${phase} review: persisted review set is missing or mismatched on turn ${turnId}`,
    );
  }

  const kind = phase === 'requirements' ? 'requirement' : 'criterion';
  const itemIds: number[] = [];

  for (const item of reviewSet.items) {
    const existingItem = findExistingKnowledgeItemForReviewSetItem(db, specificationId, kind, item.content);
    const materializedItem =
      existingItem ??
      createKnowledgeItem(db, specificationId, kind, item.content, {
        rationale: item.rationale ?? null,
      });
    linkKnowledgeItemToTurn(db, materializedItem.id, turnId, 'reviewed');
    persistReviewSetGroundingRelationships({
      db,
      specificationId,
      phase,
      sourceItem: materializedItem,
      grounding: item.grounding,
    });
    itemIds.push(materializedItem.id);
  }

  return itemIds;
}

export function materializeAcceptedRequirementsReviewSet(
  db: DB,
  specificationId: number,
  turnId: number,
): number[] {
  return materializeAcceptedReviewSetItems(db, specificationId, turnId, 'requirements');
}

export function materializeAcceptedCriteriaReviewSet(
  db: DB,
  specificationId: number,
  turnId: number,
): number[] {
  return materializeAcceptedReviewSetItems(db, specificationId, turnId, 'criteria');
}
