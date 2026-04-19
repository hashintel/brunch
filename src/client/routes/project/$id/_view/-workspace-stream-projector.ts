import type { ProjectState, ProjectStateTurn, WorkflowPhase } from '@/shared/api-types.js';
import {
  getAcceptedClosureReplay,
  getPersistedReviewAction,
  getPersistedReviewSet,
  turnHasCompletedAnswer,
  turnIsControlOrClosureArtifact,
} from '@/shared/project-state-turn.js';

import type { InterviewControllerBottomArtifactState } from './-interview-controller.js';

export interface WorkspaceStreamMarker {
  readonly label: string;
  readonly detail?: string | null;
  readonly testId?: string;
}

export type WorkspaceStreamArtifact =
  | {
      readonly kind: 'phase-marker';
      readonly marker: WorkspaceStreamMarker;
    }
  | {
      readonly kind: 'control-marker';
      readonly marker: WorkspaceStreamMarker;
    }
  | {
      readonly kind: 'answered-turn';
      readonly turn: ProjectStateTurn;
      readonly questionCode: string;
    }
  | {
      readonly kind: 'answered-review-turn';
      readonly turn: ProjectStateTurn;
      readonly reviewSet: NonNullable<ReturnType<typeof getPersistedReviewSet>>;
    }
  | {
      readonly kind: 'accepted-closure';
      readonly turn: ProjectStateTurn | undefined;
      readonly acceptedClosure: NonNullable<ReturnType<typeof getAcceptedClosureReplay>>;
    }
  | {
      readonly kind: 'divider';
    }
  | {
      readonly kind: 'persisted-turn';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'persisted-turn' }>;
      readonly questionCode: string;
    }
  | {
      readonly kind: 'pending-question';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'pending-question' }>;
      readonly questionCode: string;
    }
  | {
      readonly kind: 'kickoff';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'kickoff' }>;
    }
  | {
      readonly kind: 'recovery';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'recovery' }>;
    }
  | {
      readonly kind: 'phase-summary';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'phase-summary' }>;
    }
  | {
      readonly kind: 'generating';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'generating' }>;
    }
  | {
      readonly kind: 'phase-handoff';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'phase-handoff' }>;
    }
  | {
      readonly kind: 'workflow-complete';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'workflow-complete' }>;
    };

export interface WorkspaceStreamProjection {
  readonly streamArtifacts: readonly WorkspaceStreamArtifact[];
}

function getRenderedPersistedTurnId(
  bottomArtifact: InterviewControllerBottomArtifactState | null,
): number | null {
  return bottomArtifact?.kind === 'persisted-turn' &&
    (!turnHasCompletedAnswer(bottomArtifact.turn) || bottomArtifact.state === 'submitted')
    ? bottomArtifact.turn.id
    : null;
}

function projectPhaseMarkers({
  phase,
  phaseState,
}: {
  phase: WorkflowPhase;
  phaseState: ProjectState['workflow']['phases'][ProjectStateTurn['phase']];
}): WorkspaceStreamArtifact[] {
  if (phaseState.status !== 'in_progress' || (phase !== 'requirements' && phase !== 'criteria')) {
    return [];
  }

  return [
    {
      kind: 'phase-marker',
      marker: {
        label: `${phase === 'requirements' ? 'Requirements' : 'Acceptance Criteria'} workspace`,
        detail: 'This phase is staged as a structured review, not a freeform chat transcript.',
        testId: 'review-phase-banner',
      },
    },
  ];
}

function projectHistoryArtifacts({
  phaseTurns,
  phaseState,
  renderedPersistedTurnId,
}: {
  phaseTurns: readonly ProjectStateTurn[];
  phaseState: ProjectState['workflow']['phases'][ProjectStateTurn['phase']];
  renderedPersistedTurnId: number | null;
}): WorkspaceStreamArtifact[] {
  const historyArtifacts: WorkspaceStreamArtifact[] = [];
  let answeredTurnCount = 0;

  for (const turn of phaseTurns) {
    if (turn.id === renderedPersistedTurnId) {
      continue;
    }

    const acceptedClosure = getAcceptedClosureReplay(turn, phaseState);
    if (acceptedClosure) {
      historyArtifacts.push({
        kind: 'accepted-closure',
        turn,
        acceptedClosure,
      });
      continue;
    }

    if (!turnHasCompletedAnswer(turn) || turnIsControlOrClosureArtifact(turn)) {
      continue;
    }

    const reviewSet = getPersistedReviewSet(turn);
    if (reviewSet && getPersistedReviewAction(turn)) {
      historyArtifacts.push({
        kind: 'answered-review-turn',
        turn,
        reviewSet,
      });
      continue;
    }

    answeredTurnCount += 1;
    historyArtifacts.push({
      kind: 'answered-turn',
      turn,
      questionCode: `Q${answeredTurnCount}`,
    });
  }

  return historyArtifacts;
}

