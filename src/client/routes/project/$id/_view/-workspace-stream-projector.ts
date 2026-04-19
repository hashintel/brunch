import type { ProjectState, ProjectStateTurn } from '@/shared/api-types.js';
import {
  getAcceptedClosureReplay,
  getPersistedReviewAction,
  getPersistedReviewSet,
  turnHasCompletedAnswer,
  turnIsControlOrClosureArtifact,
} from '@/shared/project-state-turn.js';

import type { InterviewControllerBottomArtifactState } from './-interview-controller.js';

export type WorkspaceStreamArtifact =
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
    };

export interface WorkspaceStreamProjection {
  readonly streamArtifacts: readonly WorkspaceStreamArtifact[];
  readonly footerArtifact: Extract<
    InterviewControllerBottomArtifactState,
    { kind: 'phase-handoff' | 'workflow-complete' }
  > | null;
}

function getRenderedPersistedTurnId(
  bottomArtifact: InterviewControllerBottomArtifactState | null,
): number | null {
  return bottomArtifact?.kind === 'persisted-turn' &&
    (!turnHasCompletedAnswer(bottomArtifact.turn) || bottomArtifact.state === 'submitted')
    ? bottomArtifact.turn.id
    : null;
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

function projectActiveArtifact(
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
    case 'workflow-complete':
    case undefined:
      return null;
  }
}

function shouldInsertDivider(
  historyArtifacts: readonly WorkspaceStreamArtifact[],
  activeArtifact: WorkspaceStreamArtifact | null,
): boolean {
  return (
    historyArtifacts.length > 0 &&
    (activeArtifact?.kind === 'persisted-turn' ||
      activeArtifact?.kind === 'pending-question' ||
      activeArtifact?.kind === 'phase-summary' ||
      activeArtifact?.kind === 'generating')
  );
}

export function projectWorkspaceStream({
  phaseTurns,
  phaseState,
  bottomArtifact,
}: {
  phaseTurns: readonly ProjectStateTurn[];
  phaseState: ProjectState['workflow']['phases'][ProjectStateTurn['phase']];
  bottomArtifact: InterviewControllerBottomArtifactState | null;
}): WorkspaceStreamProjection {
  const renderedPersistedTurnId = getRenderedPersistedTurnId(bottomArtifact);
  const historyArtifacts = projectHistoryArtifacts({
    phaseTurns,
    phaseState,
    renderedPersistedTurnId,
  });
  const answeredTurnCount = historyArtifacts.filter((artifact) => artifact.kind === 'answered-turn').length;
  const activeArtifact = projectActiveArtifact(bottomArtifact, answeredTurnCount);
  const streamArtifacts = shouldInsertDivider(historyArtifacts, activeArtifact)
    ? [...historyArtifacts, { kind: 'divider' as const }, ...(activeArtifact ? [activeArtifact] : [])]
    : [...historyArtifacts, ...(activeArtifact ? [activeArtifact] : [])];

  return {
    streamArtifacts,
    footerArtifact:
      bottomArtifact?.kind === 'phase-handoff' || bottomArtifact?.kind === 'workflow-complete'
        ? bottomArtifact
        : null,
  };
}
