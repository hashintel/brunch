import { describe, expect, it } from 'vitest';

import { workflowPhaseOrder, type WorkflowPhase } from '@/shared/phase-close.js';

import { projectWorkflowState, type WorkflowProjectionSnapshot } from './workflow-projector.js';

function createCountRecord(value = 0): Record<WorkflowPhase, number> {
  return Object.fromEntries(workflowPhaseOrder.map((phase) => [phase, value])) as Record<
    WorkflowPhase,
    number
  >;
}

function createSnapshot(overrides: Partial<WorkflowProjectionSnapshot> = {}): WorkflowProjectionSnapshot {
  return {
    substantiveTurnCounts: createCountRecord(0),
    answeredTurnCounts: createCountRecord(0),
    reviewCoverage: {
      requirements: false,
      criteria: false,
    },
    activeOutcomes: [],
    ...overrides,
  };
}

describe('projectWorkflowState', () => {
  it('projects phase status, readiness, and proposal state from a durable snapshot', () => {
    const workflow = projectWorkflowState(
      createSnapshot({
        substantiveTurnCounts: {
          grounding: 2,
          design: 1,
          requirements: 0,
          criteria: 0,
        },
        answeredTurnCounts: {
          grounding: 2,
          design: 1,
          requirements: 0,
          criteria: 0,
        },
        activeOutcomes: [
          {
            phase: 'grounding',
            status: 'confirmed',
            proposalTurnId: 2,
            summary: 'Grounding is complete.',
            closureBasis: 'interviewer_recommended',
          },
          {
            phase: 'design',
            status: 'proposed',
            proposalTurnId: 3,
            summary: 'Design is ready to close.',
            closureBasis: null,
          },
        ],
      }),
    );

    expect(workflow.phases.grounding).toMatchObject({
      status: 'closed',
      closeability: false,
      readiness: 'high',
      proposalPending: false,
      turnId: 2,
      summary: 'Grounding is complete.',
      closureBasis: 'interviewer_recommended',
    });
    expect(workflow.phases.design).toMatchObject({
      status: 'in_progress',
      closeability: true,
      readiness: 'medium',
      proposalPending: true,
      turnId: 3,
      summary: 'Design is ready to close.',
      closureBasis: null,
    });
    expect(workflow.phases.requirements).toMatchObject({
      status: 'unstarted',
      closeability: false,
      readiness: 'low',
      proposalPending: false,
      turnId: null,
      summary: null,
      closureBasis: null,
    });
  });

  it('uses accepted review coverage to determine review-phase closeability', () => {
    const requirementsWorkflow = projectWorkflowState(
      createSnapshot({
        activeOutcomes: [
          {
            phase: 'grounding',
            status: 'confirmed',
            proposalTurnId: 1,
            summary: 'Grounding complete.',
            closureBasis: 'interviewer_recommended',
          },
          {
            phase: 'design',
            status: 'confirmed',
            proposalTurnId: 2,
            summary: 'Elicitation complete.',
            closureBasis: 'interviewer_recommended',
          },
        ],
        reviewCoverage: {
          requirements: true,
          criteria: false,
        },
      }),
    );

    expect(requirementsWorkflow.phases.requirements).toMatchObject({
      status: 'in_progress',
      closeability: true,
      readiness: 'low',
    });
    expect(requirementsWorkflow.phases.criteria).toMatchObject({
      status: 'unstarted',
      closeability: false,
      readiness: 'low',
    });

    const criteriaWorkflow = projectWorkflowState(
      createSnapshot({
        activeOutcomes: [
          {
            phase: 'grounding',
            status: 'confirmed',
            proposalTurnId: 1,
            summary: 'Grounding complete.',
            closureBasis: 'interviewer_recommended',
          },
          {
            phase: 'design',
            status: 'confirmed',
            proposalTurnId: 2,
            summary: 'Elicitation complete.',
            closureBasis: 'interviewer_recommended',
          },
          {
            phase: 'requirements',
            status: 'confirmed',
            proposalTurnId: 3,
            summary: 'Requirements complete.',
            closureBasis: 'interviewer_recommended',
          },
        ],
        reviewCoverage: {
          requirements: true,
          criteria: true,
        },
      }),
    );

    expect(criteriaWorkflow.phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: true,
      readiness: 'low',
    });
  });
});
