import type { ProjectState, ProjectStateTurn, ReviewAction, WorkflowPhase } from './api-types.js';
import type { BrunchAssistantPart, BrunchUserPart, DataTurnResponse } from './chat.js';

export function safeParsePersistedAssistantParts(json: string | null | undefined): BrunchAssistantPart[] {
  if (!json) {
    return [];
  }

  try {
    return JSON.parse(json) as BrunchAssistantPart[];
  } catch {
    return [];
  }
}

export function safeParsePersistedUserParts(json: string | null | undefined): BrunchUserPart[] {
  if (!json) {
    return [];
  }

  try {
    return JSON.parse(json) as BrunchUserPart[];
  } catch {
    return [];
  }
}

export function getPersistedTurnResponse(
  turn: Pick<ProjectStateTurn, 'user_parts'> | undefined,
): DataTurnResponse | null {
  return (
    safeParsePersistedUserParts(turn?.user_parts).find(
      (part): part is Extract<BrunchUserPart, { type: 'data-turn-response' }> =>
        part.type === 'data-turn-response',
    )?.data ?? null
  );
}

export function getPersistedReviewAction(
  turn: Pick<ProjectStateTurn, 'user_parts'> | undefined,
): ReviewAction | null {
  return getPersistedTurnResponse(turn)?.reviewAction ?? null;
}

export function hasPersistedTurnResponse(turn: Pick<ProjectStateTurn, 'user_parts'> | undefined): boolean {
  return getPersistedTurnResponse(turn) !== null;
}

export function turnHasCompletedAnswer(
  turn: Pick<ProjectStateTurn, 'answer' | 'user_parts'> | undefined,
): boolean {
  return Boolean(getPersistedTurnResponse(turn) || turn?.answer?.trim());
}

export function getPersistedSelectedPositions(
  turn: Pick<ProjectStateTurn, 'user_parts' | 'options'> | undefined,
): number[] {
  const persistedResponse = getPersistedTurnResponse(turn);
  if (!persistedResponse) {
    return [];
  }

  const selectedOptionIds = new Set(persistedResponse.selectedOptionIds);
  return (
    turn?.options?.filter((option) => selectedOptionIds.has(option.id)).map((option) => option.position) ?? []
  );
}

export function findTurnOptionByPosition(
  turn: ProjectStateTurn | undefined,
  position: number,
): NonNullable<ProjectStateTurn['options']>[number] | undefined {
  return turn?.options?.find((option) => option.position === position);
}

export function findTurnOptionsByPositions(
  turn: ProjectStateTurn | undefined,
  positions: number[],
): NonNullable<ProjectStateTurn['options']> {
  const uniquePositions = [...new Set(positions)];
  return turn?.options?.filter((option) => uniquePositions.includes(option.position)) ?? [];
}

export function getReviewActionForSelectedPositions(
  turn: Pick<ProjectStateTurn, 'phase'> | undefined,
  positions: number[],
): ReviewAction | null {
  if ((turn?.phase !== 'requirements' && turn?.phase !== 'criteria') || positions.length !== 1) {
    return null;
  }

  const [position] = positions;
  if (position === 0) {
    return 'accept';
  }
  if (position === 1) {
    return 'request-changes';
  }

  return null;
}

export function turnIsControlOrClosureArtifact(
  turn: Pick<ProjectStateTurn, 'assistant_parts' | 'is_resolution' | 'turn_kind' | 'user_parts'>,
): boolean {
  if (turn.turn_kind === 'kickoff' || turn.turn_kind === 'recovery' || turn.is_resolution) {
    return true;
  }

  const userParts = safeParsePersistedUserParts(turn.user_parts);
  if (userParts.some((part) => part.type === 'data-confirmation')) {
    return true;
  }

  const assistantParts = safeParsePersistedAssistantParts(turn.assistant_parts);
  return assistantParts.some(
    (part) => part.type === 'tool-propose_phase_closure' || part.type === 'data-phase-summary',
  );
}

export function getPersistedClosureSummary(turn: Pick<ProjectStateTurn, 'assistant_parts'>): string | null {
  const persistedSummary = safeParsePersistedAssistantParts(turn.assistant_parts).find(
    (part): part is Extract<BrunchAssistantPart, { type: 'data-phase-summary' }> =>
      part.type === 'data-phase-summary',
  );

  return persistedSummary?.data.summary ?? null;
}

export function getAcceptedClosureReplay(
  turn: Pick<ProjectStateTurn, 'id' | 'phase' | 'assistant_parts' | 'user_parts'>,
  phaseState: Pick<ProjectState['workflow']['phases'][WorkflowPhase], 'status' | 'closureBasis' | 'summary'>,
): { turnId: number; phase: ProjectStateTurn['phase']; summary: string } | null {
  if (phaseState.status !== 'closed' || phaseState.closureBasis !== 'interviewer_recommended') {
    return null;
  }

  const userConfirmation = safeParsePersistedUserParts(turn.user_parts).find(
    (part): part is Extract<BrunchUserPart, { type: 'data-confirmation' }> =>
      part.type === 'data-confirmation',
  );
  if (
    !userConfirmation ||
    userConfirmation.data.kind !== 'confirm-proposed-phase-closure' ||
    userConfirmation.data.phase !== turn.phase ||
    userConfirmation.data.proposalTurnId !== turn.id
  ) {
    return null;
  }

  const summary = getPersistedClosureSummary(turn) ?? phaseState.summary;
  if (!summary) {
    return null;
  }

  return {
    turnId: turn.id,
    phase: turn.phase,
    summary,
  };
}
