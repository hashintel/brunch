import { describe, expect, it, vi } from 'vitest';

import type {
  SpecificationState,
  SpecificationTurn as SpecificationStateTurn,
} from '@/shared/specification.js';

import type { InterviewControllerBottomArtifactState } from '../-interview-controller.js';
import { specificationWorkspaceStream } from '../-workspace-stream-projector.js';

function createPhaseState(
  overrides: Partial<SpecificationState['workflow']['phases']['grounding']> = {},
): SpecificationState['workflow']['phases']['grounding'] {
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

function createTurn(
  overrides: Partial<SpecificationStateTurn> & Pick<SpecificationStateTurn, 'id'>,
): SpecificationStateTurn {
  const { id, ...rest } = overrides;

  return {
    id,
    specification_id: 1,
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
        errorMessage: null,
        submitKickoff: vi.fn(),
      };
    case 'recovery':
      return {
        kind,
        recovery: { phase: 'grounding' },
        disabled: false,
        errorMessage: null,
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
      'phase-section-header',
      'answered-turn',
      'divider',
      'persisted-turn',
    ]);

    const answeredArtifact = projection.streamArtifacts[1];
    expect(answeredArtifact.kind).toBe('answered-turn');
    if (answeredArtifact.kind !== 'answered-turn') {
      throw new Error('Expected answered-turn artifact');
    }
    expect(answeredArtifact.questionCode).toBe('Q1');

    const activeArtifact = projection.streamArtifacts[3];
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
              summary: 'The feature area lives under src/client/routes/specification.',
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
      'phase-section-header',
      'answered-grounding-card',
      'divider',
      'persisted-grounding-card',
    ]);
  });

  it('projects a stacked grounding-question artifact for an answered turn with both grounding card and question parts', () => {
    const stackedTurn = createTurn({
      id: 1,
      question: 'What is the primary user persona?',
      assistant_parts: JSON.stringify([
        {
          type: 'data-grounding-card',
          data: {
            summary: 'The repo uses a React frontend with SQLite storage.',
            detail: 'Provisional context from workspace analysis.',
          },
        },
        {
          type: 'tool-ask_question',
          input: {
            question: 'What is the primary user persona?',
            why: 'Understanding users grounds the design.',
            impact: 'high',
            options: [],
          },
        },
      ]),
    });
    const followUpTurn = createTurn({ id: 2, question: 'Follow-up question' });

    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [stackedTurn, followUpTurn],
      phaseState: createPhaseState(),
      bottomArtifact: null,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'phase-section-header',
      'answered-grounding-question',
      'answered-turn',
    ]);

    const stackedArtifact = projection.streamArtifacts[1];
    if (stackedArtifact.kind !== 'answered-grounding-question') {
      throw new Error('Expected answered-grounding-question artifact');
    }
    expect(stackedArtifact.groundingCard).toBeTruthy();
    expect(stackedArtifact.questionCode).toBe('Q1');

    const followUpArtifact = projection.streamArtifacts[2];
    if (followUpArtifact.kind !== 'answered-turn') {
      throw new Error('Expected answered-turn artifact');
    }
    expect(followUpArtifact.questionCode).toBe('Q2');
  });

  it('projects a stacked grounding-question bottom artifact for an active turn with both parts', () => {
    const basePersistedTurn = createBottomArtifact('persisted-turn');
    if (basePersistedTurn.kind !== 'persisted-turn') {
      throw new Error('Expected persisted-turn bottom artifact');
    }
    const persistedTurn = {
      ...basePersistedTurn,
      turn: createTurn({
        id: 2,
        answer: null,
        question: 'What is the primary goal?',
        user_parts: null,
        assistant_parts: JSON.stringify([
          {
            type: 'data-grounding-card',
            data: {
              summary: 'Found package.json with React and Vite.',
              detail: 'Provisional workspace context.',
            },
          },
          {
            type: 'tool-ask_question',
            input: {
              question: 'What is the primary goal?',
              why: 'Goals ground everything.',
              impact: 'high',
              options: [],
            },
          },
        ]),
      }),
    } satisfies Extract<InterviewControllerBottomArtifactState, { kind: 'persisted-turn' }>;

    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [persistedTurn.turn],
      phaseState: createPhaseState({ turnId: persistedTurn.turn.id }),
      bottomArtifact: persistedTurn,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'phase-section-header',
      'persisted-grounding-question',
    ]);

    const stackedArtifact = projection.streamArtifacts[1];
    if (stackedArtifact.kind !== 'persisted-grounding-question') {
      throw new Error('Expected persisted-grounding-question artifact');
    }
    expect(stackedArtifact.groundingCard).toBeTruthy();
    expect(stackedArtifact.questionCode).toBe('Q1');
  });

  it('still projects standalone grounding card for turns with only a grounding card and no question', () => {
    const groundingOnlyTurn = createTurn({
      id: 1,
      question: '',
      assistant_parts: JSON.stringify([
        {
          type: 'data-grounding-card',
          data: {
            summary: 'Standalone grounding context.',
            detail: 'No paired question.',
          },
        },
      ]),
      options: [{ id: 10, position: 0, content: 'Continue', is_recommended: true, is_selected: true }],
    });

    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [groundingOnlyTurn],
      phaseState: createPhaseState(),
      bottomArtifact: null,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'phase-section-header',
      'answered-grounding-card',
    ]);
  });

  it('projects a phase-section-header for each realized phase with phase-specific copy', () => {
    const phases = ['grounding', 'design', 'requirements', 'criteria'] as const;
    const expectedPurpose: Record<string, string> = {
      grounding: 'Establish shared orientation before design begins.',
      design: 'Surface commitments and tradeoffs that shape the solution.',
      requirements: 'Review a synthesized requirement set for completeness and accuracy.',
      criteria: 'Review verification coverage against accepted requirements.',
    };
    const expectedKnowledgeKinds: Record<string, string> = {
      grounding: 'Goals, terms, context, and constraints.',
      design: 'Design decisions and assumptions.',
      requirements: 'Requirement review.',
      criteria: 'Verification coverage review.',
    };

    for (const phase of phases) {
      const projection = specificationWorkspaceStream({
        phase,
        phaseTurns: [],
        phaseState: createPhaseState({ status: 'in_progress' }),
        bottomArtifact: null,
      });

      const header = projection.streamArtifacts.find((a) => a.kind === 'phase-section-header');
      expect(header).toBeDefined();
      if (header?.kind !== 'phase-section-header') {
        throw new Error('Expected phase-section-header artifact');
      }
      expect(header.phase).toBe(phase);
      expect(header.purpose).toBe(expectedPurpose[phase]);
      expect(header.knowledgeKinds).toBe(expectedKnowledgeKinds[phase]);
    }
  });

  it('projects a phase-section-header for closed phases', () => {
    const projection = specificationWorkspaceStream({
      phase: 'grounding',
      phaseTurns: [],
      phaseState: createPhaseState({ status: 'closed', closureBasis: 'interviewer_recommended' }),
      bottomArtifact: null,
    });

    const header = projection.streamArtifacts.find((a) => a.kind === 'phase-section-header');
    expect(header).toBeDefined();
    expect(header?.kind).toBe('phase-section-header');
  });

  it('does not project a phase-section-header for unstarted phases', () => {
    const projection = specificationWorkspaceStream({
      phase: 'design',
      phaseTurns: [],
      phaseState: createPhaseState({ status: 'unstarted' }),
      bottomArtifact: null,
    });

    const header = projection.streamArtifacts.find((a) => a.kind === 'phase-section-header');
    expect(header).toBeUndefined();
  });

  it('places phase-section-header before phase markers and history artifacts', () => {
    const answeredTurn = createTurn({ id: 1, phase: 'requirements', question: 'Review requirements' });
    const projection = specificationWorkspaceStream({
      phase: 'requirements',
      phaseTurns: [answeredTurn],
      phaseState: createPhaseState({ status: 'in_progress' }),
      bottomArtifact: null,
    });

    const kinds = projection.streamArtifacts.map((a) => a.kind);
    expect(kinds[0]).toBe('phase-section-header');
    expect(kinds[1]).toBe('phase-marker');
    expect(kinds[2]).toBe('answered-turn');
  });

  it('projects the review-phase banner as a phase marker', () => {
    const projection = specificationWorkspaceStream({
      phase: 'requirements',
      phaseTurns: [],
      phaseState: createPhaseState(),
      bottomArtifact: null,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'phase-section-header',
      'phase-marker',
    ]);
    const phaseMarker = projection.streamArtifacts[1];
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
      'phase-section-header',
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
            items: [{ reviewItemId: 'requirements:1', referenceCode: 'R1', content: 'Track auth state' }],
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
      'phase-section-header',
      'answered-review-turn',
      'accepted-closure',
    ]);
  });

  it('keeps revision diffing keyed to review item identity instead of item order', () => {
    const firstReviewTurn = createTurn({
      id: 1,
      phase: 'requirements',
      question: 'Review requirements',
      assistant_parts: JSON.stringify([
        {
          type: 'data-review-set',
          data: {
            phase: 'requirements',
            title: 'Requirements',
            items: [
              {
                reviewItemId: 'requirements:1',
                referenceCode: 'R1',
                content: 'Resume the interview from SQLite after restart',
              },
              {
                reviewItemId: 'requirements:2',
                referenceCode: 'R2',
                content: 'Export the reviewed specification as markdown',
              },
            ],
          },
        },
      ]),
      user_parts: JSON.stringify([
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [10], reviewAction: 'request-changes' },
        },
      ]),
    });
    const revisedReviewTurn = createTurn({
      id: 2,
      phase: 'requirements',
      parent_turn_id: 1,
      question: 'Review revised requirements',
      assistant_parts: JSON.stringify([
        {
          type: 'data-review-set',
          data: {
            phase: 'requirements',
            title: 'Requirements',
            items: [
              {
                reviewItemId: 'requirements:2',
                referenceCode: 'R2',
                content: 'Export the reviewed specification as markdown',
              },
              {
                reviewItemId: 'requirements:1',
                referenceCode: 'R1',
                content: 'Resume the active path from SQLite after restart',
              },
              {
                reviewItemId: 'requirements:3',
                referenceCode: 'R3',
                content: 'Record every status change in an audit trail',
              },
            ],
          },
        },
      ]),
      user_parts: JSON.stringify([
        {
          type: 'data-turn-response',
          data: { turnId: 2, selectedOptionIds: [11], reviewAction: 'accept' },
        },
      ]),
    });

    const projection = specificationWorkspaceStream({
      phase: 'requirements',
      phaseTurns: [firstReviewTurn, revisedReviewTurn],
      phaseState: createPhaseState({
        status: 'in_progress',
        turnId: revisedReviewTurn.id,
      }),
      bottomArtifact: null,
    });

    expect(projection.streamArtifacts.map((artifact) => artifact.kind)).toEqual([
      'phase-section-header',
      'phase-marker',
      'collapsed-review-turn',
      'answered-revision-review',
    ]);

    const revisedArtifact = projection.streamArtifacts[3];
    expect(revisedArtifact.kind).toBe('answered-revision-review');
    if (revisedArtifact.kind !== 'answered-revision-review') {
      throw new Error('Expected answered-revision-review artifact');
    }
    expect(revisedArtifact.changeSummary).toEqual({ added: 1, removed: 0, revised: 1 });
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
      'phase-section-header',
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
      'phase-section-header',
      'answered-turn',
      'accepted-closure',
      'divider',
      'workflow-complete',
    ]);
  });
});
