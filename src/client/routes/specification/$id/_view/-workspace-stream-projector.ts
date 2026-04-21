import type { WorkflowPhase } from '@/shared/api-types.js';
import { computeReviewSetChangeSummary, type ReviewSetChangeSummary } from '@/shared/review-diffing.js';
import {
  getAcceptedClosureReplay,
  getPersistedGroundingCard,
  getPersistedReviewAction,
  getPersistedReviewSet,
  turnHasCompletedAnswer,
  turnIsControlOrClosureArtifact,
} from '@/shared/specification-state.js';
import type { SpecificationState, SpecificationTurn } from '@/shared/specification.js';

import type { InterviewControllerBottomArtifactState } from './-interview-controller.js';

export interface WorkspaceStreamMarker {
  readonly label: string;
  readonly detail?: string | null;
  readonly testId?: string;
}

export type WorkspaceStreamArtifact =
  | {
      readonly kind: 'phase-section-header';
      readonly phase: WorkflowPhase;
      readonly purpose: string;
      readonly knowledgeKinds: string;
    }
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
      readonly turn: SpecificationTurn;
      readonly questionCode: string;
    }
  | {
      readonly kind: 'answered-grounding-card';
      readonly turn: SpecificationTurn;
      readonly groundingCard: NonNullable<ReturnType<typeof getPersistedGroundingCard>>;
    }
  | {
      readonly kind: 'answered-grounding-question';
      readonly turn: SpecificationTurn;
      readonly groundingCard: NonNullable<ReturnType<typeof getPersistedGroundingCard>>;
      readonly questionCode: string;
    }
  | {
      readonly kind: 'answered-review-turn';
      readonly turn: SpecificationTurn;
      readonly reviewSet: NonNullable<ReturnType<typeof getPersistedReviewSet>>;
      readonly revisionNumber: number;
    }
  | {
      readonly kind: 'answered-revision-review';
      readonly turn: SpecificationTurn;
      readonly reviewSet: NonNullable<ReturnType<typeof getPersistedReviewSet>>;
      readonly revisionNumber: number;
      readonly changeSummary: ReviewSetChangeSummary;
    }
  | {
      readonly kind: 'collapsed-review-turn';
      readonly turn: SpecificationTurn;
      readonly revisionNumber: number;
      readonly reviewAction: NonNullable<ReturnType<typeof getPersistedReviewAction>>;
    }
  | {
      readonly kind: 'accepted-closure';
      readonly turn: SpecificationTurn | undefined;
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
      readonly kind: 'persisted-grounding-card';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'persisted-turn' }>;
      readonly groundingCard: NonNullable<ReturnType<typeof getPersistedGroundingCard>>;
    }
  | {
      readonly kind: 'persisted-grounding-question';
      readonly artifact: Extract<InterviewControllerBottomArtifactState, { kind: 'persisted-turn' }>;
      readonly groundingCard: NonNullable<ReturnType<typeof getPersistedGroundingCard>>;
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

const phaseSectionHeaderCopy: Record<WorkflowPhase, { purpose: string; knowledgeKinds: string }> = {
  grounding: {
    purpose: 'Establish shared orientation before design begins.',
    knowledgeKinds: 'Goals, terms, context, and constraints.',
  },
  design: {
    purpose: 'Surface commitments and tradeoffs that shape the solution.',
    knowledgeKinds: 'Design decisions and assumptions.',
  },
  requirements: {
    purpose: 'Review a synthesized requirement set for completeness and accuracy.',
    knowledgeKinds: 'Requirement review.',
  },
  criteria: {
    purpose: 'Review verification coverage against accepted requirements.',
    knowledgeKinds: 'Verification coverage review.',
  },
};

function projectPhaseSectionHeader({
  phase,
  phaseState,
}: {
  phase: WorkflowPhase;
  phaseState: SpecificationState['workflow']['phases'][SpecificationTurn['phase']];
}): WorkspaceStreamArtifact[] {
  if (phaseState.status === 'unstarted') {
    return [];
  }

  const copy = phaseSectionHeaderCopy[phase];
  return [
    {
      kind: 'phase-section-header',
      phase,
      purpose: copy.purpose,
      knowledgeKinds: copy.knowledgeKinds,
    },
  ];
}

function projectPhaseMarkers({
  phase,
  phaseState,
}: {
  phase: WorkflowPhase;
  phaseState: SpecificationState['workflow']['phases'][SpecificationTurn['phase']];
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
  phaseTurns: readonly SpecificationTurn[];
  phaseState: SpecificationState['workflow']['phases'][SpecificationTurn['phase']];
  renderedPersistedTurnId: number | null;
}): WorkspaceStreamArtifact[] {
  const historyArtifacts: WorkspaceStreamArtifact[] = [];
  let answeredTurnCount = 0;
  let reviewTurnCount = 0;
  let lastReviewSet: NonNullable<ReturnType<typeof getPersistedReviewSet>> | null = null;

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

    const groundingCard = getPersistedGroundingCard(turn);
    if (groundingCard && turn.question?.trim()) {
      answeredTurnCount += 1;
      historyArtifacts.push({
        kind: 'answered-grounding-question',
        turn,
        groundingCard,
        questionCode: `Q${answeredTurnCount}`,
      });
      continue;
    }
    if (groundingCard) {
      historyArtifacts.push({
        kind: 'answered-grounding-card',
        turn,
        groundingCard,
      });
      continue;
    }

    const reviewSet = getPersistedReviewSet(turn);
    if (reviewSet && getPersistedReviewAction(turn)) {
      reviewTurnCount += 1;

      if (reviewTurnCount > 1 && lastReviewSet) {
        historyArtifacts.push({
          kind: 'answered-revision-review',
          turn,
          reviewSet,
          revisionNumber: reviewTurnCount,
          changeSummary: computeReviewSetChangeSummary(lastReviewSet, reviewSet),
        });
      } else {
        historyArtifacts.push({
          kind: 'answered-review-turn',
          turn,
          reviewSet,
          revisionNumber: reviewTurnCount,
        });
      }

      lastReviewSet = reviewSet;
      continue;
    }

    answeredTurnCount += 1;
    historyArtifacts.push({
      kind: 'answered-turn',
      turn,
      questionCode: `Q${answeredTurnCount}`,
    });
  }

  if (reviewTurnCount <= 1) {
    return historyArtifacts;
  }

  let lastReviewIndex = -1;
  for (let i = historyArtifacts.length - 1; i >= 0; i--) {
    const kind = historyArtifacts[i]!.kind;
    if (kind === 'answered-review-turn' || kind === 'answered-revision-review') {
      lastReviewIndex = i;
      break;
    }
  }

  return historyArtifacts.map((artifact, index) => {
    if (index === lastReviewIndex) {
      return artifact;
    }

    if (artifact.kind === 'answered-review-turn' || artifact.kind === 'answered-revision-review') {
      const reviewAction = getPersistedReviewAction(artifact.turn);
      if (reviewAction) {
        return {
          kind: 'collapsed-review-turn' as const,
          turn: artifact.turn,
          revisionNumber: artifact.revisionNumber,
          reviewAction,
        };
      }
    }

    return artifact;
  });
}

