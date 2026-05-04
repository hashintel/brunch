import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

import { and, desc, eq, inArray, sql, type InferSelectModel } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_FOLDER = join(__dirname, '..', '..', 'drizzle');

import type {
  AssumptionEntity as SharedAssumption,
  CriterionEntity as SharedCriterionEntity,
  DecisionEntity as SharedDecision,
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
import {
  parsePhaseClosureCommand,
  workflowPhaseOrder,
  type PhaseClosureBasis,
} from '@/shared/phase-close.js';
import { normalizeReviewSetForDisplay } from '@/shared/review-diffing.js';
import { getPersistedReviewAction } from '@/shared/specification-state.js';

import {
  safeDeserializeAssistantParts,
  safeDeserializeUserParts,
  type DataConfirmationPart,
} from './parts.js';
import * as schema from './schema.js';
import { projectWorkflowState, type WorkflowProjectionSnapshot } from './workflow-projector.js';

// `RawDB` is the underlying SQLite handle exposed via `db.$client` for direct
// PRAGMA / introspection access in tests. If the driver ever changes again,
// this is the single place to update.
export type RawDB = DatabaseSync;
export type DB = ReturnType<typeof drizzle<typeof schema>> & { $client: RawDB };
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

export async function createDb(path: string = ':memory:'): Promise<DB> {
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA journal_mode = WAL');
  sqlite.exec('PRAGMA foreign_keys = ON');

  // drizzle's `mapResultRow` indexes positionally (`row[columnIndex]`), so we ask
  // node:sqlite for value arrays via `setReturnArrays(true)` rather than the default
  // object-keyed-by-column-name shape. node:sqlite's TS types don't reflect that mode,
  // hence the casts. For `get`, we propagate `undefined` when no row matches —
  // sqlite-proxy's `mapGetResult` handles undefined via its `if (!row) return undefined`
  // path, which is why the `undefined as unknown as unknown[]` cast is sound at runtime.
  type ProxyResult = { rows: unknown[] };
  const proxy = async (
    sqlText: string,
    params: unknown[],
    method: 'run' | 'all' | 'values' | 'get',
  ): Promise<ProxyResult> => {
    const stmt = sqlite.prepare(sqlText);
    stmt.setReturnArrays(true);
    const args = params as unknown as never[];
    if (method === 'run') {
      stmt.run(...args);
      return { rows: [] };
    }
    if (method === 'get') {
      const row = stmt.get(...args) as unknown as unknown[] | undefined;
      return { rows: row === undefined ? (undefined as unknown as unknown[]) : row };
    }
    return { rows: stmt.all(...args) as unknown as unknown[][] };
  };

  const db = drizzle<typeof schema>(proxy, { schema });

  await migrate(
    db,
    async (queries) => {
      // Wrap migrations in a transaction so a partial failure rolls back rather than
      // leaving the schema in a broken intermediate state. drizzle's better-sqlite3
      // migrator does this automatically; the sqlite-proxy migrator hands the queries
      // to us and trusts us to handle atomicity.
      sqlite.exec('BEGIN');
      try {
        for (const q of queries) {
          sqlite.exec(q);
        }
        sqlite.exec('COMMIT');
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    { migrationsFolder: MIGRATIONS_FOLDER },
  );

  // Attach the underlying sqlite handle for direct PRAGMA / introspection access in tests.
  Object.defineProperty(db, '$client', { value: sqlite, enumerable: false });
  return db as DB;
}

export async function getOrCreateSpecification(db: DB, name = 'default'): Promise<Specification> {
  const existing = await db
    .select()
    .from(schema.specification)
    .orderBy(desc(schema.specification.created_at))
    .limit(1)
    .get();
  if (existing) return existing as Specification;
  const result = await db.insert(schema.specification).values({ name }).returning().get();
  return result as Specification;
}

export async function listSpecifications(db: DB): Promise<Specification[]> {
  return (await db
    .select()
    .from(schema.specification)
    .orderBy(desc(schema.specification.updated_at))
    .all()) as Specification[];
}

export interface CreateSpecificationOptions {
  mode?: SpecificationMode;
}

export async function createSpecification(
  db: DB,
  name: string,
  options?: CreateSpecificationOptions,
): Promise<Specification> {
  const result = await db
    .insert(schema.specification)
    .values({
      name,
      ...(options?.mode ? { mode: options.mode } : {}),
    })
    .returning()
    .get();
  return result as Specification;
}

export async function getSpecification(db: DB, id: number): Promise<Specification | undefined> {
  return (await db.select().from(schema.specification).where(eq(schema.specification.id, id)).get()) as
    | Specification
    | undefined;
}

export async function getTurn(db: DB, turnId: number): Promise<Turn | undefined> {
  return (await db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get()) as Turn | undefined;
}

export async function createTurn(db: DB, specificationId: number, input: CreateTurnInput): Promise<Turn> {
  const result = await db
    .insert(schema.turn)
    .values({
      specification_id: specificationId,
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

export async function updateTurn(db: DB, turnId: number, updates: UpdateTurnInput): Promise<void> {
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
  await db.update(schema.turn).set(values).where(eq(schema.turn.id, turnId)).run();
}

export async function createOption(db: DB, turnId: number, input: CreateOptionInput): Promise<Option> {
  const result = await db
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

export async function getActivePath(db: DB, specificationId: number): Promise<Turn[]> {
  const project = await db
    .select({ active_turn_id: schema.specification.active_turn_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!project?.active_turn_id) return [];

  // Walk the parent chain in a single SQLite call rather than N round-trips through
  // the async proxy. We bypass drizzle here because `mapResultRow` would need positional
  // arrays, while the raw query naturally returns objects keyed by column name — exactly
  // what the `Turn[]` cast wants.
  return db.$client
    .prepare(
      `WITH RECURSIVE path AS (
         SELECT * FROM turn WHERE id = ?
         UNION ALL
         SELECT t.* FROM turn t JOIN path p ON t.id = p.parent_turn_id
       )
       SELECT * FROM path ORDER BY id ASC`,
    )
    .all(project.active_turn_id) as unknown as Turn[];
}

export async function listPhaseOutcomesForSpecification(
  db: DB,
  specificationId: number,
): Promise<PhaseOutcome[]> {
  return (await db
    .select()
    .from(schema.phaseOutcome)
    .where(eq(schema.phaseOutcome.specification_id, specificationId))
    .orderBy(desc(schema.phaseOutcome.id))
    .all()) as PhaseOutcome[];
}

async function reconcilePhaseOutcomesForSpecification(db: DB, specificationId: number): Promise<void> {
  const activeTurnIds = new Set((await getActivePath(db, specificationId)).map((turn) => turn.id));
  const outcomesToSupersede = (await listPhaseOutcomesForSpecification(db, specificationId)).filter(
    (outcome) =>
      (outcome.status === 'proposed' || outcome.status === 'confirmed') &&
      !activeTurnIds.has(outcome.proposal_turn_id),
  );

  for (const outcome of outcomesToSupersede) {
    await db
      .update(schema.phaseOutcome)
      .set({
        status: 'superseded',
        superseded_at: sql`datetime('now')`,
      })
      .where(eq(schema.phaseOutcome.id, outcome.id))
      .run();
  }
}

export async function createPhaseOutcome(db: DB, input: CreatePhaseOutcomeInput): Promise<PhaseOutcome> {
  const { specificationId } = input;
  if (!specificationId) {
    throw new Error('createPhaseOutcome requires specificationId');
  }

  const result = await db
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

async function getClosureBasisForConfirmationTurn(
  db: DB,
  confirmationTurnId: number,
): Promise<PhaseClosureBasis> {
  const confirmationTurn = await getTurn(db, confirmationTurnId);
  const confirmationPart = safeDeserializeUserParts(confirmationTurn?.user_parts).find(
    (part): part is DataConfirmationPart => part.type === 'data-confirmation',
  );
  const phaseClosureCommand = confirmationPart ? parsePhaseClosureCommand(confirmationPart.data) : null;

  return phaseClosureCommand?.closureBasis ?? 'interviewer_recommended';
}

export async function confirmPhaseOutcome(
  db: DB,
  phaseOutcomeId: number,
  confirmationTurnId: number,
): Promise<void> {
  await db
    .update(schema.phaseOutcome)
    .set({
      status: 'confirmed',
      closure_basis: await getClosureBasisForConfirmationTurn(db, confirmationTurnId),
      confirmation_turn_id: confirmationTurnId,
      confirmed_at: sql`datetime('now')`,
    })
    .where(eq(schema.phaseOutcome.id, phaseOutcomeId))
    .run();
}

export async function supersedePhaseOutcome(db: DB, phaseOutcomeId: number): Promise<void> {
  await db
    .update(schema.phaseOutcome)
    .set({
      status: 'superseded',
      superseded_at: sql`datetime('now')`,
    })
    .where(eq(schema.phaseOutcome.id, phaseOutcomeId))
    .run();
}

export async function createConfirmedPhaseOutcome(
  db: DB,
  input: CreatePhaseOutcomeInput & { confirmation_turn_id: number },
): Promise<PhaseOutcome> {
  const { specificationId } = input;
  if (!specificationId) {
    throw new Error('createConfirmedPhaseOutcome requires specificationId');
  }

  const result = await db
    .insert(schema.phaseOutcome)
    .values({
      specification_id: specificationId,
      phase: input.phase,
      proposal_turn_id: input.proposal_turn_id,
      summary: input.summary,
      status: 'confirmed',
      closure_basis: await getClosureBasisForConfirmationTurn(db, input.confirmation_turn_id),
      confirmation_turn_id: input.confirmation_turn_id,
      confirmed_at: sql`datetime('now')`,
    })
    .returning()
    .get();
  return result as PhaseOutcome;
}

export async function findProposedPhaseOutcomeByTurn(
  db: DB,
  specificationId: number,
  proposalTurnId: number,
): Promise<PhaseOutcome | undefined> {
  return (await db
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
    .get()) as PhaseOutcome | undefined;
}

export async function findPhaseOutcomeForTurn(
  db: DB,
  specificationId: number,
  proposalTurnId: number,
): Promise<PhaseOutcome | undefined> {
  return (await db
    .select()
    .from(schema.phaseOutcome)
    .where(
      and(
        eq(schema.phaseOutcome.specification_id, specificationId),
        eq(schema.phaseOutcome.proposal_turn_id, proposalTurnId),
      ),
    )
    .orderBy(desc(schema.phaseOutcome.id))
    .get()) as PhaseOutcome | undefined;
}

function getClosureBasisForOutcome(outcome: PhaseOutcome | undefined): ClosureBasis {
  if (!outcome || outcome.status !== 'confirmed' || !outcome.confirmation_turn_id) {
    return null;
  }

  return outcome.closure_basis ?? null;
}

async function findConfirmedPhaseOutcomeOnActivePath(
  db: DB,
  specificationId: number,
  phase: Phase,
): Promise<PhaseOutcome | undefined> {
  const activeTurnIds = new Set((await getActivePath(db, specificationId)).map((turn) => turn.id));
  if (activeTurnIds.size === 0) {
    return undefined;
  }

  return (await listPhaseOutcomesForSpecification(db, specificationId)).find(
    (outcome) =>
      outcome.phase === phase &&
      outcome.status === 'confirmed' &&
      activeTurnIds.has(outcome.proposal_turn_id),
  );
}

async function getAcceptedKnowledgeItemIdsForPhase(
  db: DB,
  specificationId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): Promise<Set<number>> {
  const confirmationTurnId = (await findConfirmedPhaseOutcomeOnActivePath(db, specificationId, phase))
    ?.confirmation_turn_id;
  if (!confirmationTurnId) {
    return new Set();
  }

  const rows = (await db
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
    .all()) as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

async function countAcceptedKnowledgeItemsForPhase(
  db: DB,
  specificationId: number,
  phase: 'requirements' | 'criteria',
  kind: 'requirement' | 'criterion',
): Promise<number> {
  return (await getAcceptedKnowledgeItemIdsForPhase(db, specificationId, phase, kind)).size;
}

export async function readWorkflowProjectionSnapshot(
  db: DB,
  specificationId: number,
): Promise<WorkflowProjectionSnapshot> {
  const activePath = await getActivePath(db, specificationId);
  const activeTurnIds = new Set(activePath.map((turn) => turn.id));
  const turns = (await Promise.all(
    activePath.map(async (turn) => ({
      phase: turn.phase,
      question: turn.question,
      answer: turn.answer,
      optionCount: (await getOptionsForTurn(db, turn.id)).length,
    })),
  )) satisfies WorkflowProjectionSnapshot['turns'];
  const phaseOutcomes = (await listPhaseOutcomesForSpecification(db, specificationId)).map((outcome) => ({
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
      requirements: await countAcceptedKnowledgeItemsForPhase(
        db,
        specificationId,
        'requirements',
        'requirement',
      ),
      criteria: await countAcceptedKnowledgeItemsForPhase(db, specificationId, 'criteria', 'criterion'),
    },
  };
}

export async function getCurrentWorkflowState(db: DB, specificationId: number): Promise<WorkflowState> {
  return projectWorkflowState(await readWorkflowProjectionSnapshot(db, specificationId));
}

export async function getStructuralArtifactTurnIds(db: DB, specificationId: number): Promise<number[]> {
  const activePath = await getActivePath(db, specificationId);
  const activeTurnIds = new Set(activePath.map((turn) => turn.id));
  const ids = new Set<number>();

  // Phase outcome anchors: proposal and confirmation turns
  for (const outcome of await listPhaseOutcomesForSpecification(db, specificationId)) {
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

export async function getCurrentPhase(db: DB, specificationId: number): Promise<Phase> {
  const workflow = await getCurrentWorkflowState(db, specificationId);
  return workflowPhaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? 'criteria';
}

export async function getOptionsForTurn(db: DB, turnId: number): Promise<Option[]> {
  return (await db
    .select()
    .from(schema.option)
    .where(eq(schema.option.turn_id, turnId))
    .orderBy(schema.option.position)
    .all()) as Option[];
}

export async function applyTurnResponseSelections(
  db: DB,
  turnId: number,
  selectedPositions: number[],
): Promise<void> {
  const uniquePositions = [...new Set(selectedPositions)];

  // Clear any previous selection for this turn.
  await db.update(schema.option).set({ is_selected: false }).where(eq(schema.option.turn_id, turnId)).run();

  if (uniquePositions.length === 0) {
    return;
  }

  // Mark the chosen options for this turn response.
  await db
    .update(schema.option)
    .set({ is_selected: true })
    .where(and(eq(schema.option.turn_id, turnId), inArray(schema.option.position, uniquePositions)))
    .run();
}

export async function advanceHead(db: DB, specificationId: number, turnId: number): Promise<void> {
  await db
    .update(schema.specification)
    .set({ active_turn_id: turnId, updated_at: sql`datetime('now')` })
    .where(eq(schema.specification.id, specificationId))
    .run();
  await reconcilePhaseOutcomesForSpecification(db, specificationId);
}

export async function updateSpecificationMode(
  db: DB,
  specificationId: number,
  mode: SpecificationMode,
): Promise<void> {
  await db
    .update(schema.specification)
    .set({ mode, updated_at: sql`datetime('now')` })
    .where(eq(schema.specification.id, specificationId))
    .run();
}

// --- Entity persistence (generic knowledge items + compatibility projections) ---

type PersistedKnowledgeItem = InferSelectModel<typeof schema.knowledgeItem>;
export type KnowledgeItem = Omit<PersistedKnowledgeItem, 'specification_id'> & {
  specification_id: number;
};
export type KnowledgeKind = Extract<KnowledgeItem['kind'], SharedKnowledgeKind>;
export type EntityCollection = KnowledgeEntityCollection;

export type Decision = SharedDecision & { specification_id: number };
export type Assumption = SharedAssumption & { specification_id: number };
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
export type EntitiesForSpecification = EntitiesData;

function projectKnowledgeItemEntity<K extends 'decision' | 'assumption'>(
  item: KnowledgeItem,
  kind: K,
): ProjectedKnowledgeEntity<K> {
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
    } as unknown as ProjectedKnowledgeEntity<K>;
  }

  return base as unknown as ProjectedKnowledgeEntity<K>;
}

export async function createDecision(
  db: DB,
  specificationId: number,
  content: string,
  rationale?: string | null,
): Promise<Decision> {
  return projectKnowledgeItemEntity(
    (await db
      .insert(schema.knowledgeItem)
      .values({
        specification_id: specificationId,
        kind: 'decision',
        subtype: null,
        content,
        rationale: rationale ?? null,
        kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE specification_id = ${specificationId} AND kind = 'decision')`,
      })
      .returning()
      .get()) as KnowledgeItem,
    'decision',
  );
}

export async function createAssumption(
  db: DB,
  specificationId: number,
  content: string,
): Promise<Assumption> {
  return projectKnowledgeItemEntity(
    (await db
      .insert(schema.knowledgeItem)
      .values({
        specification_id: specificationId,
        kind: 'assumption',
        subtype: null,
        content,
        rationale: null,
        kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE specification_id = ${specificationId} AND kind = 'assumption')`,
      })
      .returning()
      .get()) as KnowledgeItem,
    'assumption',
  );
}

export async function linkDecisionToTurn(db: DB, decisionId: number, turnId: number): Promise<void> {
  await linkKnowledgeItemToTurn(db, decisionId, turnId);
}

export async function linkAssumptionToTurn(db: DB, assumptionId: number, turnId: number): Promise<void> {
  await linkKnowledgeItemToTurn(db, assumptionId, turnId);
}

export async function createKnowledgeItem(
  db: DB,
  specificationId: number,
  kind: KnowledgeKind,
  content: string,
  options?: { subtype?: string | null; rationale?: string | null },
): Promise<KnowledgeItem> {
  return (await db
    .insert(schema.knowledgeItem)
    .values({
      specification_id: specificationId,
      kind,
      subtype: options?.subtype ?? null,
      content,
      rationale: options?.rationale ?? null,
      kind_ordinal: sql`(SELECT COALESCE(MAX(kind_ordinal), 0) + 1 FROM knowledge_item WHERE specification_id = ${specificationId} AND kind = ${kind})`,
    })
    .returning()
    .get()) as KnowledgeItem;
}

export async function linkKnowledgeItemToTurn(
  db: DB,
  itemId: number,
  turnId: number,
  relation: InferSelectModel<typeof schema.turnKnowledgeItem>['relation'] = 'captured',
): Promise<void> {
  await db
    .insert(schema.turnKnowledgeItem)
    .values({ turn_id: turnId, item_id: itemId, relation })
    .onConflictDoNothing()
    .run();
}

async function addKnowledgeEdge(
  db: DB,
  fromItemId: number,
  toItemId: number,
  relation: InferSelectModel<typeof schema.knowledgeEdge>['relation'],
): Promise<void> {
  await db
    .insert(schema.knowledgeEdge)
    .values({ from_item_id: fromItemId, to_item_id: toItemId, relation })
    .run();
}

export async function addDecisionParentDecision(
  db: DB,
  decisionId: number,
  parentDecisionId: number,
): Promise<void> {
  await addKnowledgeEdge(db, decisionId, parentDecisionId, 'depends_on');
}

export async function addDecisionParentAssumption(
  db: DB,
  decisionId: number,
  parentAssumptionId: number,
): Promise<void> {
  await addKnowledgeEdge(db, decisionId, parentAssumptionId, 'depends_on');
}

export async function addAssumptionParentAssumption(
  db: DB,
  assumptionId: number,
  parentAssumptionId: number,
): Promise<void> {
  await addKnowledgeEdge(db, assumptionId, parentAssumptionId, 'depends_on');
}

async function getKnowledgeItemsForSpecificationByKind(
  db: DB,
  specificationId: number,
  kind: GenericKnowledgeKind | 'decision' | 'assumption',
): Promise<KnowledgeItem[]> {
  return (await db
    .select()
    .from(schema.knowledgeItem)
    .where(
      and(eq(schema.knowledgeItem.specification_id, specificationId), eq(schema.knowledgeItem.kind, kind)),
    )
    .all()) as KnowledgeItem[];
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

async function getGenericKnowledgeEntitiesForSpecificationByKind<K extends GenericKnowledgeKind>(
  db: DB,
  specificationId: number,
  kind: K,
): Promise<Array<GenericKnowledgeEntity<K>>> {
  return (await getKnowledgeItemsForSpecificationByKind(db, specificationId, kind)).map((item) => ({
    ...item,
    specification_id: item.specification_id,
    kind,
  })) as unknown as Array<GenericKnowledgeEntity<K>>;
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

async function findExistingKnowledgeItemForReviewSetItem(
  db: DB,
  specificationId: number,
  kind: 'requirement' | 'criterion',
  content: string,
): Promise<KnowledgeItem | undefined> {
  return (await db
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
    .get()) as KnowledgeItem | undefined;
}

async function getTurnLineageToRoot(db: DB, turnId: number): Promise<Turn[]> {
  const lineage: Turn[] = [];
  let currentTurn = await getTurn(db, turnId);

  while (currentTurn) {
    lineage.push(currentTurn);
    currentTurn = currentTurn.parent_turn_id ? await getTurn(db, currentTurn.parent_turn_id) : undefined;
  }

  return lineage.reverse();
}

async function getEffectiveAcceptedReviewSetForTurn(
  db: DB,
  turnId: number,
  phase: 'requirements' | 'criteria',
): Promise<ReviewSetData | null> {
  let normalizedReviewSet: ReviewSetData | null = null;

  for (const turn of await getTurnLineageToRoot(db, turnId)) {
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

async function materializeAcceptedReviewSetItems(
  db: DB,
  specificationId: number,
  turnId: number,
  phase: 'requirements' | 'criteria',
): Promise<number[]> {
  const reviewSet = await getEffectiveAcceptedReviewSetForTurn(db, turnId, phase);
  if (!reviewSet || reviewSet.phase !== phase) {
    throw new Error(
      `Cannot materialize accepted ${phase} review: persisted review set is missing or mismatched on turn ${turnId}`,
    );
  }

  const kind = phase === 'requirements' ? 'requirement' : 'criterion';
  const itemIds: number[] = [];

  for (const item of reviewSet.items) {
    const existingItem = await findExistingKnowledgeItemForReviewSetItem(
      db,
      specificationId,
      kind,
      item.content,
    );
    const materializedItem =
      existingItem ??
      (await createKnowledgeItem(db, specificationId, kind, item.content, {
        rationale: item.rationale ?? null,
      }));
    await linkKnowledgeItemToTurn(db, materializedItem.id, turnId, 'reviewed');
    itemIds.push(materializedItem.id);
  }

  return itemIds;
}

export async function getAcceptedRequirementEntitiesForSpecification(
  db: DB,
  specificationId: number,
): Promise<RequirementEntity[]> {
  const acceptedIds = await getAcceptedKnowledgeItemIdsForPhase(
    db,
    specificationId,
    'requirements',
    'requirement',
  );
  if (acceptedIds.size === 0) {
    return [];
  }

  return (await getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, 'requirement')).filter(
    (item) => acceptedIds.has(item.id),
  );
}

export async function getAcceptedCriterionEntitiesForSpecification(
  db: DB,
  specificationId: number,
): Promise<CriterionEntity[]> {
  const acceptedIds = await getAcceptedKnowledgeItemIdsForPhase(db, specificationId, 'criteria', 'criterion');
  if (acceptedIds.size === 0) {
    return [];
  }

  return (await getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, 'criterion')).filter(
    (item) => acceptedIds.has(item.id),
  );
}

export async function materializeAcceptedRequirementsReviewSet(
  db: DB,
  specificationId: number,
  turnId: number,
): Promise<number[]> {
  return await materializeAcceptedReviewSetItems(db, specificationId, turnId, 'requirements');
}

export async function materializeAcceptedCriteriaReviewSet(
  db: DB,
  specificationId: number,
  turnId: number,
): Promise<number[]> {
  return await materializeAcceptedReviewSetItems(db, specificationId, turnId, 'criteria');
}

export async function getGroundingBundleForSpecification(db: DB, specificationId: number) {
  return {
    goals: await getKnowledgeItemsForSpecificationByKind(db, specificationId, 'goal'),
    terms: await getKnowledgeItemsForSpecificationByKind(db, specificationId, 'term'),
    contexts: await getKnowledgeItemsForSpecificationByKind(db, specificationId, 'context'),
    constraints: await getKnowledgeItemsForSpecificationByKind(db, specificationId, 'constraint'),
  };
}

async function getKnowledgeItemIdsLinkedToActivePath(db: DB, specificationId: number): Promise<Set<number>> {
  const activeTurnIds = (await getActivePath(db, specificationId)).map((turn) => turn.id);
  if (activeTurnIds.length === 0) {
    return new Set();
  }

  const rows = (await db
    .select({ itemId: schema.turnKnowledgeItem.item_id })
    .from(schema.turnKnowledgeItem)
    .innerJoin(schema.knowledgeItem, eq(schema.knowledgeItem.id, schema.turnKnowledgeItem.item_id))
    .where(
      and(
        eq(schema.knowledgeItem.specification_id, specificationId),
        inArray(schema.turnKnowledgeItem.turn_id, activeTurnIds),
      ),
    )
    .all()) as Array<{ itemId: number }>;

  return new Set(rows.map((row) => row.itemId));
}

export type EntityProjectionMode = 'project-wide' | 'active-path';

async function getSpecificationWideEntitiesForSpecification(
  db: DB,
  specificationId: number,
): Promise<EntitiesForSpecification> {
  const genericKnowledgeCollections = Object.fromEntries(
    await Promise.all(
      genericKnowledgeKindRegistry.map(async (entry) => [
        entry.collectionKey,
        withReferenceCodes(
          await getGenericKnowledgeEntitiesForSpecificationByKind(db, specificationId, entry.kind),
        ).map(({ kind_ordinal: _, ...item }) => item),
      ]),
    ),
  ) as Pick<EntitiesForSpecification, GenericKnowledgeCollectionKey>;
  const decisions = withReferenceCodes(
    (await getKnowledgeItemsForSpecificationByKind(db, specificationId, 'decision'))
      .map((item) => projectKnowledgeItemEntity(item, 'decision'))
      .map((decision) => ({
        ...decision,
        kind: 'decision' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...decision }) => decision);
  const assumptions = withReferenceCodes(
    (await getKnowledgeItemsForSpecificationByKind(db, specificationId, 'assumption'))
      .map((item) => projectKnowledgeItemEntity(item, 'assumption'))
      .map((assumption) => ({
        ...assumption,
        kind: 'assumption' as const,
      })),
  ).map(({ kind: _, kind_ordinal: __, ...assumption }) => assumption);
  const sourceItem = alias(schema.knowledgeItem, 'source');
  const targetItem = alias(schema.knowledgeItem, 'target');
  const kindOrdering = (kindColumn: typeof sourceItem.kind | typeof targetItem.kind) =>
    sql`CASE ${kindColumn} WHEN 'decision' THEN 0 WHEN 'assumption' THEN 1 ELSE 2 END`;
  const relationships = (await db
    .select({
      type: schema.knowledgeEdge.relation,
      source_kind: sourceItem.kind,
      source_id: sourceItem.id,
      target_kind: targetItem.kind,
      target_id: targetItem.id,
    })
    .from(schema.knowledgeEdge)
    .innerJoin(sourceItem, eq(sourceItem.id, schema.knowledgeEdge.from_item_id))
    .innerJoin(targetItem, eq(targetItem.id, schema.knowledgeEdge.to_item_id))
    .where(
      and(eq(sourceItem.specification_id, specificationId), eq(targetItem.specification_id, specificationId)),
    )
    .orderBy(kindOrdering(sourceItem.kind), sourceItem.id, kindOrdering(targetItem.kind), targetItem.id)
    .all()) as Array<{
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

export async function getEntitiesForSpecificationByMode(
  db: DB,
  specificationId: number,
  mode: EntityProjectionMode,
): Promise<EntitiesForSpecification> {
  const projectWideEntities = await getSpecificationWideEntitiesForSpecification(db, specificationId);
  if (mode === 'project-wide') {
    return projectWideEntities;
  }

  return filterEntitiesToActivePath(
    projectWideEntities,
    await getKnowledgeItemIdsLinkedToActivePath(db, specificationId),
    {
      acceptedRequirementIds: await getAcceptedKnowledgeItemIdsForPhase(
        db,
        specificationId,
        'requirements',
        'requirement',
      ),
      acceptedCriterionIds: await getAcceptedKnowledgeItemIdsForPhase(
        db,
        specificationId,
        'criteria',
        'criterion',
      ),
    },
  );
}

export async function getEntitiesForSpecification(
  db: DB,
  specificationId: number,
): Promise<EntitiesForSpecification> {
  return await getEntitiesForSpecificationByMode(db, specificationId, 'project-wide');
}

export async function getEntitiesForSpecificationOnActivePath(
  db: DB,
  specificationId: number,
): Promise<EntitiesForSpecification> {
  return await getEntitiesForSpecificationByMode(db, specificationId, 'active-path');
}

export async function getCapturedItemsForTurns(
  db: DB,
  specificationId: number,
  turnIds: readonly number[],
): Promise<Map<number, NonNullable<SpecificationStateTurn['captured_items']>>> {
  const capturedItemsByTurn = new Map<number, NonNullable<SpecificationStateTurn['captured_items']>>();
  if (turnIds.length === 0) {
    return capturedItemsByTurn;
  }

  const projectWideEntities = await getEntitiesForSpecification(db, specificationId);
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

  const rows = (await db
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
    .all()) as Array<{ turnId: number; itemId: number }>;

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
