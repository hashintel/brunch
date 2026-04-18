import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import Database from 'better-sqlite3';
import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

import type {
  AssumptionEntity as SharedAssumption,
  CriterionEntity as SharedCriterionEntity,
  DecisionEntity as SharedDecision,
  EntitiesData,
  EntityReference as SharedEntityReference,
  EntityRelationship as SharedEntityRelationship,
  ProjectMode,
  ProjectStateTurn,
  ReadinessBand,
  TurnKind,
  RequirementEntity as SharedRequirementEntity,
  WorkflowPhaseState as SharedWorkflowPhaseState,
  WorkflowPhaseStatus,
  WorkflowState as SharedWorkflowState,
} from '@/shared/api-types.js';
import { reviewSetSchema, type BrunchAssistantPart, type ReviewSetData } from '@/shared/chat.js';
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
import { parsePhaseClosureCommand, type PhaseClosureBasis } from '@/shared/phase-close.js';

import {
  safeDeserializeAssistantParts,
  safeDeserializeUserParts,
  type DataConfirmationPart,
} from './parts.js';
import * as schema from './schema.js';

export type DB = ReturnType<typeof drizzle<typeof schema>>;
export type Project = InferSelectModel<typeof schema.project>;
export type Turn = InferSelectModel<typeof schema.turn>;
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
  projectId: number;
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

export function getOrCreateProject(db: DB, name = 'default'): Project {
  const existing = db.select().from(schema.project).orderBy(desc(schema.project.created_at)).limit(1).get();
  if (existing) return existing as Project;
  const result = db.insert(schema.project).values({ name }).returning().get();
  return result as Project;
}

export function listProjects(db: DB): Project[] {
  return db.select().from(schema.project).orderBy(desc(schema.project.updated_at)).all() as Project[];
}

export interface CreateProjectOptions {
  mode?: ProjectMode;
  cwd?: string | null;
}

export function createProject(db: DB, name: string, options?: CreateProjectOptions): Project {
  const result = db
    .insert(schema.project)
    .values({
      name,
      ...(options?.mode ? { mode: options.mode } : {}),
      ...(options?.cwd ? { cwd: options.cwd } : {}),
    })
    .returning()
    .get();
  return result as Project;
}

export function getProject(db: DB, id: number): Project | undefined {
  return db.select().from(schema.project).where(eq(schema.project.id, id)).get() as Project | undefined;
}

export function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

