import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

import type {
  CriterionEntity as SharedCriterionEntity,
  EntitiesData,
  EntityReference as SharedEntityReference,
  EntityRelationship as SharedEntityRelationship,
  SpecificationMode,
  SpecificationStateTurn,
  ReadinessBand,
  TurnKind,
  RequirementEntity as SharedRequirementEntity,
  WorkflowPhaseState as SharedWorkflowPhaseState,
  WorkflowPhaseStatus,
  WorkflowState as SharedWorkflowState,
} from '@/shared/api-types.js';
import {
  createKnowledgeReferenceCode,
  genericKnowledgeKindRegistry,
  knowledgeEntityCollectionByKind,
  knowledgeKindRegistry,
  type GenericKnowledgeCollectionKey,
  type GenericKnowledgeKind,
  type KnowledgeEntityCollection,
  type KnowledgeKind as SharedKnowledgeKind,
} from '@/shared/knowledge.js';
import {
  parsePhaseClosureCommand,
  workflowPhaseOrder,
  type PhaseClosureBasis,
} from '@/shared/phase-close.js';

import { safeDeserializeUserParts, type DataConfirmationPart } from './parts.js';
import * as schema from './schema.js';
import { projectWorkflowState, type WorkflowProjectionSnapshot } from './workflow-projector.js';

export {
  createAnnotation,
  deleteAnnotation,
  getAnnotation,
  getAnnotationsForSpecification,
} from './db/annotation-store.js';
export type { Annotation, CreateAnnotationInput } from './db/annotation-store.js';

export { getDownstreamEdges, getDownstreamItems, isItemInActiveReviewSet } from './db/edit-impact-store.js';
export type { DownstreamEdge, DownstreamItem } from './db/edit-impact-store.js';

import {
  addKnowledgeRelationship,
  createKnowledgeItem,
  linkKnowledgeItemToTurn,
} from './db/intent-graph-store.js';
import type { Assumption, Decision, KnowledgeItem, KnowledgeKind } from './db/intent-graph-store.js';
export {
  addAssumptionParentAssumption,
  addDecisionParentAssumption,
  addDecisionParentDecision,
  addKnowledgeRelationship,
  createAssumption,
  createDecision,
  createKnowledgeItem,
  getKnowledgeItem,
  linkAssumptionToTurn,
  linkDecisionToTurn,
  linkKnowledgeItemToTurn,
  removeKnowledgeRelationship,
  updateKnowledgeItemContent,
} from './db/intent-graph-store.js';
export type { Assumption, Decision, KnowledgeItem, KnowledgeKind } from './db/intent-graph-store.js';

export {
  materializeAcceptedCriteriaReviewSet,
  materializeAcceptedRequirementsReviewSet,
} from './db/review-materialization-store.js';

export {
  claimReconciliationNeedForClassification,
  getCascadeRelationBetween,
  getReconciliationNeed,
  listOpenReconciliationNeeds,
  listOpenReconciliationNeedsAwaitingClassification,
  openReconciliationNeed,
  openReconciliationNeedIfAbsent,
  resolveReconciliationNeed,
  updateReconciliationNeedAgentFields,
} from './db/reconciliation-store.js';
export type {
  OpenReconciliationNeedInput,
  ReconciliationNeed,
  ReconciliationNeedAgentClassification,
  ReconciliationNeedAgentStatus,
  ReconciliationNeedKind,
} from './db/reconciliation-store.js';

export type DB = ReturnType<typeof drizzle<typeof schema>>;
export type Specification = InferSelectModel<typeof schema.specification>;
type PersistedTurn = InferSelectModel<typeof schema.turn>;
export type Turn = Omit<PersistedTurn, 'specification_id'> & {
  specification_id: number;
};
export type Option = InferSelectModel<typeof schema.option>;
export type PhaseOutcome = InferSelectModel<typeof schema.phaseOutcome>;
export type Phase = Turn['phase'];
export type Impact = NonNullable<Turn['impact']>;
export type PhaseOutcomeStatus = PhaseOutcome['status'];
export type { WorkflowPhaseStatus, ReadinessBand };
export type ClosureBasis = PhaseClosureBasis | null;

