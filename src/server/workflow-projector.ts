import type { ReadinessBand, WorkflowPhaseState, WorkflowState } from '@/shared/api-types.js';
import { workflowPhaseOrder, type PhaseClosureBasis, type WorkflowPhase } from '@/shared/phase-close.js';

type ProjectablePhaseOutcomeStatus = 'proposed' | 'confirmed';

export interface WorkflowProjectionOutcome {
  readonly phase: WorkflowPhase;
  readonly status: ProjectablePhaseOutcomeStatus;
  readonly proposalTurnId: number;
  readonly summary: string | null;
  readonly closureBasis: PhaseClosureBasis | null;
}

export interface WorkflowProjectionSnapshot {
  readonly substantiveTurnCounts: Record<WorkflowPhase, number>;
  readonly answeredTurnCounts: Record<WorkflowPhase, number>;
  readonly reviewCoverage: {
    readonly requirements: boolean;
    readonly criteria: boolean;
  };
  readonly activeOutcomes: readonly WorkflowProjectionOutcome[];
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
  reviewCoverage: WorkflowProjectionSnapshot['reviewCoverage'];
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
  const firstUnclosedPhase =
    workflowPhaseOrder.find(
      (phase) => snapshot.activeOutcomes.find((entry) => entry.phase === phase)?.status !== 'confirmed',
    ) ?? 'criteria';

  for (const phase of workflowPhaseOrder) {
    const outcome = snapshot.activeOutcomes.find((entry) => entry.phase === phase);
    const isConfirmed = outcome?.status === 'confirmed';
    const proposalPending = outcome?.status === 'proposed';
    const hasTurnHistory = snapshot.substantiveTurnCounts[phase] > 0;

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
        reviewCoverage: snapshot.reviewCoverage,
      }),
      readiness: getReadinessBand(snapshot.answeredTurnCounts[phase]),
      closureBasis: outcome?.closureBasis ?? null,
      proposalPending,
      turnId: outcome?.proposalTurnId ?? null,
      summary: outcome?.summary ?? null,
    };
  }

  return workflow;
}