export function createTurn(db: DB, projectId: number, input: CreateTurnInput): Turn {
  const result = db
    .insert(schema.turn)
    .values({
      project_id: projectId,
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

export function getActivePath(db: DB, projectId: number): Turn[] {
  const project = db
    .select({ active_turn_id: schema.project.active_turn_id })
    .from(schema.project)
    .where(eq(schema.project.id, projectId))
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

const workflowPhaseOrder = [
  'scope',
  'design',
  'requirements',
  'criteria',
] as const satisfies readonly Phase[];

function createEmptyWorkflowPhaseState(): WorkflowPhaseState {
  return {
    status: 'unstarted',
    closeability: false,
    readiness: 'low',
    closureBasis: null,
    proposalPending: false,
    turnId: null,
    summary: null,
  };
}

function getReadinessBand(turnCount: number): ReadinessBand {
  if (turnCount <= 0) {
    return 'low';
  }
  if (turnCount === 1) {
    return 'medium';
  }
  return 'high';
}

export function listPhaseOutcomesForProject(db: DB, projectId: number): PhaseOutcome[] {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(eq(schema.phaseOutcome.project_id, projectId))
    .orderBy(desc(schema.phaseOutcome.id))
    .all() as PhaseOutcome[];
}

function reconcilePhaseOutcomesForProject(db: DB, projectId: number): void {
  const activeTurnIds = new Set(getActivePath(db, projectId).map((turn) => turn.id));
  const outcomesToSupersede = listPhaseOutcomesForProject(db, projectId).filter(
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
  const result = db
    .insert(schema.phaseOutcome)
    .values({
      project_id: input.projectId,
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
  const result = db
    .insert(schema.phaseOutcome)
    .values({
      project_id: input.projectId,
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
  projectId: number,
  proposalTurnId: number,
): PhaseOutcome | undefined {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(
      and(
        eq(schema.phaseOutcome.project_id, projectId),
        eq(schema.phaseOutcome.proposal_turn_id, proposalTurnId),
        eq(schema.phaseOutcome.status, 'proposed'),
      ),
    )
    .orderBy(desc(schema.phaseOutcome.id))
    .get() as PhaseOutcome | undefined;
}

export function findPhaseOutcomeForTurn(
  db: DB,
  projectId: number,
  proposalTurnId: number,
): PhaseOutcome | undefined {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(
      and(
        eq(schema.phaseOutcome.project_id, projectId),
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
  projectId: number,
  phase: Phase,
): PhaseOutcome | undefined {
  const activeTurnIds = new Set(getActivePath(db, projectId).map((turn) => turn.id));
  if (activeTurnIds.size === 0) {
    return undefined;
  }

  return listPhaseOutcomesForProject(db, projectId).find(
    (outcome) =>
      outcome.phase === phase &&
      outcome.status === 'confirmed' &&
      activeTurnIds.has(outcome.proposal_turn_id),
  );
}

function getAcceptedKnowledgeItemIdsForPhase(
  db: DB,
  projectId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): Set<number> {
  const confirmationTurnId = findConfirmedPhaseOutcomeOnActivePath(
    db,
    projectId,
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
        eq(schema.knowledgeItem.project_id, projectId),
        eq(schema.knowledgeItem.kind, kind),
        eq(schema.turnKnowledgeItem.turn_id, confirmationTurnId),
        eq(schema.turnKnowledgeItem.relation, 'reviewed'),
      ),
    )
    .all() as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

function hasRequirementsReviewCoverage(db: DB, projectId: number): boolean {
  return getAcceptedKnowledgeItemIdsForPhase(db, projectId, 'requirements', 'requirement').size > 0;
}

function hasCriteriaReviewCoverage(db: DB, projectId: number): boolean {
  return getAcceptedKnowledgeItemIdsForPhase(db, projectId, 'criteria', 'criterion').size > 0;
}

function getPhaseCloseability(
  db: DB,
  projectId: number,
  phase: Phase,
  isConfirmed: boolean,
  hasTurnHistory: boolean,
): boolean {
  if (isConfirmed) {
    return false;
  }

  if (phase === 'requirements') {
    return hasRequirementsReviewCoverage(db, projectId);
  }

  if (phase === 'criteria') {
    return hasCriteriaReviewCoverage(db, projectId);
  }

  return hasTurnHistory;
}

export function getCurrentWorkflowState(db: DB, projectId: number): WorkflowState {
  const workflow: WorkflowState = {
    phases: {
      scope: createEmptyWorkflowPhaseState(),
      design: createEmptyWorkflowPhaseState(),
      requirements: createEmptyWorkflowPhaseState(),
      criteria: createEmptyWorkflowPhaseState(),
    },
  };

  const activePath = getActivePath(db, projectId);
  const activeTurnIds = new Set(activePath.map((turn) => turn.id));
  const turnCounts = Object.fromEntries(workflowPhaseOrder.map((phase) => [phase, 0])) as Record<
    Phase,
    number
  >;
  for (const turn of activePath) {
    const isSubstantiveTurn = turn.question.trim().length > 0 || getOptionsForTurn(db, turn.id).length > 0;
    if (isSubstantiveTurn) {
      turnCounts[turn.phase] += 1;
    }
  }

  const currentOutcomes = listPhaseOutcomesForProject(db, projectId).filter(
    (outcome) =>
      (outcome.status === 'proposed' || outcome.status === 'confirmed') &&
      activeTurnIds.has(outcome.proposal_turn_id),
  );

  const firstUnclosedPhase =
    workflowPhaseOrder.find(
      (phase) => currentOutcomes.find((entry) => entry.phase === phase)?.status !== 'confirmed',
    ) ?? 'criteria';

  for (const phase of workflowPhaseOrder) {
    const outcome = currentOutcomes.find((entry) => entry.phase === phase);
    const isConfirmed = outcome?.status === 'confirmed';
    const proposalPending = outcome?.status === 'proposed';
    const hasTurnHistory = turnCounts[phase] > 0;

    workflow.phases[phase] = {
      status: isConfirmed
        ? 'closed'
        : phase === firstUnclosedPhase || hasTurnHistory
          ? 'in_progress'
          : 'unstarted',
      closeability: getPhaseCloseability(db, projectId, phase, isConfirmed, hasTurnHistory),
      readiness: getReadinessBand(turnCounts[phase]),
      closureBasis: getClosureBasisForOutcome(outcome),
      proposalPending,
      turnId: outcome?.proposal_turn_id ?? null,
      summary: outcome?.summary ?? null,
    };
  }

  return workflow;
}

export function getCurrentPhase(db: DB, projectId: number): Phase {
  const workflow = getCurrentWorkflowState(db, projectId);
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

export function advanceHead(db: DB, projectId: number, turnId: number): void {
  db.update(schema.project)
    .set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
    .where(eq(schema.project.id, projectId))
    .run();
  reconcilePhaseOutcomesForProject(db, projectId);
}

export function updateProjectMode(
  db: DB,
  projectId: number,
  { mode, cwd }: { mode: ProjectMode; cwd: string | null },
): void {
  db.update(schema.project)
    .set({ mode, cwd, updated_at: sql`datetime('now')` })
    .where(eq(schema.project.id, projectId))
    .run();
}

// --- Entity persistence (generic knowledge items + compatibility projections) ---

export type KnowledgeItem = InferSelectModel<typeof schema.knowledgeItem>;
export type KnowledgeKind = Extract<KnowledgeItem['kind'], SharedKnowledgeKind>;
export type EntityCollection = KnowledgeEntityCollection;

export type Decision = SharedDecision;
export type Assumption = SharedAssumption;
export type EntityReference = SharedEntityReference;
export type EntityRelationship = SharedEntityRelationship;
export type RequirementEntity = SharedRequirementEntity & { kind_ordinal: number };
export type CriterionEntity = SharedCriterionEntity & { kind_ordinal: number };
type GenericKnowledgeEntity<K extends GenericKnowledgeKind> = K extends 'requirement'
  ? RequirementEntity
  : K extends 'criterion'
    ? CriterionEntity
    : KnowledgeItem & { kind: K };
type ProjectedKnowledgeEntity<K extends 'decision' | 'assumption'> = K extends 'decision'
  ? Decision & { kind_ordinal: number }
  : Assumption & { kind_ordinal: number };
export type EntitiesForProject = EntitiesData;

function projectKnowledgeItemEntity<K extends 'decision' | 'assumption'>(
  item: KnowledgeItem,
  kind: K,
): ProjectedKnowledgeEntity<K> {
  const base = {
    id: item.id,
    project_id: item.project_id,
    content: item.content,
    kind_ordinal: item.kind_ordinal,
  };

  if (kind === 'decision') {
    return {
      ...base,
      rationale: item.rationale,
    } as ProjectedKnowledgeEntity<K>;
  }

  return base as ProjectedKnowledgeEntity<K>;
}

export function createDecision(
  db: DB,
  projectId: number,
  content: string,
  rationale?: string | null,
): Decision {
  return projectKnowledgeItemEntity(
    db
      .insert(schema.knowledgeItem)
      .values({
        project_id: projectId,
        kind: 'decision',
        subtype: null,
        content,
        rationale: rationale ?? null,
        kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE project_id = ${projectId} AND kind = 'decision')`,
      })
      .returning()
      .get() as KnowledgeItem,
    'decision',
  );
}

export function createAssumption(db: DB, projectId: number, content: string): Assumption {
  return projectKnowledgeItemEntity(
    db
      .insert(schema.knowledgeItem)
      .values({
        project_id: projectId,
        kind: 'assumption',
        subtype: null,
        content,
        rationale: null,
        kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE project_id = ${projectId} AND kind = 'assumption')`,
      })
      .returning()
      .get() as KnowledgeItem,
    'assumption',
  );
}

export function linkDecisionToTurn(db: DB, decisionId: number, turnId: number): void {
  linkKnowledgeItemToTurn(db, decisionId, turnId);
}

export function linkAssumptionToTurn(db: DB, assumptionId: number, turnId: number): void {
  linkKnowledgeItemToTurn(db, assumptionId, turnId);
}

export function createKnowledgeItem(
  db: DB,
  projectId: number,
  kind: KnowledgeKind,
  content: string,
  options?: { subtype?: string | null; rationale?: string | null },
): KnowledgeItem {
  return db
    .insert(schema.knowledgeItem)
    .values({
      project_id: projectId,
      kind,
      subtype: options?.subtype ?? null,
      content,
      rationale: options?.rationale ?? null,
      kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE project_id = ${projectId} AND kind = ${kind})`,
    })
    .returning()
    .get() as KnowledgeItem;
}

export function linkKnowledgeItemToTurn(
  db: DB,
  itemId: number,
  turnId: number,
  relation: InferSelectModel<typeof schema.turnKnowledgeItem>['relation'] = 'captured',
): void {
  db.insert(schema.turnKnowledgeItem)
    .values({ turn_id: turnId, item_id: itemId, relation })
    .onConflictDoNothing()
    .run();
}

function addKnowledgeEdge(
  db: DB,
  fromItemId: number,
  toItemId: number,
  relation: InferSelectModel<typeof schema.knowledgeEdge>['relation'],
): void {
  db.insert(schema.knowledgeEdge).values({ from_item_id: fromItemId, to_item_id: toItemId, relation }).run();
}

export function addDecisionParentDecision(db: DB, decisionId: number, parentDecisionId: number): void {
  addKnowledgeEdge(db, decisionId, parentDecisionId, 'depends_on');
}

export function addDecisionParentAssumption(db: DB, decisionId: number, parentAssumptionId: number): void {
  addKnowledgeEdge(db, decisionId, parentAssumptionId, 'depends_on');
}

export function addAssumptionParentAssumption(
  db: DB,
  assumptionId: number,
  parentAssumptionId: number,
): void {
  addKnowledgeEdge(db, assumptionId, parentAssumptionId, 'depends_on');
}

function getKnowledgeItemsForProjectByKind(
  db: DB,
  projectId: number,
  kind: GenericKnowledgeKind | 'decision' | 'assumption',
): KnowledgeItem[] {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(and(eq(schema.knowledgeItem.project_id, projectId), eq(schema.knowledgeItem.kind, kind)))
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

function getGenericKnowledgeEntitiesForProjectByKind<K extends GenericKnowledgeKind>(
  db: DB,
  projectId: number,
  kind: K,
): Array<GenericKnowledgeEntity<K>> {
  return getKnowledgeItemsForProjectByKind(db, projectId, kind).map((item) => ({
    ...item,
    kind,
  })) as Array<GenericKnowledgeEntity<K>>;
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
  projectId: number,
  kind: 'requirement' | 'criterion',
  content: string,
): KnowledgeItem | undefined {
  return db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(
        eq(schema.knowledgeItem.project_id, projectId),
        eq(schema.knowledgeItem.kind, kind),
        eq(schema.knowledgeItem.content, content),
      ),
    )
    .orderBy(schema.knowledgeItem.id)
    .get() as KnowledgeItem | undefined;
}

function materializeAcceptedReviewSetItems(
  db: DB,
  projectId: number,
  turnId: number,
  phase: 'requirements' | 'criteria',
): number[] | null {
  const reviewTurn = getTurn(db, turnId);
  const reviewSet = getPersistedReviewSetForTurn(reviewTurn);
  if (!reviewSet || reviewSet.phase !== phase) {
    return null;
  }

  const kind = phase === 'requirements' ? 'requirement' : 'criterion';
  const itemIds: number[] = [];

  for (const item of reviewSet.items) {
    const existingItem = findExistingKnowledgeItemForReviewSetItem(db, projectId, kind, item.content);
    const materializedItem =
      existingItem ??
      createKnowledgeItem(db, projectId, kind, item.content, {
        rationale: item.rationale ?? null,
      });
    linkKnowledgeItemToTurn(db, materializedItem.id, turnId, 'reviewed');
    itemIds.push(materializedItem.id);
  }

  return itemIds;
}

export function getAcceptedRequirementEntitiesForProject(db: DB, projectId: number): RequirementEntity[] {
  const acceptedIds = getAcceptedKnowledgeItemIdsForPhase(db, projectId, 'requirements', 'requirement');
  if (acceptedIds.size === 0) {
    return [];
  }

  return getGenericKnowledgeEntitiesForProjectByKind(db, projectId, 'requirement').filter((item) =>
    acceptedIds.has(item.id),
  );
}

export function getAcceptedCriterionEntitiesForProject(db: DB, projectId: number): CriterionEntity[] {
  const acceptedIds = getAcceptedKnowledgeItemIdsForPhase(db, projectId, 'criteria', 'criterion');
  if (acceptedIds.size === 0) {
    return [];
  }

  return getGenericKnowledgeEntitiesForProjectByKind(db, projectId, 'criterion').filter((item) =>
    acceptedIds.has(item.id),
  );
}

export function materializeAcceptedRequirementsReviewSet(
  db: DB,
  projectId: number,
  turnId: number,
): number[] | null {
  return materializeAcceptedReviewSetItems(db, projectId, turnId, 'requirements');
}

export function materializeAcceptedCriteriaReviewSet(
  db: DB,
  projectId: number,
  turnId: number,
): number[] | null {
  return materializeAcceptedReviewSetItems(db, projectId, turnId, 'criteria');
}

export function getScopeBundleForProject(db: DB, projectId: number) {
  return {
    goals: getKnowledgeItemsForProjectByKind(db, projectId, 'goal'),
    terms: getKnowledgeItemsForProjectByKind(db, projectId, 'term'),
    contexts: getKnowledgeItemsForProjectByKind(db, projectId, 'context'),
    constraints: getKnowledgeItemsForProjectByKind(db, projectId, 'constraint'),
  };
}

function getKnowledgeItemIdsLinkedToActivePath(db: DB, projectId: number): Set<number> {
  const activeTurnIds = getActivePath(db, projectId).map((turn) => turn.id);
  if (activeTurnIds.length === 0) {
    return new Set();
  }

  const rows = db
    .select({ itemId: schema.turnKnowledgeItem.item_id })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.project_id, projectId),
        inArray(schema.turnKnowledgeItem.turn_id, activeTurnIds),
      ),
    )
    .all() as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

export type EntityProjectionMode = 'project-wide' | 'active-path';

function getProjectWideEntitiesForProject(db: DB, projectId: number): EntitiesForProject {
  const genericKnowledgeCollections = Object.fromEntries(
    genericKnowledgeKindRegistry.map((entry) => [
      entry.collectionKey,
      withReferenceCodes(getGenericKnowledgeEntitiesForProjectByKind(db, projectId, entry.kind)).map(
        ({ kind_ordinal: _, ...item }) => item,
      ),
    ]),
  ) as Pick<EntitiesForProject, GenericKnowledgeCollectionKey>;
  const decisions = withReferenceCodes(
    getKnowledgeItemsForProjectByKind(db, projectId, 'decision')
      .map((item) => projectKnowledgeItemEntity(item, 'decision'))
      .map((decision) => ({
        ...decision,
        kind: 'decision' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...decision }) => decision);
  const assumptions = withReferenceCodes(
    getKnowledgeItemsForProjectByKind(db, projectId, 'assumption')
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
      source.project_id = ${projectId}
      AND target.project_id = ${projectId}
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
  entities: EntitiesForProject,
  activeItemIds: ReadonlySet<number>,
  options?: {
    acceptedRequirementIds?: ReadonlySet<number>;
    acceptedCriterionIds?: ReadonlySet<number>;
  },
): Pick<EntitiesForProject, GenericKnowledgeCollectionKey> {
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
  ) as Pick<EntitiesForProject, GenericKnowledgeCollectionKey>;
}

function filterEntitiesToActivePath(
  entities: EntitiesForProject,
  activeItemIds: ReadonlySet<number>,
  options?: {
    acceptedRequirementIds?: ReadonlySet<number>;
    acceptedCriterionIds?: ReadonlySet<number>;
  },
): EntitiesForProject {
  const genericKnowledgeCollections = filterGenericKnowledgeCollectionsToActivePath(
    entities,
    activeItemIds,
    options,
  );
  const decisions = entities.decisions.filter((item) => activeItemIds.has(item.id));
  const assumptions = entities.assumptions.filter((item) => activeItemIds.has(item.id));

  const visibleIdsByCollection = {
    knowledge_item: new Set(
      genericKnowledgeKindRegistry.flatMap((entry) =>
        genericKnowledgeCollections[entry.collectionKey].map((item) => item.id),
      ),
    ),
    decision: new Set(decisions.map((item) => item.id)),
    assumption: new Set(assumptions.map((item) => item.id)),
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

export function getEntitiesForProjectByMode(
  db: DB,
  projectId: number,
  mode: EntityProjectionMode,
): EntitiesForProject {
  const projectWideEntities = getProjectWideEntitiesForProject(db, projectId);
  if (mode === 'project-wide') {
    return projectWideEntities;
  }

  return filterEntitiesToActivePath(
    projectWideEntities,
    getKnowledgeItemIdsLinkedToActivePath(db, projectId),
    {
      acceptedRequirementIds: getAcceptedKnowledgeItemIdsForPhase(
        db,
        projectId,
        'requirements',
        'requirement',
      ),
      acceptedCriterionIds: getAcceptedKnowledgeItemIdsForPhase(db, projectId, 'criteria', 'criterion'),
    },
  );
}

export function getEntitiesForProject(db: DB, projectId: number): EntitiesForProject {
  return getEntitiesForProjectByMode(db, projectId, 'project-wide');
}

export function getEntitiesForProjectOnActivePath(db: DB, projectId: number): EntitiesForProject {
  return getEntitiesForProjectByMode(db, projectId, 'active-path');
}

export function getCapturedItemsForTurns(
  db: DB,
  projectId: number,
  turnIds: readonly number[],
): Map<number, NonNullable<ProjectStateTurn['captured_items']>> {
  const capturedItemsByTurn = new Map<number, NonNullable<ProjectStateTurn['captured_items']>>();
  if (turnIds.length === 0) {
    return capturedItemsByTurn;
  }

  const projectWideEntities = getEntitiesForProject(db, projectId);
  const itemsById = new Map<number, NonNullable<ProjectStateTurn['captured_items']>[number]>();

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
        eq(schema.knowledgeItem.project_id, projectId),
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