export type WorkflowPhaseState = SharedWorkflowPhaseState;
export type WorkflowState = SharedWorkflowState;

export interface CreatePhaseOutcomeInput {
  specificationId?: number;
  phase: Phase;
  proposal_turn_id: number;
  summary: string;
}

export interface CreateTurnInput {
  parent_turn_id?: number | null;
  phase: Phase;
  turn_kind?: TurnKind;
  question: string;
  why?: string | null;
  impact?: Impact | null;
  answer?: string | null;
  is_resolution?: boolean;
  user_parts?: string | null;
  assistant_parts?: string | null;
}

export interface CreateOptionInput {
  position: number;
  content: string;
  is_recommended?: boolean;
  is_selected?: boolean;
}

export function createDb(path: string = ':memory:'): DB {
  const sqlite = new Database(path);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return db;
}

export function getOrCreateSpecification(db: DB, name = 'default'): Specification {
  const existing = db
    .select()
    .from(schema.specification)
    .orderBy(desc(schema.specification.created_at))
    .limit(1)
    .get();
  if (existing) return existing as Specification;
  return insertSpecificationWithInterviewChat(db, { name });
}

export function listSpecifications(db: DB): Specification[] {
  return db
    .select()
    .from(schema.specification)
    .orderBy(desc(schema.specification.updated_at))
    .all() as Specification[];
}

export interface CreateSpecificationOptions {
  mode?: SpecificationMode;
}

export function createSpecification(
  db: DB,
  name: string,
  options?: CreateSpecificationOptions,
): Specification {
  return insertSpecificationWithInterviewChat(db, {
    name,
    ...(options?.mode ? { mode: options.mode } : {}),
  });
}

function insertSpecificationWithInterviewChat(
  db: DB,
  values: { name: string; mode?: SpecificationMode },
): Specification {
  return db.transaction((tx) => {
    const inserted = tx.insert(schema.specification).values(values).returning().get() as Specification;
    const chatRow = tx
      .insert(schema.chat)
      .values({ specification_id: inserted.id, kind: 'interview' })
      .returning({ id: schema.chat.id })
      .get();
    const updated = tx
      .update(schema.specification)
      .set({ primary_chat_id: chatRow.id })
      .where(eq(schema.specification.id, inserted.id))
      .returning()
      .get();
    return updated as Specification;
  });
}

