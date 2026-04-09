import { describe, expect, it } from 'vitest';

import {
  createForcedPhaseClosureConfirmation,
  createRecommendedPhaseClosureConfirmation,
  dataConfirmationSchema,
  getForceClosePhaseAction,
  parsePhaseClosureCommand,
  type WorkflowPhase,
  type WorkflowPhaseActionProjection,
} from './phase-close.js';

function createWorkflow(
  overrides: Partial<
    Record<WorkflowPhase, Partial<WorkflowPhaseActionProjection['phases'][WorkflowPhase]>>
  > = {},
): WorkflowPhaseActionProjection {
  return {
    phases: {
      scope: { status: 'unstarted', closeability: false, proposalPending: false, ...overrides.scope },
      design: { status: 'unstarted', closeability: false, proposalPending: false, ...overrides.design },
      requirements: {
        status: 'unstarted',
        closeability: false,
        proposalPending: false,
        ...overrides.requirements,
      },
      criteria: { status: 'unstarted', closeability: false, proposalPending: false, ...overrides.criteria },
    },
  };
}

describe('phase-close commands', () => {
  it('parses interviewer-recommended proposal confirmations into an explicit command', () => {
    expect(
      parsePhaseClosureCommand({
        turnId: 5,
        phase: 'design',
        confirmed: true,
        closureBasis: 'interviewer_recommended',
      }),
    ).toEqual({
      kind: 'confirm-proposed-phase-closure',
      proposalTurnId: 5,
      phase: 'design',
      closureBasis: 'interviewer_recommended',
    });
  });

  it('parses user-forced phase closes into an explicit command', () => {
    expect(
      parsePhaseClosureCommand({ phase: 'design', confirmed: true, closureBasis: 'user_forced' }),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'design',
      closureBasis: 'user_forced',
    });
  });

  it('treats unconfirmed confirmation payloads as non-commands', () => {
    expect(parsePhaseClosureCommand({ turnId: 5, confirmed: false })).toBeNull();
  });

  it('builds interviewer-recommended confirmation payloads that still validate through the existing schema', () => {
    expect(dataConfirmationSchema.parse(createRecommendedPhaseClosureConfirmation('scope', 7))).toEqual({
      turnId: 7,
      phase: 'scope',
      confirmed: true,
      closureBasis: 'interviewer_recommended',
    });
  });

  it('builds forced-close confirmation payloads that still validate through the existing schema', () => {
    expect(dataConfirmationSchema.parse(createForcedPhaseClosureConfirmation('design'))).toEqual({
      phase: 'design',
      confirmed: true,
      closureBasis: 'user_forced',
    });
  });
});

describe('force-close phase action projection', () => {
  it('allows force-closing the active design phase when it is closeable and has no pending proposal', () => {
    expect(
      getForceClosePhaseAction(
        createWorkflow({
          scope: { status: 'closed' },
          design: { status: 'in_progress', closeability: true },
        }),
        'design',
      ),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'design',
      available: true,
      reason: null,
    });
  });

  it('rejects force-close for unsupported phases', () => {
    expect(
      getForceClosePhaseAction(
        createWorkflow({
          scope: { status: 'in_progress', closeability: true },
        }),
        'scope',
      ),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'scope',
      available: false,
      reason: 'unsupported_phase',
    });
  });

  it('rejects force-close when design is not the active phase', () => {
    expect(
      getForceClosePhaseAction(
        createWorkflow({
          scope: { status: 'closed' },
          design: { status: 'closed' },
          requirements: { status: 'in_progress' },
        }),
        'design',
      ),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'design',
      available: false,
      reason: 'inactive_phase',
    });
  });

  it('rejects force-close when the active design phase is not closeable', () => {
    expect(
      getForceClosePhaseAction(
        createWorkflow({
          scope: { status: 'closed' },
          design: { status: 'in_progress', closeability: false },
        }),
        'design',
      ),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'design',
      available: false,
      reason: 'not_closeable',
    });
  });

  it('rejects force-close when the active design phase already has a pending proposal', () => {
    expect(
      getForceClosePhaseAction(
        createWorkflow({
          scope: { status: 'closed' },
          design: { status: 'in_progress', closeability: true, proposalPending: true },
        }),
        'design',
      ),
    ).toEqual({
      kind: 'force-close-active-phase',
      phase: 'design',
      available: false,
      reason: 'proposal_pending',
    });
  });
});
