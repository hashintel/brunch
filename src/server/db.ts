import Database from 'better-sqlite3';
import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  genericKnowledgeKindRegistry,
  type GenericKnowledgeCollectionKey,
  type GenericKnowledgeKind,
  type KnowledgeEntityCollection,
  type KnowledgeKind as SharedKnowledgeKind,
} from '../shared/knowledge.js';
import { parsePhaseClosureCommand, type PhaseClosureBasis } from '../shared/phase-close.js';
import { safeDeserializeUserParts, type DataConfirmationPart } from './parts.js';
import * as schema from './schema.js';

export type DB = ReturnType<typeof drizzle<typeof schema>>;
export type Project = InferSelectModel<typeof schema.project>;
export type Turn = InferSelectModel<typeof schema.turn>;
export type Option = InferSelectModel<typeof schema.option>;
export type PhaseOutcome = InferSelectModel<typeof schema.phaseOutcome>;
export type Phase = Turn['phase'];
export type Impact = NonNullable<Turn['impact']>;
export type PhaseOutcomeStatus = PhaseOutcome['status'];
export type WorkflowPhaseStatus = 'unstarted' | 'in_progress' | 'closed';
export type ReadinessBand = 'low' | 'medium' | 'high';
export type ClosureBasis = PhaseClosureBasis | null;

export interface WorkflowPhaseState {
  status: WorkflowPhaseStatus;
  closeability: boolean;
  readiness: ReadinessBand;
  closureBasis: ClosureBasis;
  proposalPending: boolean;
  turnId: number | null;
  summary: string | null;
}

export interface WorkflowState {
  phases: Record<Phase, WorkflowPhaseState>;
}

export interface CreatePhaseOutcomeInput {
  projectId: number;
  phase: Phase;
  proposal_turn_id: number;
  summary: string;
}

export interface CreateTurnInput {
  parent_turn_id?: number | null;
  phase: Phase;
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
  migrate(db, { migrationsFolder: './drizzle' });
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

export function createProject(db: DB, name: string): Project {
  const result = db.insert(schema.project).values({ name }).returning().get();
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
    turnCounts[turn.phase] += 1;
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
      closeability: isConfirmed ? false : hasTurnHistory,
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

// --- Entity persistence (generic knowledge items + compatibility projections) ---

export type KnowledgeItem = InferSelectModel<typeof schema.knowledgeItem>;
export type KnowledgeKind = Extract<KnowledgeItem['kind'], SharedKnowledgeKind>;
export type EntityCollection = KnowledgeEntityCollection;

export interface Decision {
  id: number;
  project_id: number;
  content: string;
  rationale: string | null;
}

export interface Assumption {
  id: number;
  project_id: number;
  content: string;
}

export interface EntityReference {
  collection: EntityCollection;
  kind: KnowledgeKind;
  id: number;
}

export interface EntityRelationship {
  type: 'depends_on';
  source: EntityReference;
  target: EntityReference;
}

export interface EntitiesForProject {
  goals: KnowledgeItem[];
  terms: KnowledgeItem[];
  contexts: KnowledgeItem[];
  constraints: KnowledgeItem[];
  requirements: KnowledgeItem[];
  criteria: KnowledgeItem[];
  decisions: Decision[];
  assumptions: Assumption[];
  relationships: EntityRelationship[];
}

function toDecision(item: KnowledgeItem): Decision {
  return {
    id: item.id,
    project_id: item.project_id,
    content: item.content,
    rationale: item.rationale,
  };
}

function toAssumption(item: KnowledgeItem): Assumption {
  return {
    id: item.id,
    project_id: item.project_id,
    content: item.content,
  };
}

export function createDecision(
  db: DB,
  projectId: number,
  content: string,
  rationale?: string | null,
): Decision {
  return toDecision(
    db
      .insert(schema.knowledgeItem)
      .values({
        project_id: projectId,
        kind: 'decision',
        subtype: null,
        content,
        rationale: rationale ?? null,
      })
      .returning()
      .get() as KnowledgeItem,
  );
}

export function createAssumption(db: DB, projectId: number, content: string): Assumption {
  return toAssumption(
    db
      .insert(schema.knowledgeItem)
      .values({
        project_id: projectId,
        kind: 'assumption',
        subtype: null,
        content,
        rationale: null,
      })
      .returning()
      .get() as KnowledgeItem,
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
  db.insert(schema.turnKnowledgeItem).values({ turn_id: turnId, item_id: itemId, relation }).run();
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

function getEntityCollectionForKind(kind: KnowledgeKind): EntityCollection {
  if (kind === 'decision') {
    return 'decision';
  }
  if (kind === 'assumption') {
    return 'assumption';
  }
  return 'knowledge_item';
}

export function getScopeBundleForProject(db: DB, projectId: number) {
  return {
    goals: getKnowledgeItemsForProjectByKind(db, projectId, 'goal'),
    terms: getKnowledgeItemsForProjectByKind(db, projectId, 'term'),
    contexts: getKnowledgeItemsForProjectByKind(db, projectId, 'context'),
    constraints: getKnowledgeItemsForProjectByKind(db, projectId, 'constraint'),
  };
}

export function getEntitiesForProject(db: DB, projectId: number): EntitiesForProject {
  const genericKnowledgeCollections = Object.fromEntries(
    genericKnowledgeKindRegistry.map((entry) => [
      entry.collectionKey,
      getKnowledgeItemsForProjectByKind(db, projectId, entry.kind),
    ]),
  ) as Pick<EntitiesForProject, GenericKnowledgeCollectionKey>;
  const decisions = getKnowledgeItemsForProjectByKind(db, projectId, 'decision').map(toDecision);
  const assumptions = getKnowledgeItemsForProjectByKind(db, projectId, 'assumption').map(toAssumption);
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
      AND edge.relation = 'depends_on'
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
        collection: getEntityCollectionForKind(relationship.source_kind),
        kind: relationship.source_kind,
        id: relationship.source_id,
      },
      target: {
        collection: getEntityCollectionForKind(relationship.target_kind),
        kind: relationship.target_kind,
        id: relationship.target_id,
      },
    })),
  };
}