function getInterviewChatIdForSpecification(db: DB, specificationId: number): number {
  const spec = db
    .select({ primary_chat_id: schema.specification.primary_chat_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!spec?.primary_chat_id) {
    throw new Error(`Specification ${specificationId} has no primary_chat_id; substrate invariant violated`);
  }
  return spec.primary_chat_id;
}

export function getSpecification(db: DB, id: number): Specification | undefined {
  return db.select().from(schema.specification).where(eq(schema.specification.id, id)).get() as
    | Specification
    | undefined;
}

export function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

export function createTurn(db: DB, specificationId: number, input: CreateTurnInput): Turn {
  const chatId = getInterviewChatIdForSpecification(db, specificationId);

  if (input.parent_turn_id != null) {
    const parent = db
      .select({ chat_id: schema.turn.chat_id })
      .from(schema.turn)
      .where(eq(schema.turn.id, input.parent_turn_id))
      .get();
    if (!parent) {
      throw new Error(`Parent turn ${input.parent_turn_id} not found`);
    }
    if (parent.chat_id !== chatId) {
      throw new Error(
        `Parent turn ${input.parent_turn_id} lives in chat ${parent.chat_id}, ` +
          `not chat ${chatId} — parent_turn_id must share chat_id with the new turn`,
      );
    }
  }

  const result = db
    .insert(schema.turn)
    .values({
      specification_id: specificationId,
      chat_id: chatId,
      parent_turn_id: input.parent_turn_id ?? null,
      phase: input.phase,
      turn_kind: input.turn_kind ?? 'question',
      question: input.question,
      why: input.why ?? null,
      impact: input.impact ?? null,
      answer: input.answer ?? null,
      is_resolution: input.is_resolution ?? false,
      user_parts: input.user_parts ?? null,
      assistant_parts: input.assistant_parts ?? null,
    })
    .returning()
    .get();
  return result as Turn;
}

export interface UpdateTurnInput {
  question?: string;
  answer?: string;
  why?: string | null;
  impact?: Impact | null;
  user_parts?: string | null;
  assistant_parts?: string | null;
}

export function updateTurn(db: DB, turnId: number, updates: UpdateTurnInput): void {
  if (
    updates.question === undefined &&
    updates.answer === undefined &&
    updates.why === undefined &&
    updates.impact === undefined &&
    updates.user_parts === undefined &&
    updates.assistant_parts === undefined
  )
    return;
  const values: Record<string, unknown> = {};
  if (updates.question !== undefined) values.question = updates.question;
  if (updates.answer !== undefined) values.answer = updates.answer;
  if (updates.why !== undefined) values.why = updates.why;
  if (updates.impact !== undefined) values.impact = updates.impact;
  if (updates.user_parts !== undefined) values.user_parts = updates.user_parts;
  if (updates.assistant_parts !== undefined) values.assistant_parts = updates.assistant_parts;
  db.update(schema.turn).set(values).where(eq(schema.turn.id, turnId)).run();
}

export function createOption(db: DB, turnId: number, input: CreateOptionInput): Option {
  const result = db
    .insert(schema.option)
    .values({
      turn_id: turnId,
      position: input.position,
      content: input.content,
      is_recommended: input.is_recommended ?? false,
      is_selected: input.is_selected ?? false,
    })
    .returning()
    .get();
  return result as Option;
}

export function getActivePath(db: DB, specificationId: number): Turn[] {
  const project = db
    .select({ active_turn_id: schema.specification.active_turn_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!project?.active_turn_id) return [];

  // Recursive CTE — raw SQL via Drizzle's sql tag
  const rows = db.all(sql`
		WITH RECURSIVE path AS (
			SELECT * FROM turn WHERE id = ${project.active_turn_id}
			UNION ALL
			SELECT t.* FROM turn t JOIN path p ON t.id = p.parent_turn_id
		)
		SELECT * FROM path ORDER BY id ASC
	`);
  return rows as Turn[];
}

export function listPhaseOutcomesForSpecification(db: DB, specificationId: number): PhaseOutcome[] {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(eq(schema.phaseOutcome.specification_id, specificationId))
    .orderBy(desc(schema.phaseOutcome.id))
    .all() as PhaseOutcome[];
}

function reconcilePhaseOutcomesForSpecification(db: DB, specificationId: number): void {
  const activeTurnIds = new Set(getActivePath(db, specificationId).map((turn) => turn.id));
  const outcomesToSupersede = listPhaseOutcomesForSpecification(db, specificationId).filter(
    (outcome) =>
      (outcome.status === 'proposed' || outcome.status === 'confirmed') &&
      !activeTurnIds.has(outcome.proposal_turn_id),
  );

  for (const outcome of outcomesToSupersede) {
    db.update(schema.phaseOutcome)
      .set({
        status: 'superseded',
        superseded_at: sql`datetime('now')`,
      })
      .where(eq(schema.phaseOutcome.id, outcome.id))
      .run();
  }
}

export function createPhaseOutcome(db: DB, input: CreatePhaseOutcomeInput): PhaseOutcome {
  const { specificationId } = input;
  if (!specificationId) {
    throw new Error('createPhaseOutcome requires specificationId');
  }

  const result = db
    .insert(schema.phaseOutcome)
    .values({
      specification_id: specificationId,
      phase: input.phase,
      proposal_turn_id: input.proposal_turn_id,
      summary: input.summary,
      status: 'proposed',
    })
    .returning()
    .get();
  return result as PhaseOutcome;
}

function getClosureBasisForConfirmationTurn(db: DB, confirmationTurnId: number): PhaseClosureBasis {
  const confirmationTurn = getTurn(db, confirmationTurnId);
  const confirmationPart = safeDeserializeUserParts(confirmationTurn?.user_parts).find(
    (part): part is DataConfirmationPart => part.type === 'data-confirmation',
  );
  const phaseClosureCommand = confirmationPart ? parsePhaseClosureCommand(confirmationPart.data) : null;

  return phaseClosureCommand?.closureBasis ?? 'interviewer_recommended';
}

export function confirmPhaseOutcome(db: DB, phaseOutcomeId: number, confirmationTurnId: number): void {
  db.update(schema.phaseOutcome)
    .set({
      status: 'confirmed',
      closure_basis: getClosureBasisForConfirmationTurn(db, confirmationTurnId),
      confirmation_turn_id: confirmationTurnId,
      confirmed_at: sql`datetime('now')`,
    })
    .where(eq(schema.phaseOutcome.id, phaseOutcomeId))
    .run();
}

export function supersedePhaseOutcome(db: DB, phaseOutcomeId: number): void {
  db.update(schema.phaseOutcome)
    .set({
      status: 'superseded',
      superseded_at: sql`datetime('now')`,
    })
    .where(eq(schema.phaseOutcome.id, phaseOutcomeId))
    .run();
}

export function createConfirmedPhaseOutcome(
  db: DB,
  input: CreatePhaseOutcomeInput & { confirmation_turn_id: number },
): PhaseOutcome {
  const { specificationId } = input;
  if (!specificationId) {
    throw new Error('createConfirmedPhaseOutcome requires specificationId');
  }

  const result = db
    .insert(schema.phaseOutcome)
    .values({
      specification_id: specificationId,
      phase: input.phase,
      proposal_turn_id: input.proposal_turn_id,
      summary: input.summary,
      status: 'confirmed',
      closure_basis: getClosureBasisForConfirmationTurn(db, input.confirmation_turn_id),
      confirmation_turn_id: input.confirmation_turn_id,
      confirmed_at: sql`datetime('now')`,
    })
    .returning()
    .get();
  return result as PhaseOutcome;
}

export function findProposedPhaseOutcomeByTurn(
  db: DB,
  specificationId: number,
  proposalTurnId: number,
): PhaseOutcome | undefined {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(
      and(
        eq(schema.phaseOutcome.specification_id, specificationId),
        eq(schema.phaseOutcome.proposal_turn_id, proposalTurnId),
        eq(schema.phaseOutcome.status, 'proposed'),
      ),
    )
    .orderBy(desc(schema.phaseOutcome.id))
    .get() as PhaseOutcome | undefined;
}

export function findPhaseOutcomeForTurn(
  db: DB,
  specificationId: number,
  proposalTurnId: number,
): PhaseOutcome | undefined {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(
      and(
        eq(schema.phaseOutcome.specification_id, specificationId),
        eq(schema.phaseOutcome.proposal_turn_id, proposalTurnId),
      ),
    )
    .orderBy(desc(schema.phaseOutcome.id))
    .get() as PhaseOutcome | undefined;
}

function getClosureBasisForOutcome(outcome: PhaseOutcome | undefined): ClosureBasis {
  if (!outcome || outcome.status !== 'confirmed' || !outcome.confirmation_turn_id) {
    return null;
  }

  return outcome.closure_basis ?? null;
}

function findConfirmedPhaseOutcomeOnActivePath(
  db: DB,
  specificationId: number,
  phase: Phase,
): PhaseOutcome | undefined {
  const activeTurnIds = new Set(getActivePath(db, specificationId).map((turn) => turn.id));
  if (activeTurnIds.size === 0) {
    return undefined;
  }

  return listPhaseOutcomesForSpecification(db, specificationId).find(
    (outcome) =>
      outcome.phase === phase &&
      outcome.status === 'confirmed' &&
      activeTurnIds.has(outcome.proposal_turn_id),
  );
}

function getAcceptedKnowledgeItemIdsForPhase(
  db: DB,
  specificationId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): Set<number> {
  const confirmationTurnId = findConfirmedPhaseOutcomeOnActivePath(
    db,
    specificationId,
    phase,
  )?.confirmation_turn_id;
  if (!confirmationTurnId) {
    return new Set();
  }

  const rows = db
    .select({ itemId: schema.turnKnowledgeItem.item_id })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        eq(schema.knowledgeItem.kind, kind),
        eq(schema.turnKnowledgeItem.turn_id, confirmationTurnId),
        eq(schema.turnKnowledgeItem.relation, 'reviewed'),
      ),
    )
    .all() as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

function countAcceptedKnowledgeItemsForPhase(
  db: DB,
  specificationId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): number {
  return getAcceptedKnowledgeItemIdsForPhase(db, specificationId, phase, kind).size;
}

export function readWorkflowProjectionSnapshot(db: DB, specificationId: number): WorkflowProjectionSnapshot {
  const activePath = getActivePath(db, specificationId);
  const activeTurnIds = new Set(activePath.map((turn) => turn.id));
  const turns = activePath.map((turn) => ({
    phase: turn.phase,
    question: turn.question,
    answer: turn.answer,
    optionCount: getOptionsForTurn(db, turn.id).length,
  })) satisfies WorkflowProjectionSnapshot['turns'];
  const phaseOutcomes = listPhaseOutcomesForSpecification(db, specificationId).map((outcome) => ({
    phase: outcome.phase,
    status: outcome.status,
    proposalTurnId: outcome.proposal_turn_id,
    summary: outcome.summary,
    closureBasis: getClosureBasisForOutcome(outcome),
    onActivePath: activeTurnIds.has(outcome.proposal_turn_id),
  })) satisfies WorkflowProjectionSnapshot['phaseOutcomes'];

  return {
    turns,
    phaseOutcomes,
    acceptedReviewItemCounts: {
      requirements: countAcceptedKnowledgeItemsForPhase(db, specificationId, 'requirements', 'requirement'),
      criteria: countAcceptedKnowledgeItemsForPhase(db, specificationId, 'criteria', 'criterion'),
    },
  };
}

export function getCurrentWorkflowState(db: DB, specificationId: number): WorkflowState {
  return projectWorkflowState(readWorkflowProjectionSnapshot(db, specificationId));
}

export function getStructuralArtifactTurnIds(db: DB, specificationId: number): number[] {
  const activePath = getActivePath(db, specificationId);
  const activeTurnIds = new Set(activePath.map((turn) => turn.id));
  const ids = new Set<number>();

  // Phase outcome anchors: proposal and confirmation turns
  for (const outcome of listPhaseOutcomesForSpecification(db, specificationId)) {
    if (activeTurnIds.has(outcome.proposal_turn_id)) {
      ids.add(outcome.proposal_turn_id);
    }
    if (outcome.confirmation_turn_id && activeTurnIds.has(outcome.confirmation_turn_id)) {
      ids.add(outcome.confirmation_turn_id);
    }
  }

  // Legacy transitional: kickoff/recovery turn rows (D95 marks these as transitional)
  for (const turn of activePath) {
    if (turn.turn_kind === 'kickoff' || turn.turn_kind === 'recovery' || turn.is_resolution) {
      ids.add(turn.id);
    }
  }

  return [...ids];
}

export function getCurrentPhase(db: DB, specificationId: number): Phase {
  const workflow = getCurrentWorkflowState(db, specificationId);
  return workflowPhaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? 'criteria';
}

export function getOptionsForTurn(db: DB, turnId: number): Option[] {
  return db
    .select()
    .from(schema.option)
    .where(eq(schema.option.turn_id, turnId))
    .orderBy(schema.option.position)
    .all() as Option[];
}

export function applyTurnResponseSelections(db: DB, turnId: number, selectedPositions: number[]): void {
  const uniquePositions = [...new Set(selectedPositions)];

  // Clear any previous selection for this turn.
  db.update(schema.option).set({ is_selected: false }).where(eq(schema.option.turn_id, turnId)).run();

  if (uniquePositions.length === 0) {
    return;
  }

  // Mark the chosen options for this turn response.
  db.update(schema.option)
    .set({ is_selected: true })
    .where(and(eq(schema.option.turn_id, turnId), inArray(schema.option.position, uniquePositions)))
    .run();
}

export function advanceHead(db: DB, specificationId: number, turnId: number): void {
  const chatId = getInterviewChatIdForSpecification(db, specificationId);
  db.transaction((tx) => {
    tx.update(schema.specification)
      .set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
      .where(eq(schema.specification.id, specificationId))
      .run();
    const updatedChat = tx
      .update(schema.chat)
      .set({ active_turn_id: turnId })
      .where(eq(schema.chat.id, chatId))
      .returning({ id: schema.chat.id })
      .get();
    if (!updatedChat) {
      throw new Error(`Interview chat ${chatId} for spec ${specificationId} not found; head update aborted`);
    }
  });
  reconcilePhaseOutcomesForSpecification(db, specificationId);
}

export function updateSpecificationMode(db: DB, specificationId: number, mode: SpecificationMode): void {
  db.update(schema.specification)
    .set({ mode, updated_at: sql`datetime('now')` })
    .where(eq(schema.specification.id, specificationId))
    .run();
}

// --- Entity persistence (generic knowledge items + compatibility projections) ---

export type EntityCollection = KnowledgeEntityCollection;
export type EntityReference = SharedEntityReference;
export type EntityRelationship = SharedEntityRelationship;
export type RequirementEntity = SharedRequirementEntity & { kind_ordinal: number };
export type CriterionEntity = SharedCriterionEntity & { kind_ordinal: number };
type GenericKnowledgeEntity<K extends GenericKnowledgeKind> = K extends 'requirement'
  ? RequirementEntity
  : K extends 'criterion'
    ? CriterionEntity
    : KnowledgeItem & { kind: K };
export type EntitiesForSpecification = EntitiesData;

function projectKnowledgeItemEntity<K extends 'decision' | 'assumption'>(
  item: KnowledgeItem,
  kind: K,
): K extends 'decision' ? Decision & { kind_ordinal: number } : Assumption & { kind_ordinal: number } {
  const base = {
    id: item.id,
    specification_id: item.specification_id,
    content: item.content,
    kind_ordinal: item.kind_ordinal,
  };

  if (kind === 'decision') {
    return {
      ...base,
      rationale: item.rationale,
    } as K extends 'decision' ? Decision & { kind_ordinal: number } : Assumption & { kind_ordinal: number };
  }

  return base as K extends 'decision'
    ? Decision & { kind_ordinal: number }
    : Assumption & { kind_ordinal: number };
}

function getKnowledgeItemsForSpecificationByKind(
  db: DB,
  specificationId: number,
  kind: GenericKnowledgeKind | 'decision' | 'assumption',
): KnowledgeItem[] {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(eq(schema.knowledgeItem.specification_id, specificationId), eq(schema.knowledgeItem.kind, kind)),
    )
    .all() as KnowledgeItem[];
}

