import * as z from 'zod/v4';

export const workflowPhaseOrder = ['scope', 'design', 'requirements', 'criteria'] as const;
export const workflowPhaseSchema = z.enum(workflowPhaseOrder);
export const phaseClosureBasisSchema = z.enum(['interviewer_recommended', 'user_forced']);

const confirmProposedPhaseClosureSchema = z.object({
  kind: z.literal('confirm-proposed-phase-closure'),
  proposalTurnId: z.number(),
  phase: workflowPhaseSchema,
});

const forceCloseActivePhaseSchema = z.object({
  kind: z.literal('force-close-active-phase'),
  phase: workflowPhaseSchema,
});

export const dataConfirmationSchema = z.discriminatedUnion('kind', [
  confirmProposedPhaseClosureSchema,
  forceCloseActivePhaseSchema,
]);

export type WorkflowPhase = z.infer<typeof workflowPhaseSchema>;
export type PhaseClosureBasis = z.infer<typeof phaseClosureBasisSchema>;

export type PhaseClosureCommand =
  | {
      kind: 'confirm-proposed-phase-closure';
      proposalTurnId: number;
      phase: WorkflowPhase;
      closureBasis: 'interviewer_recommended';
    }
  | {
      kind: 'force-close-active-phase';
      phase: WorkflowPhase;
      closureBasis: 'user_forced';
    };

export type DataConfirmation = z.infer<typeof dataConfirmationSchema>;

export type WorkflowPhaseActionState = {
  status: 'unstarted' | 'in_progress' | 'closed';
  closeability: boolean;
  proposalPending: boolean;
};

export type WorkflowPhaseActionProjection = {
  phases: Record<WorkflowPhase, WorkflowPhaseActionState>;
};

export type ForceClosePhaseAction = {
  kind: 'force-close-active-phase';
  phase: WorkflowPhase;
  available: boolean;
  reason: 'unsupported_phase' | 'inactive_phase' | 'not_closeable' | 'proposal_pending' | null;
};

export function parsePhaseClosureCommand(value: unknown): PhaseClosureCommand | null {
  const result = dataConfirmationSchema.safeParse(value);
  if (!result.success) {
    return null;
  }

  if (result.data.kind === 'confirm-proposed-phase-closure') {
    return {
      ...result.data,
      closureBasis: 'interviewer_recommended',
    };
  }

  return {
    ...result.data,
    closureBasis: 'user_forced',
  };
}

export function getCurrentWorkflowPhase(workflow: WorkflowPhaseActionProjection): WorkflowPhase {
  return workflowPhaseOrder.find((phase) => workflow.phases[phase].status !== 'closed') ?? 'criteria';
}

export function getForceClosePhaseAction(
  workflow: WorkflowPhaseActionProjection,
  phase: WorkflowPhase,
): ForceClosePhaseAction {
  if (phase !== 'design') {
    return {
      kind: 'force-close-active-phase',
      phase,
      available: false,
      reason: 'unsupported_phase',
    };
  }

  if (phase !== getCurrentWorkflowPhase(workflow)) {
    return {
      kind: 'force-close-active-phase',
      phase,
      available: false,
      reason: 'inactive_phase',
    };
  }

  const state = workflow.phases[phase];
  if (!state.closeability) {
    return {
      kind: 'force-close-active-phase',
      phase,
      available: false,
      reason: 'not_closeable',
    };
  }

  if (state.proposalPending) {
    return {
      kind: 'force-close-active-phase',
      phase,
      available: false,
      reason: 'proposal_pending',
    };
  }

  return {
    kind: 'force-close-active-phase',
    phase,
    available: true,
    reason: null,
  };
}

export function createRecommendedPhaseClosureConfirmation(
  phase: WorkflowPhase,
  proposalTurnId: number,
): DataConfirmation {
  return {
    kind: 'confirm-proposed-phase-closure',
    proposalTurnId,
    phase,
  };
}

export function createForcedPhaseClosureConfirmation(phase: WorkflowPhase): DataConfirmation {
  return {
    kind: 'force-close-active-phase',
    phase,
  };
}
