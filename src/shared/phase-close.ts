import * as z from 'zod/v4';

export const workflowPhaseSchema = z.enum(['scope', 'design', 'requirements', 'criteria']);
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