function withReferenceCodes<T extends { id: number; kind: SharedKnowledgeKind; kind_ordinal: number }>(
  items: readonly T[],
): Array<T & { referenceCode: string }> {
  return items
    .slice()
    .sort((left, right) => left.id - right.id)
    .map((item) => ({
      ...item,
      referenceCode: createKnowledgeReferenceCode(item.kind, item.kind_ordinal),
    }));
}

function getGenericKnowledgeEntitiesForSpecificationByKind<K extends GenericKnowledgeKind>(
  db: DB,
  specificationId: number,
  kind: K,
): Array<GenericKnowledgeEntity<K>> {
  return getKnowledgeItemsForSpecificationByKind(db, specificationId, kind).map((item) => ({
    ...item,
    specification_id: item.specification_id,
    kind,
  })) as unknown as Array<GenericKnowledgeEntity<K>>;
}

export function getAcceptedRequirementEntitiesForSpecification(
  db: DB,
  specificationId: number,
): RequirementEntity[] {
  const acceptedIds = getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'requirements', 'requirement');
  if (acceptedIds.size === 0) {
    return [];
  }

  return getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, 'requirement').filter(
    (item) => acceptedIds.has(item.id),
  );
}

export function getAcceptedCriterionEntitiesForSpecification(
  db: DB,
  specificationId: number,
): CriterionEntity[] {
  const acceptedIds = getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'criteria', 'criterion');
  if (acceptedIds.size === 0) {
    return [];
  }

  return getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, 'criterion').filter((item) =>
    acceptedIds.has(item.id),
  );
}

