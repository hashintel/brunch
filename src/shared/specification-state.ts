import type { KickoffLandingMode, ReviewAction, SpecificationLanding, WorkflowPhase } from './api-types.js';
import {
  safeDecodePersistedAssistantParts,
  safeDecodePersistedUserParts,
  structuredQuestionSchema,
  type GroundingCardData,
  type ReviewSetData,
  summarizeAssistantActivity,
  type ActivitySummary,
  type BrunchAssistantPart,
  type BrunchUserPart,
  type DataTurnResponse,
} from './chat.js';
import { workflowPhaseOrder } from './phase-close.js';
import type { SpecificationState, SpecificationTurn } from './specification.js';

export function safeParsePersistedAssistantParts(json: string | null | undefined): BrunchAssistantPart[] {
  return safeDecodePersistedAssistantParts(json);
}

export function safeParsePersistedUserParts(json: string | null | undefined): BrunchUserPart[] {
  return safeDecodePersistedUserParts(json);
}

export function getPersistedTurnResponse(
  turn: Pick<SpecificationTurn, 'user_parts'> | undefined,
): DataTurnResponse | null {
  return (
    safeParsePersistedUserParts(turn?.user_parts).find(
      (part): part is Extract<BrunchUserPart, { type: 'data-turn-response' }> =>
        part.type === 'data-turn-response',
    )?.data ?? null
  );
}

export function getPersistedReviewAction(
  turn: Pick<SpecificationTurn, 'user_parts'> | undefined,
): ReviewAction | null {
  return getPersistedTurnResponse(turn)?.reviewAction ?? null;
}

export function getPersistedReviewSet(
  turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined,
): ReviewSetData | null {
  return (
    safeParsePersistedAssistantParts(turn?.assistant_parts).find(
      (part): part is Extract<BrunchAssistantPart, { type: 'data-review-set' }> =>
        part.type === 'data-review-set',
    )?.data ?? null
  );
}

export function getPersistedGroundingCard(
  turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined,
): GroundingCardData | null {
  return (
    safeParsePersistedAssistantParts(turn?.assistant_parts).find(
      (part): part is Extract<BrunchAssistantPart, { type: 'data-grounding-card' }> =>
        part.type === 'data-grounding-card',
    )?.data ?? null
  );
}

export function hasPersistedTurnResponse(turn: Pick<SpecificationTurn, 'user_parts'> | undefined): boolean {
  return getPersistedTurnResponse(turn) !== null;
}

export function turnHasCompletedAnswer(
  turn: Pick<SpecificationTurn, 'answer' | 'user_parts'> | undefined,
): boolean {
  return Boolean(getPersistedTurnResponse(turn) || turn?.answer?.trim());
}

export function getPersistedSelectedPositions(
  turn: Pick<SpecificationTurn, 'user_parts' | 'options'> | undefined,
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
  turn: SpecificationTurn | undefined,
  position: number,
): NonNullable<SpecificationTurn['options']>[number] | undefined {
  return turn?.options?.find((option) => option.position === position);
}

export function findTurnOptionsByPositions(
  turn: SpecificationTurn | undefined,
  positions: number[],
): NonNullable<SpecificationTurn['options']> {
  const uniquePositions = [...new Set(positions)];
  return turn?.options?.filter((option) => uniquePositions.includes(option.position)) ?? [];
}

function getPersistedStructuredQuestion(turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined) {
  const askQuestionPart = safeParsePersistedAssistantParts(turn?.assistant_parts).find(
    (part): part is Extract<BrunchAssistantPart, { type: 'tool-ask_question' }> =>
      part.type === 'tool-ask_question' && 'input' in part,
  );
  if (!askQuestionPart) {
    return null;
  }

  const parsedInput = structuredQuestionSchema.safeParse(askQuestionPart.input);
  return parsedInput.success ? parsedInput.data : null;
}

export function getReviewPositionForAction(
  turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined,
  action: ReviewAction,
): number | null {
  const structuredQuestion = getPersistedStructuredQuestion(turn);
  const explicitReviewAction = structuredQuestion?.reviewActions?.find(
    (reviewAction) => reviewAction.action === action,
  );

  return explicitReviewAction?.optionPosition ?? null;
}

