import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

import type {
  SpecificationMode,
  ReadinessBand,
  TurnKind,
  WorkflowPhaseState as SharedWorkflowPhaseState,
  WorkflowPhaseStatus,
  WorkflowState as SharedWorkflowState,
} from '@/shared/api-types.js';
import {} from '@/shared/knowledge.js';
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

import { countAcceptedKnowledgeItemsForPhase } from './db/entity-projection-store.js';
export {
  getAcceptedCriterionEntitiesForSpecification,
  getAcceptedKnowledgeItemIdsForPhase,
  getAcceptedRequirementEntitiesForSpecification,
  getCapturedItemsForTurns,
  getEntitiesForSpecification,
  getEntitiesForSpecificationByMode,
  getEntitiesForSpecificationOnActivePath,
  getGroundingBundleForSpecification,
} from './db/entity-projection-store.js';
export type {
  CriterionEntity,
  EntitiesForSpecification,
  EntityCollection,
  EntityProjectionMode,
  EntityReference,
  EntityRelationship,
  RequirementEntity,
} from './db/entity-projection-store.js';

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