export function getGroundingBundleForSpecification(db: DB, specificationId: number) {
  return {
    goals: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'goal'),
    terms: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'term'),
    contexts: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'context'),
    constraints: getKnowledgeItemsForSpecificationByKind(db, specificationId, 'constraint'),
  };
}

function getKnowledgeItemIdsLinkedToActivePath(db: DB, specificationId: number): Set<number> {
  const activeTurnIds = getActivePath(db, specificationId).map((turn) => turn.id);
  if (activeTurnIds.length === 0) {
    return new Set();
  }

  const rows = db
    .select({ itemId: schema.turnKnowledgeItem.item_id })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        inArray(schema.turnKnowledgeItem.turn_id, activeTurnIds),
      ),
    )
    .all() as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

export type EntityProjectionMode = 'project-wide' | 'active-path';

function getSpecificationWideEntitiesForSpecification(
  db: DB,
  specificationId: number,
): EntitiesForSpecification {
  const genericKnowledgeCollections = Object.fromEntries(
    genericKnowledgeKindRegistry.map((entry) => [
      entry.collectionKey,
      withReferenceCodes(
        getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, entry.kind),
      ).map(({ kind_ordinal: _, ...item }) => item),
    ]),
  ) as Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey>;
  const decisions = withReferenceCodes(
    getKnowledgeItemsForSpecificationByKind(db, specificationId, 'decision')
      .map((item) => projectKnowledgeItemEntity(item, 'decision'))
      .map((decision) => ({
        ...decision,
        kind: 'decision' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...decision }) => decision);
  const assumptions = withReferenceCodes(
    getKnowledgeItemsForSpecificationByKind(db, specificationId, 'assumption')
      .map((item) => projectKnowledgeItemEntity(item, 'assumption'))
      .map((assumption) => ({
        ...assumption,
        kind: 'assumption' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...assumption }) => assumption);
  const relationships = db.all(sql`
    SELECT
      edge.relation AS type,
      source.kind AS source_kind,
      source.id AS source_id,
      target.kind AS target_kind,
      target.id AS target_id
    FROM knowledge_edge edge
    JOIN knowledge_item source ON source.id = edge.from_item_id
    JOIN knowledge_item target ON target.id = edge.to_item_id
    WHERE
      source.specification_id = ${specificationId}
      AND target.specification_id = ${specificationId}
    ORDER BY
      CASE source.kind WHEN 'decision' THEN 0 WHEN 'assumption' THEN 1 ELSE 2 END,
      source.id,
      CASE target.kind WHEN 'decision' THEN 0 WHEN 'assumption' THEN 1 ELSE 2 END,
      target.id
  `) as Array<{
    type: EntityRelationship['type'];
    source_kind: EntityReference['kind'];
    source_id: number;
    target_kind: EntityReference['kind'];
    target_id: number;
  }>;

  return {
    ...genericKnowledgeCollections,
    decisions,
    assumptions,
    relationships: relationships.map((relationship) => ({
      type: relationship.type,
      source: {
        collection: knowledgeEntityCollectionByKind[relationship.source_kind],
        kind: relationship.source_kind,
        id: relationship.source_id,
      },
      target: {
        collection: knowledgeEntityCollectionByKind[relationship.target_kind],
        kind: relationship.target_kind,
        id: relationship.target_id,
      },
    })),
  };
}

function filterGenericKnowledgeCollectionsToActivePath(
  entities: EntitiesForSpecification,
  activeItemIds: ReadonlySet<number>,
  options?: {
    acceptedRequirementIds?: ReadonlySet<number>;
    acceptedCriterionIds?: ReadonlySet<number>;
  },
): Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey> {
  return Object.fromEntries(
    genericKnowledgeKindRegistry.map((entry) => {
      const acceptedIds =
        entry.kind === 'requirement'
          ? options?.acceptedRequirementIds
          : entry.kind === 'criterion'
            ? options?.acceptedCriterionIds
            : undefined;
      const visibleItems =
        acceptedIds && acceptedIds.size > 0
          ? entities[entry.collectionKey].filter((item) => acceptedIds.has(item.id))
          : entities[entry.collectionKey].filter((item) => activeItemIds.has(item.id));
      return [entry.collectionKey, visibleItems];
    }),
  ) as Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey>;
}

function filterEntitiesToActivePath(
  entities: EntitiesForSpecification,
  activeItemIds: ReadonlySet<number>,
  options?: {
    acceptedRequirementIds?: ReadonlySet<number>;
    acceptedCriterionIds?: ReadonlySet<number>;
  },
): EntitiesForSpecification {
  const genericKnowledgeCollections = filterGenericKnowledgeCollectionsToActivePath(
    entities,
    activeItemIds,
    options,
  );
  const decisions = entities.decisions.filter((item) => activeItemIds.has(item.id));
  const assumptions = entities.assumptions.filter((item) => activeItemIds.has(item.id));

  const visibleIdsByCollection = {
    knowledge_item: new Set([
      ...genericKnowledgeKindRegistry.flatMap((entry) =>
        genericKnowledgeCollections[entry.collectionKey].map((item) => item.id),
      ),
      ...decisions.map((item) => item.id),
      ...assumptions.map((item) => item.id),
    ]),
  } satisfies Record<EntityRelationship['source']['collection'], Set<number>>;

  return {
    ...genericKnowledgeCollections,
    decisions,
    assumptions,
    relationships: entities.relationships.filter(
      (relationship) =>
        visibleIdsByCollection[relationship.source.collection].has(relationship.source.id) &&
        visibleIdsByCollection[relationship.target.collection].has(relationship.target.id),
    ),
  };
}

export function getEntitiesForSpecificationByMode(
  db: DB,
  specificationId: number,
  mode: EntityProjectionMode,
): EntitiesForSpecification {
  const projectWideEntities = getSpecificationWideEntitiesForSpecification(db, specificationId);
  if (mode === 'project-wide') {
    return projectWideEntities;
  }

  return filterEntitiesToActivePath(
    projectWideEntities,
    getKnowledgeItemIdsLinkedToActivePath(db, specificationId),
    {
      acceptedRequirementIds: getAcceptedKnowledgeItemIdsForPhase(
        db,
        specificationId,
        'requirements',
        'requirement',
      ),
      acceptedCriterionIds: getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'criteria', 'criterion'),
    },
  );
}

