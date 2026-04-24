import type { ReadinessBand, WorkflowPhaseState, WorkflowState } from '@/shared/api-types.js';
import { workflowPhaseOrder, type PhaseClosureBasis, type WorkflowPhase } from '@/shared/phase-close.js';

type WorkflowProjectionOutcomeStatus = 'proposed' | 'confirmed' | 'superseded';

export interface WorkflowProjectionTurn {
  readonly phase: WorkflowPhase;
  readonly question: string;
  readonly answer: string | null;
  readonly optionCount: number;
}

export interface WorkflowProjectionOutcome {
  readonly phase: WorkflowPhase;
  readonly status: WorkflowProjectionOutcomeStatus;
  readonly proposalTurnId: number;
  readonly summary: string | null;
  readonly closureBasis: PhaseClosureBasis | null;
  readonly onActivePath: boolean;
}

export interface WorkflowProjectionSnapshot {
  readonly turns: readonly WorkflowProjectionTurn[];
  readonly phaseOutcomes: readonly WorkflowProjectionOutcome[];
  readonly acceptedReviewItemCounts: {
    readonly requirements: number;
    readonly criteria: number;
  };
}

interface WorkflowReviewCoverage {
  readonly requirements: boolean;
  readonly criteria: boolean;
}

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

function createEmptyWorkflowState(): WorkflowState {
  return {
    phases: {
      grounding: createEmptyWorkflowPhaseState(),
      design: createEmptyWorkflowPhaseState(),
      requirements: createEmptyWorkflowPhaseState(),
      criteria: createEmptyWorkflowPhaseState(),
    },
  };
}

function createCountRecord(value = 0): Record<WorkflowPhase, number> {
  return Object.fromEntries(workflowPhaseOrder.map((phase) => [phase, value])) as Record<
    WorkflowPhase,
    number
  >;
}

function isSubstantiveTurn(turn: WorkflowProjectionTurn): boolean {
  return turn.question.trim().length > 0 || turn.optionCount > 0;
}

function hasCompletedAnswer(turn: WorkflowProjectionTurn): boolean {
  return turn.answer !== null && turn.answer.trim().length > 0;
}

function getSubstantiveTurnCounts(snapshot: WorkflowProjectionSnapshot): Record<WorkflowPhase, number> {
  const counts = createCountRecord();

  for (const turn of snapshot.turns) {
    if (!isSubstantiveTurn(turn)) {
      continue;
    }
    counts[turn.phase] += 1;
  }

  return counts;
}

function getAnsweredTurnCounts(snapshot: WorkflowProjectionSnapshot): Record<WorkflowPhase, number> {
  const counts = createCountRecord();

  for (const turn of snapshot.turns) {
    if (!isSubstantiveTurn(turn) || !hasCompletedAnswer(turn)) {
      continue;
    }
    counts[turn.phase] += 1;
  }

  return counts;
}

function getReviewCoverage(snapshot: WorkflowProjectionSnapshot): WorkflowReviewCoverage {
  return {
    requirements: snapshot.acceptedReviewItemCounts.requirements > 0,
    criteria: snapshot.acceptedReviewItemCounts.criteria > 0,
  };
}

function isProjectableOutcome(outcome: WorkflowProjectionOutcome): outcome is WorkflowProjectionOutcome & {
  status: Extract<WorkflowProjectionOutcomeStatus, 'proposed' | 'confirmed'>;
} {
  return (outcome.status === 'proposed' || outcome.status === 'confirmed') && outcome.onActivePath;
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

function getPhaseCloseability({
  phase,
  isConfirmed,
  hasTurnHistory,
  reviewCoverage,
}: {
  phase: WorkflowPhase;
  isConfirmed: boolean;
  hasTurnHistory: boolean;
  reviewCoverage: WorkflowReviewCoverage;
}): boolean {
  if (isConfirmed) {
    return false;
  }

  if (phase === 'requirements') {
    return reviewCoverage.requirements;
  }

  if (phase === 'criteria') {
    return reviewCoverage.criteria;
  }

  return hasTurnHistory;
}

export function projectWorkflowState(snapshot: WorkflowProjectionSnapshot): WorkflowState {
  const workflow = createEmptyWorkflowState();
  const substantiveTurnCounts = getSubstantiveTurnCounts(snapshot);
  const answeredTurnCounts = getAnsweredTurnCounts(snapshot);
  const reviewCoverage = getReviewCoverage(snapshot);
  const activeOutcomes = snapshot.phaseOutcomes.filter((outcome) => isProjectableOutcome(outcome));
  const firstUnclosedPhase =
    workflowPhaseOrder.find(
      (phase) => activeOutcomes.find((entry) => entry.phase === phase)?.status !== 'confirmed',
    ) ?? 'criteria';

  for (const phase of workflowPhaseOrder) {
    const outcome = activeOutcomes.find((entry) => entry.phase === phase);
    const isConfirmed = outcome?.status === 'confirmed';
    const proposalPending = outcome?.status === 'proposed';
    const hasTurnHistory = substantiveTurnCounts[phase] > 0;

    workflow.phases[phase] = {
      status: isConfirmed
        ? 'closed'
        : phase === firstUnclosedPhase || hasTurnHistory
          ? 'in_progress'
          : 'unstarted',
      closeability: getPhaseCloseability({
        phase,
        isConfirmed,
        hasTurnHistory,
        reviewCoverage,
      }),
      readiness: getReadinessBand(answeredTurnCounts[phase]),
      closureBasis: outcome?.closureBasis ?? null,
      proposalPending,
      turnId: outcome?.proposalTurnId ?? null,
      summary: outcome?.summary ?? null,
    };
  }

  return workflow;
}
