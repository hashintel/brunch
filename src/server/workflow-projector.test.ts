import { describe, expect, it } from 'vitest';

import { type WorkflowPhase } from '@/shared/phase-close.js';

import { projectWorkflowState, type WorkflowProjectionSnapshot } from './workflow-projector.js';

function createTurnSnapshot(
  phase: WorkflowPhase,
  overrides: Partial<WorkflowProjectionSnapshot['turns'][number]> = {},
): WorkflowProjectionSnapshot['turns'][number] {
  return {
    phase,
    question: '',
    answer: null,
    optionCount: 0,
    ...overrides,
  };
}

function createOutcomeSnapshot(
  phase: WorkflowPhase,
  overrides: Partial<WorkflowProjectionSnapshot['phaseOutcomes'][number]> = {},
): WorkflowProjectionSnapshot['phaseOutcomes'][number] {
  return {
    phase,
    status: 'proposed',
    proposalTurnId: 1,
    summary: null,
    closureBasis: null,
    onActivePath: true,
    ...overrides,
  };
}

function createSnapshot(overrides: Partial<WorkflowProjectionSnapshot> = {}): WorkflowProjectionSnapshot {
  return {
    turns: [],
    phaseOutcomes: [],
    acceptedReviewItemCounts: {
      requirements: 0,
      criteria: 0,
    },
    ...overrides,
  };
}

describe('projectWorkflowState', () => {
  it('projects phase status, readiness, and proposal state from a durable snapshot', () => {
    const workflow = projectWorkflowState(
      createSnapshot({
        turns: [
          createTurnSnapshot('grounding', {
            question: 'Goal?',
            answer: 'Spec tool',
          }),
          createTurnSnapshot('grounding', {
            question: 'Audience?',
            answer: 'Solo builders',
          }),
          createTurnSnapshot('design', {
            question: 'Primary flow?',
            answer: 'Interview-first',
          }),
        ],
        phaseOutcomes: [
          createOutcomeSnapshot('grounding', {
            status: 'confirmed',
            proposalTurnId: 2,
            summary: 'Grounding is complete.',
            closureBasis: 'interviewer_recommended',
          }),
          createOutcomeSnapshot('design', {
            status: 'proposed',
            proposalTurnId: 3,
            summary: 'Design is ready to close.',
          }),
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
        phaseOutcomes: [
          createOutcomeSnapshot('grounding', {
            status: 'confirmed',
            proposalTurnId: 1,
            summary: 'Grounding complete.',
            closureBasis: 'interviewer_recommended',
          }),
          createOutcomeSnapshot('design', {
            status: 'confirmed',
            proposalTurnId: 2,
            summary: 'Elicitation complete.',
            closureBasis: 'interviewer_recommended',
          }),
        ],
        acceptedReviewItemCounts: {
          requirements: 2,
          criteria: 0,
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
        phaseOutcomes: [
          createOutcomeSnapshot('grounding', {
            status: 'confirmed',
            proposalTurnId: 1,
            summary: 'Grounding complete.',
            closureBasis: 'interviewer_recommended',
          }),
          createOutcomeSnapshot('design', {
            status: 'confirmed',
            proposalTurnId: 2,
            summary: 'Elicitation complete.',
            closureBasis: 'interviewer_recommended',
          }),
          createOutcomeSnapshot('requirements', {
            status: 'confirmed',
            proposalTurnId: 3,
            summary: 'Requirements complete.',
            closureBasis: 'interviewer_recommended',
          }),
        ],
        acceptedReviewItemCounts: {
          requirements: 2,
          criteria: 1,
        },
      }),
    );

    expect(criteriaWorkflow.phases.criteria).toMatchObject({
      status: 'in_progress',
      closeability: true,
      readiness: 'low',
    });
  });

  it('ignores superseded and off-path outcomes when deriving proposal state', () => {
    const workflow = projectWorkflowState(
      createSnapshot({
        turns: [
          createTurnSnapshot('grounding', {
            question: 'Goal?',
            answer: 'Spec tool',
          }),
        ],
        phaseOutcomes: [
          createOutcomeSnapshot('grounding', {
            status: 'proposed',
            proposalTurnId: 1,
            summary: 'Off-path proposal',
            onActivePath: false,
          }),
          createOutcomeSnapshot('grounding', {
            status: 'superseded',
            proposalTurnId: 2,
            summary: 'Superseded proposal',
            onActivePath: true,
          }),
        ],
      }),
    );

    expect(workflow.phases.grounding).toMatchObject({
      status: 'in_progress',
      proposalPending: false,
      summary: null,
      turnId: null,
    });
  });
});