export function getEntitiesForSpecification(db: DB, specificationId: number): EntitiesForSpecification {
  return getEntitiesForSpecificationByMode(db, specificationId, 'project-wide');
}

export function getEntitiesForSpecificationOnActivePath(
  db: DB,
  specificationId: number,
): EntitiesForSpecification {
  return getEntitiesForSpecificationByMode(db, specificationId, 'active-path');
}

export function getCapturedItemsForTurns(
  db: DB,
  specificationId: number,
  turnIds: readonly number[],
): Map<number, NonNullable<SpecificationStateTurn['captured_items']>> {
  const capturedItemsByTurn = new Map<number, NonNullable<SpecificationStateTurn['captured_items']>>();
  if (turnIds.length === 0) {
    return capturedItemsByTurn;
  }

  const projectWideEntities = getEntitiesForSpecification(db, specificationId);
  const itemsById = new Map<number, NonNullable<SpecificationStateTurn['captured_items']>[number]>();

  for (const entry of knowledgeKindRegistry) {
    const items = projectWideEntities[entry.collectionKey] as ReadonlyArray<{
      id: number;
      content: string;
      referenceCode?: string;
      kind?: SharedKnowledgeKind;
    }>;
    for (const item of items) {
      itemsById.set(item.id, {
        collection: entry.entityCollection,
        kind: item.kind ?? entry.kind,
        id: item.id,
        content: item.content,
        referenceCode: item.referenceCode,
      });
    }
  }

  const rows = db
    .select({
      turnId: schema.turnKnowledgeItem.turn_id,
      itemId: schema.turnKnowledgeItem.item_id,
    })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        eq(schema.turnKnowledgeItem.relation, 'captured'),
        inArray(schema.turnKnowledgeItem.turn_id, [...turnIds]),
      ),
    )
    .all() as Array<{ turnId: number; itemId: number }>;

  rows.sort((left, right) => left.turnId - right.turnId || left.itemId - right.itemId);

  for (const row of rows) {
    const item = itemsById.get(row.itemId);
    if (!item) {
      continue;
    }

    const currentTurnItems = capturedItemsByTurn.get(row.turnId) ?? [];
    currentTurnItems.push(item);
    capturedItemsByTurn.set(row.turnId, currentTurnItems);
  }

  return capturedItemsByTurn;
}
