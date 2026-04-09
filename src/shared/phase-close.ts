import * as z from 'zod/v4';

export const workflowPhaseOrder = ['scope', 'design', 'requirements', 'criteria'] as const;
export const workflowPhaseSchema = z.enum(workflowPhaseOrder);
export const phaseClosureBasisSchema = z.enum(['interviewer_recommended', 'user_forced']);

export const dataConfirmationSchema = z
  .object({
    turnId: z.number().optional(),
    phase: workflowPhaseSchema.optional(),
    confirmed: z.boolean(),
    closureBasis: phaseClosureBasisSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const closureBasis =
      value.closureBasis ?? (value.turnId !== undefined ? 'interviewer_recommended' : undefined);

    if (closureBasis === 'user_forced') {
      if (!value.phase) {
        ctx.addIssue({
          code: 'custom',
          message: 'phase is required for a user-forced phase close',
          path: ['phase'],
        });
      }
      return;
    }

    if (value.turnId === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'turnId is required for interviewer-recommended confirmations',
        path: ['turnId'],
      });
    }
  });

export type WorkflowPhase = z.infer<typeof workflowPhaseSchema>;
export type PhaseClosureBasis = z.infer<typeof phaseClosureBasisSchema>;
export type DataConfirmation = z.infer<typeof dataConfirmationSchema>;

export type PhaseClosureCommand =
  | {
      kind: 'confirm-proposed-phase-closure';
      proposalTurnId: number;
      phase?: WorkflowPhase;
      closureBasis: 'interviewer_recommended';
    }
  | {
      kind: 'force-close-active-phase';
      phase: WorkflowPhase;
      closureBasis: 'user_forced';
    };

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

function inferPhaseClosureBasis(value: DataConfirmation): PhaseClosureBasis | null {
  return value.closureBasis ?? (value.turnId !== undefined ? 'interviewer_recommended' : null);
}

export function parsePhaseClosureCommand(value: DataConfirmation): PhaseClosureCommand | null {
  if (!value.confirmed) {
    return null;
  }

  const closureBasis = inferPhaseClosureBasis(value);
  if (closureBasis === 'user_forced') {
    if (!value.phase) {
      return null;
    }

    return {
      kind: 'force-close-active-phase',
      phase: value.phase,
      closureBasis,
    };
  }

  if (value.turnId === undefined) {
    return null;
  }

  return {
    kind: 'confirm-proposed-phase-closure',
    proposalTurnId: value.turnId,
    ...(value.phase ? { phase: value.phase } : {}),
    closureBasis: 'interviewer_recommended',
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
    turnId: proposalTurnId,
    phase,
    confirmed: true,
    closureBasis: 'interviewer_recommended',
  };
}

export function createForcedPhaseClosureConfirmation(phase: WorkflowPhase): DataConfirmation {
  return {
    phase,
    confirmed: true,
    closureBasis: 'user_forced',
  };
}