function projectBottomArtifact(
  bottomArtifact: InterviewControllerBottomArtifactState | null,
  answeredTurnCount: number,
): WorkspaceStreamArtifact | null {
  const questionCode = `Q${answeredTurnCount + 1}`;

  switch (bottomArtifact?.kind) {
    case 'persisted-turn':
      return {
        kind: 'persisted-turn',
        artifact: bottomArtifact,
        questionCode,
      };
    case 'pending-question':
      return {
        kind: 'pending-question',
        artifact: bottomArtifact,
        questionCode,
      };
    case 'kickoff':
      return {
        kind: 'kickoff',
        artifact: bottomArtifact,
      };
    case 'recovery':
      return {
        kind: 'recovery',
        artifact: bottomArtifact,
      };
    case 'phase-summary':
      return {
        kind: 'phase-summary',
        artifact: bottomArtifact,
      };
    case 'generating':
      return {
        kind: 'generating',
        artifact: bottomArtifact,
      };
    case 'phase-handoff':
      return {
        kind: 'phase-handoff',
        artifact: bottomArtifact,
      };
    case 'workflow-complete':
      return {
        kind: 'workflow-complete',
        artifact: bottomArtifact,
      };
    case undefined:
      return null;
  }
}

function projectControlMarkers(markers: readonly WorkspaceStreamMarker[]): WorkspaceStreamArtifact[] {
  return markers.map((marker) => ({
    kind: 'control-marker' as const,
    marker,
  }));
}

function shouldInsertDivider({
  historyArtifacts,
  controlArtifacts,
  bottomArtifact,
}: {
  historyArtifacts: readonly WorkspaceStreamArtifact[];
  controlArtifacts: readonly WorkspaceStreamArtifact[];
  bottomArtifact: WorkspaceStreamArtifact | null;
}): boolean {
  return (
    historyArtifacts.length > 0 &&
    (controlArtifacts.length > 0 ||
      bottomArtifact?.kind === 'persisted-turn' ||
      bottomArtifact?.kind === 'pending-question' ||
      bottomArtifact?.kind === 'phase-summary' ||
      bottomArtifact?.kind === 'generating' ||
      bottomArtifact?.kind === 'phase-handoff' ||
      bottomArtifact?.kind === 'workflow-complete')
  );
}

export function projectWorkspaceStream({
  phase,
  phaseTurns,
  phaseState,
  bottomArtifact,
  controlMarkers = [],
}: {
  phase: WorkflowPhase;
  phaseTurns: readonly ProjectStateTurn[];
  phaseState: ProjectState['workflow']['phases'][ProjectStateTurn['phase']];
  bottomArtifact: InterviewControllerBottomArtifactState | null;
  controlMarkers?: readonly WorkspaceStreamMarker[];
}): WorkspaceStreamProjection {
  const renderedPersistedTurnId = getRenderedPersistedTurnId(bottomArtifact);
  const historyArtifacts = projectHistoryArtifacts({
    phaseTurns,
    phaseState,
    renderedPersistedTurnId,
  });
  const answeredTurnCount = historyArtifacts.filter((artifact) => artifact.kind === 'answered-turn').length;
  const projectedBottomArtifact = projectBottomArtifact(bottomArtifact, answeredTurnCount);
  const controlArtifacts = projectControlMarkers(controlMarkers);
  const phaseMarkers = projectPhaseMarkers({ phase, phaseState });
  const tailArtifacts = projectedBottomArtifact
    ? [...controlArtifacts, projectedBottomArtifact]
    : controlArtifacts;

  return {
    streamArtifacts: shouldInsertDivider({
      historyArtifacts,
      controlArtifacts,
      bottomArtifact: projectedBottomArtifact,
    })
      ? [...phaseMarkers, ...historyArtifacts, { kind: 'divider' as const }, ...tailArtifacts]
      : [...phaseMarkers, ...historyArtifacts, ...tailArtifacts],
  };
}
