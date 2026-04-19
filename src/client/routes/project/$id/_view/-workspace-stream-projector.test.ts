import { describe, expect, it, vi } from 'vitest';

import type { ProjectState, ProjectStateTurn } from '@/shared/api-types.js';

import type { InterviewControllerBottomArtifactState } from './-interview-controller.js';
import { projectWorkspaceStream } from './-workspace-stream-projector.js';

function createPhaseState(
  overrides: Partial<ProjectState['workflow']['phases']['scope']> = {},
): ProjectState['workflow']['phases']['scope'] {
  return {
    status: 'in_progress',
    closeability: false,
    readiness: 'low',
    closureBasis: null,
    proposalPending: false,
    turnId: null,
    summary: null,
    ...overrides,
  };
}

function createTurn(overrides: Partial<ProjectStateTurn> & Pick<ProjectStateTurn, 'id'>): ProjectStateTurn {
  const { id, ...rest } = overrides;

  return {
    id,
    project_id: 1,
    parent_turn_id: null,
    phase: 'scope',
    turn_kind: 'question',
    question: 'Question',
    why: 'Why',
    impact: 'medium',
    answer: 'Answer',
    is_resolution: false,
    user_parts: JSON.stringify([
      {
        type: 'data-turn-response',
        data: { turnId: id, selectedOptionIds: [] },
      },
    ]),
    assistant_parts: JSON.stringify([{ type: 'text', text: 'Question' }]),
    created_at: '2026-04-19 00:00:00',
    options: [],
    ...rest,
  };
}

function createBottomArtifact(
  kind: InterviewControllerBottomArtifactState['kind'],
): InterviewControllerBottomArtifactState {
  switch (kind) {
    case 'persisted-turn':
      return {
        kind,
        turn: createTurn({ id: 2, answer: null, user_parts: null, question: 'Active question' }),
        state: 'active',
        disabled: false,
        errorMessage: null,
        submitTurnResponse: vi.fn(async () => {}),
      };
    case 'pending-question':
      return {
        kind,
        pendingQuestion: {
          id: 'pending-1',
          question: 'Pending question',
          why: 'Because',
          impact: 'high',
          options: [],
        },
        disabled: true,
      };
    case 'kickoff':
      return {
        kind,
        kickoff: { phase: 'scope', mode: 'start' },
        disabled: false,
        submitKickoff: vi.fn(),
      };
    case 'recovery':
      return {
        kind,
        recovery: { phase: 'scope' },
        disabled: false,
        submitRecovery: vi.fn(),
      };
    case 'phase-summary':
      return {
        kind,
        phaseSummary: { turnId: 1, phase: 'scope', summary: 'Ready to close' },
        disabled: false,
        confirmPhaseSummary: vi.fn(),
      };
    case 'generating':
      return { kind };
    case 'phase-handoff':
      return {
        kind,
        phase: 'scope',
        nextPhase: 'design',
        summary: 'Done',
        isReviewPhase: false,
      };
    case 'workflow-complete':
      return {
        kind,
        phase: 'criteria',
        summary: 'All done',
        isReviewPhase: true,
      };
  }
}

describe('projectWorkspaceStream', () => {
  it('projects answered turns, a divider, and the active persisted turn with the next question code', () => {
    const answeredTurn = createTurn({ id: 1, question: 'Answered question' });
    const persistedTurn = createBottomArtifact('persisted-turn');
    if (persistedTurn.kind !== 'persisted-turn') {
      throw new Error('Expected persisted-turn bottom artifact');
    }

    const projection = projectWorkspaceStream({
      phaseTurns: [answeredTurn, persistedTurn.turn],
      phaseState: createPhaseState({ turnId: persistedTurn.turn.id }),
      bottomArtifact: persistedTurn,
    });

    expect(projection.footerArtifact).toBeNull();
    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'answered-turn',
      'divider',
      'persisted-turn',
    ]);

    const answeredArtifact = projection.streamArtifacts[0];
    expect(answeredArtifact.kind).toBe('answered-turn');
    if (answeredArtifact.kind !== 'answered-turn') {
      throw new Error('Expected answered-turn artifact');
    }
    expect(answeredArtifact.questionCode).toBe('Q1');

    const activeArtifact = projection.streamArtifacts[2];
    expect(activeArtifact.kind).toBe('persisted-turn');
    if (activeArtifact.kind !== 'persisted-turn') {
      throw new Error('Expected persisted-turn artifact');
    }
    expect(activeArtifact.questionCode).toBe('Q2');
  });

  it('projects accepted closures and answered review turns from durable phase history', () => {
    const reviewTurn = createTurn({
      id: 1,
      phase: 'requirements',
      question: 'Review requirements',
      assistant_parts: JSON.stringify([
        {
          type: 'data-review-set',
          data: {
            phase: 'requirements',
            title: 'Requirements',
            items: [{ referenceCode: 'R1', content: 'Track auth state' }],
          },
        },
      ]),
      user_parts: JSON.stringify([
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [10], reviewAction: 'accept' },
        },
      ]),
    });
    const closureTurn = createTurn({
      id: 2,
      phase: 'requirements',
      answer: '',
      assistant_parts: JSON.stringify([
        {
          type: 'data-phase-summary',
          data: { turnId: 2, phase: 'requirements', summary: 'Accepted requirements' },
        },
      ]),
      user_parts: JSON.stringify([
        {
          type: 'data-confirmation',
          data: {
            kind: 'confirm-proposed-phase-closure',
            phase: 'requirements',
            proposalTurnId: 2,
          },
        },
      ]),
    });

    const projection = projectWorkspaceStream({
      phaseTurns: [reviewTurn, closureTurn],
      phaseState: createPhaseState({
        status: 'closed',
        closureBasis: 'interviewer_recommended',
        summary: 'Accepted requirements',
      }),
      bottomArtifact: null,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'answered-review-turn',
      'accepted-closure',
    ]);
  });

  it('routes closed-phase handoff and workflow-complete states to the footer artifact', () => {
    const handoffProjection = projectWorkspaceStream({
      phaseTurns: [],
      phaseState: createPhaseState({ status: 'closed', summary: 'Grounding done' }),
      bottomArtifact: createBottomArtifact('phase-handoff'),
    });
    expect(handoffProjection.streamArtifacts).toEqual([]);
    expect(handoffProjection.footerArtifact?.kind).toBe('phase-handoff');

    const completionProjection = projectWorkspaceStream({
      phaseTurns: [],
      phaseState: createPhaseState({ status: 'closed', summary: 'Complete' }),
      bottomArtifact: createBottomArtifact('workflow-complete'),
    });
    expect(completionProjection.streamArtifacts).toEqual([]);
    expect(completionProjection.footerArtifact?.kind).toBe('workflow-complete');
  });
});
