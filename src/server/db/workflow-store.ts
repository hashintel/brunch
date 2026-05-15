import { and, desc, eq, sql, type InferSelectModel } from 'drizzle-orm';

import type {
  ReadinessBand,
  WorkflowPhaseState as SharedWorkflowPhaseState,
  WorkflowPhaseStatus,
  WorkflowState as SharedWorkflowState,
} from '@/shared/api-types.js';
import {
  parsePhaseClosureCommand,
  workflowPhaseOrder,
  type PhaseClosureBasis,
} from '@/shared/phase-close.js';

import type { DB } from '../db.js';
import { safeDeserializeUserParts, type DataConfirmationPart } from '../parts.js';
import * as schema from '../schema.js';
import { projectWorkflowState, type WorkflowProjectionSnapshot } from '../workflow-projector.js';
import { countAcceptedKnowledgeItemsForPhase } from './entity-projection-store.js';

type PersistedTurn = InferSelectModel<typeof schema.turn>;
type Turn = Omit<PersistedTurn, 'specification_id'> & {
  specification_id: number;
};
export type Phase = Turn['phase'];
export type PhaseOutcome = InferSelectModel<typeof schema.phaseOutcome>;
export type PhaseOutcomeStatus = PhaseOutcome['status'];
export type { WorkflowPhaseStatus, ReadinessBand };
export type WorkflowPhaseState = SharedWorkflowPhaseState;
export type WorkflowState = SharedWorkflowState;
export type ClosureBasis = PhaseClosureBasis | null;

export interface CreatePhaseOutcomeInput {
  specificationId: number;
  phase: Phase;
  proposal_turn_id: number;
  summary: string;
}

function getTurn(db: DB, turnId: number): Turn | undefined {
  return db.select().from(schema.turn).where(eq(schema.turn.id, turnId)).get() as Turn | undefined;
}

function getActivePath(db: DB, specificationId: number): Turn[] {
  const project = db
    .select({ active_turn_id: schema.specification.active_turn_id })
    .from(schema.specification)
    .where(eq(schema.specification.id, specificationId))
    .get();
  if (!project?.active_turn_id) return [];

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

function getOptionsForTurn(db: DB, turnId: number): Array<InferSelectModel<typeof schema.option>> {
  return db
    .select()
    .from(schema.option)
    .where(eq(schema.option.turn_id, turnId))
    .orderBy(schema.option.position)
    .all() as Array<InferSelectModel<typeof schema.option>>;
}

export function listPhaseOutcomesForSpecification(db: DB, specificationId: number): PhaseOutcome[] {
  return db
    .select()
    .from(schema.phaseOutcome)
    .where(eq(schema.phaseOutcome.specification_id, specificationId))
    .orderBy(desc(schema.phaseOutcome.id))
    .all() as PhaseOutcome[];
}

export function reconcilePhaseOutcomesForSpecification(db: DB, specificationId: number): void {
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

  return db
    .insert(schema.phaseOutcome)
    .values({
      specification_id: specificationId,
      phase: input.phase,
      proposal_turn_id: input.proposal_turn_id,
      summary: input.summary,
      status: 'proposed',
    })
    .returning()
    .get() as PhaseOutcome;
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
      confirmation_turn_id: confirmationTurnId,
      closure_basis: getClosureBasisForConfirmationTurn(db, confirmationTurnId),
      confirmed_at: sql`datetime('now')`,
    })
    .where(eq(schema.phaseOutcome.id, phaseOutcomeId))
    .run();
}

export function supersedePhaseOutcome(db: DB, phaseOutcomeId: number): void {
  db.update(schema.phaseOutcome)
    .set({ status: 'superseded', superseded_at: sql`datetime('now')` })
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

  return db
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
    .get() as PhaseOutcome;
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