function projectBottomArtifact(
  bottomArtifact: InterviewControllerBottomArtifactState | null,
  answeredTurnCount: number,
): WorkspaceStreamArtifact | null {
  const questionCode = `Q${answeredTurnCount + 1}`;

  switch (bottomArtifact?.kind) {
    case 'persisted-turn': {
      const groundingCard = getPersistedGroundingCard(bottomArtifact.turn);
      if (groundingCard && bottomArtifact.turn.question?.trim()) {
        return {
          kind: 'persisted-grounding-question',
          artifact: bottomArtifact,
          groundingCard,
          questionCode,
        };
      }
      if (groundingCard) {
        return {
          kind: 'persisted-grounding-card',
          artifact: bottomArtifact,
          groundingCard,
        };
      }

      return {
        kind: 'persisted-turn',
        artifact: bottomArtifact,
        questionCode,
      };
    }
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
      bottomArtifact?.kind === 'persisted-grounding-card' ||
      bottomArtifact?.kind === 'persisted-grounding-question' ||
      bottomArtifact?.kind === 'pending-question' ||
      bottomArtifact?.kind === 'phase-summary' ||
      bottomArtifact?.kind === 'generating' ||
      bottomArtifact?.kind === 'phase-handoff' ||
      bottomArtifact?.kind === 'workflow-complete')
  );
}

export function specificationWorkspaceStream({
  phase,
  phaseTurns,
  phaseState,
  bottomArtifact,
  controlMarkers = [],
}: {
  phase: WorkflowPhase;
  phaseTurns: readonly SpecificationTurn[];
  phaseState: SpecificationState['workflow']['phases'][SpecificationTurn['phase']];
  bottomArtifact: InterviewControllerBottomArtifactState | null;
  controlMarkers?: readonly WorkspaceStreamMarker[];
}): WorkspaceStreamProjection {
  const renderedPersistedTurnId = getRenderedPersistedTurnId(bottomArtifact);
  const historyArtifacts = projectHistoryArtifacts({
    phaseTurns,
    phaseState,
    renderedPersistedTurnId,
  });
  const answeredTurnCount = historyArtifacts.filter(
    (artifact) => artifact.kind === 'answered-turn' || artifact.kind === 'answered-grounding-question',
  ).length;
  const projectedBottomArtifact = projectBottomArtifact(bottomArtifact, answeredTurnCount);
  const controlArtifacts = projectControlMarkers(controlMarkers);
  const phaseSectionHeaders = projectPhaseSectionHeader({ phase, phaseState });
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
      ? [
          ...phaseSectionHeaders,
          ...phaseMarkers,
          ...historyArtifacts,
          { kind: 'divider' as const },
          ...tailArtifacts,
        ]
      : [...phaseSectionHeaders, ...phaseMarkers, ...historyArtifacts, ...tailArtifacts],
  };
}