export function getReviewActionForSelectedPositions(
  turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined,
  positions: number[],
): ReviewAction | null {
  if (positions.length !== 1) {
    return null;
  }

  const [position] = [...new Set(positions)];
  const structuredQuestion = getPersistedStructuredQuestion(turn);
  const explicitReviewAction = structuredQuestion?.reviewActions?.find(
    (reviewAction) => reviewAction.optionPosition === position,
  );

  return explicitReviewAction?.action ?? null;
}

export function turnIsControlOrClosureArtifact(
  turn: Pick<SpecificationTurn, 'assistant_parts' | 'is_resolution' | 'turn_kind' | 'user_parts'>,
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

function getKickoffLandingMode(
  turns: readonly Pick<SpecificationTurn, 'phase' | 'turn_kind'>[],
  phase: WorkflowPhase,
): KickoffLandingMode {
  return turns.some((turn) => turn.phase === phase && turn.turn_kind !== 'kickoff') ? 'continue' : 'start';
}

export function deriveSpecificationLanding(
  snapshot: Pick<SpecificationState, 'workflow' | 'turns'>,
): SpecificationLanding | null {
  const phase = workflowPhaseOrder.find(
    (candidatePhase) => snapshot.workflow.phases[candidatePhase].status !== 'closed',
  );
  if (!phase) {
    return null;
  }

  const phaseState = snapshot.workflow.phases[phase];
  if (phaseState.status === 'closed' || phaseState.proposalPending) {
    return null;
  }

  const phaseTurns = snapshot.turns.filter((turn) => turn.phase === phase);
  const frontierTurn = [...phaseTurns]
    .reverse()
    .find((turn) => !turnHasCompletedAnswer(turn) && !turnIsControlOrClosureArtifact(turn));
  if (frontierTurn) {
    return {
      kind: 'frontier-turn',
      phase,
      turnId: frontierTurn.id,
    };
  }

  const hasCompletedSubstantiveHistory = phaseTurns.some(
    (turn) => turnHasCompletedAnswer(turn) && !turnIsControlOrClosureArtifact(turn),
  );
  if (hasCompletedSubstantiveHistory) {
    return {
      kind: 'recovery',
      phase,
    };
  }

  return {
    kind: 'kickoff',
    phase,
    mode: getKickoffLandingMode(phaseTurns, phase),
  };
}

/**
 * Compute the 1-based revision number for a review turn within a phase.
 * Counts how many review turns (turns with a persisted review set and action)
 * precede this turn in the phase, plus one.
 */
export function getReviewRevisionNumber(
  turn: Pick<SpecificationTurn, 'id'>,
  phaseTurns: readonly Pick<SpecificationTurn, 'id' | 'assistant_parts' | 'user_parts'>[],
): number {
  let count = 0;
  for (const phaseTurn of phaseTurns) {
    if (phaseTurn.id === turn.id) {
      return count + 1;
    }

    if (getPersistedReviewSet(phaseTurn) && getPersistedReviewAction(phaseTurn)) {
      count += 1;
    }
  }

  return count + 1;
}

export function getPersistedActivitySummary(
  turn: Pick<SpecificationTurn, 'assistant_parts'> | undefined,
): ActivitySummary | null {
  const assistantParts = safeParsePersistedAssistantParts(turn?.assistant_parts);
  const persistedSummary = assistantParts.find(
    (part): part is Extract<BrunchAssistantPart, { type: 'data-activity-summary' }> =>
      part.type === 'data-activity-summary',
  );

  return persistedSummary?.data ?? summarizeAssistantActivity(assistantParts);
}

export function getPersistedClosureSummary(turn: Pick<SpecificationTurn, 'assistant_parts'>): string | null {
  const persistedSummary = safeParsePersistedAssistantParts(turn.assistant_parts).find(
    (part): part is Extract<BrunchAssistantPart, { type: 'data-phase-summary' }> =>
      part.type === 'data-phase-summary',
  );

  return persistedSummary?.data.summary ?? null;
}

export function getAcceptedClosureReplay(
  turn: Pick<SpecificationTurn, 'id' | 'phase' | 'assistant_parts' | 'user_parts'>,
  phaseState: Pick<
    SpecificationState['workflow']['phases'][WorkflowPhase],
    'status' | 'closureBasis' | 'summary'
  >,
): { turnId: number; phase: SpecificationTurn['phase']; summary: string } | null {
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
