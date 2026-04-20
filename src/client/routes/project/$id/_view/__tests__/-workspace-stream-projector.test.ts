import { describe, expect, it, vi } from 'vitest';

import type {
  SpecificationState as ProjectState,
  SpecificationTurn as ProjectStateTurn,
} from '@/shared/specification.js';

import type { InterviewControllerBottomArtifactState } from '../-interview-controller.js';
import { specificationWorkspaceStream } from '../-workspace-stream-projector.js';

function createPhaseState(
  overrides: Partial<ProjectState['workflow']['phases']['grounding']> = {},
): ProjectState['workflow']['phases']['grounding'] {
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
    phase: 'grounding',
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
        kickoff: { phase: 'grounding', mode: 'start' },
        disabled: false,
        submitKickoff: vi.fn(),
      };
    case 'recovery':
      return {
        kind,
        recovery: { phase: 'grounding' },
        disabled: false,
        submitRecovery: vi.fn(),
      };
    case 'phase-summary':
      return {
        kind,
        phaseSummary: { turnId: 1, phase: 'grounding', summary: 'Ready to close' },
        disabled: false,
        confirmPhaseSummary: vi.fn(),
      };
    case 'generating':
      return { kind };
    case 'phase-handoff':
      return {
        kind,
        phase: 'grounding',
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

describe('specificationWorkspaceStream', () => {
  it('projects answered turns, a divider, and the active persisted turn with the next question code', () => {
    const answeredTurn = createTurn({ id: 1, question: 'Answered question' });
    const persistedTurn = createBottomArtifact('persisted-turn');
    if (persistedTurn.kind !== 'persisted-turn') {
      throw new Error('Expected persisted-turn bottom artifact');
    }

    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [answeredTurn, persistedTurn.turn],
      phaseState: createPhaseState({ turnId: persistedTurn.turn.id }),
      bottomArtifact: persistedTurn,
    });

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

  it('projects grounding cards without consuming question numbering', () => {
    const answeredGroundingTurn = createTurn({
      id: 1,
      question: '',
      assistant_parts: JSON.stringify([
        {
          type: 'data-grounding-card',
          data: {
            summary: 'The repo already uses SQLite-backed local persistence.',
            detail: 'This is provisional context for the next move.',
          },
        },
      ]),
      options: [{ id: 10, position: 0, content: 'Continue', is_recommended: true, is_selected: true }],
    });
    const basePersistedTurn = createBottomArtifact('persisted-turn');
    if (basePersistedTurn.kind !== 'persisted-turn') {
      throw new Error('Expected persisted-turn bottom artifact');
    }
    const persistedTurn = {
      ...basePersistedTurn,
      turn: createTurn({
        id: 2,
        answer: null,
        question: '',
        user_parts: null,
        assistant_parts: JSON.stringify([
          {
            type: 'data-grounding-card',
            data: {
              summary: 'The feature area lives under src/client/routes/project.',
              detail: 'Continue to move into the first substantive question.',
            },
          },
        ]),
        options: [{ id: 11, position: 0, content: 'Continue', is_recommended: true, is_selected: false }],
      }),
    } satisfies Extract<InterviewControllerBottomArtifactState, { kind: 'persisted-turn' }>;

    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [answeredGroundingTurn, persistedTurn.turn],
      phaseState: createPhaseState({ turnId: persistedTurn.turn.id }),
      bottomArtifact: persistedTurn,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'answered-grounding-card',
      'divider',
      'persisted-grounding-card',
    ]);
  });

  it('projects the review-phase banner as a phase marker', () => {
    const projection = specificationWorkspaceStream({
      phase: 'requirements',
      phaseTurns: [],
      phaseState: createPhaseState(),
      bottomArtifact: null,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual(['phase-marker']);
    const phaseMarker = projection.streamArtifacts[0];
    expect(phaseMarker?.kind).toBe('phase-marker');
    if (phaseMarker?.kind !== 'phase-marker') {
      throw new Error('Expected phase-marker artifact');
    }
    expect(phaseMarker.marker.testId).toBe('review-phase-banner');
  });

  it('projects typed control markers ahead of the active bottom artifact', () => {
    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [createTurn({ id: 1 })],
      phaseState: createPhaseState(),
      bottomArtifact: createBottomArtifact('generating'),
      controlMarkers: [{ label: 'Interview resumed' }],
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'answered-turn',
      'divider',
      'control-marker',
      'generating',
    ]);
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

    const projection = specificationWorkspaceStream({
      phase: 'requirements',
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

  it('keeps closed-phase history ordering stable when handoff and completion artifacts join the ordered stream', () => {
    const answeredTurn = createTurn({ id: 1, phase: 'requirements', question: 'Review requirements' });
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

    const handoffProjection = specificationWorkspaceStream({
      phase: 'requirements',
      phaseTurns: [answeredTurn, closureTurn],
      phaseState: createPhaseState({
        status: 'closed',
        closureBasis: 'interviewer_recommended',
        summary: 'Accepted requirements',
      }),
      bottomArtifact: createBottomArtifact('phase-handoff'),
    });
    expect(handoffProjection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'answered-turn',
      'accepted-closure',
      'divider',
      'phase-handoff',
    ]);

    const completionProjection = specificationWorkspaceStream({
      phase: 'requirements',
      phaseTurns: [answeredTurn, closureTurn],
      phaseState: createPhaseState({
        status: 'closed',
        closureBasis: 'interviewer_recommended',
        summary: 'Accepted requirements',
      }),
      bottomArtifact: createBottomArtifact('workflow-complete'),
    });
    expect(completionProjection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'answered-turn',
      'accepted-closure',
      'divider',
      'workflow-complete',
    ]);
  });
});
