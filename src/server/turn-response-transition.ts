import type { SubmitTurnResponseRequest, SubmitTurnResponseResponse } from '@/shared/api-types.js';
import { formatTurnResponseText } from '@/shared/chat.js';
import type { BrunchUserPart } from '@/shared/chat.js';
import {
  getGroundingStrategyModeForPosition,
  isGroundingStrategyKickoffTurn,
} from '@/shared/grounding-strategy.js';
import {
  getPersistedReviewAction,
  getReviewActionForSelectedPositions,
} from '@/shared/specification-state.js';

import {
  applyTurnResponseSelections,
  createConfirmedPhaseOutcome,
  getTurn,
  materializeAcceptedCriteriaReviewSet,
  materializeAcceptedRequirementsReviewSet,
  updateSpecificationMode,
  updateTurn,
  type DB,
  type Option,
  type Turn,
} from './db.js';
import { serializeParts } from './parts.js';

export interface SubmitTurnResponseTransitionError {
  readonly ok: false;
  readonly status: 400;
  readonly error: string;
}

function getPersistedFullSetReviewAction(
  turn: Pick<Turn, 'phase' | 'user_parts'>,
): 'accept' | 'request-changes' | null {
  if (turn.phase !== 'requirements' && turn.phase !== 'criteria') {
    return null;
  }

  return getPersistedReviewAction(turn);
}

function acceptRequirementsReview(
  db: DB,
  specificationId: number,
  turnId: number,
): SubmitTurnResponseResponse {
  materializeAcceptedRequirementsReviewSet(db, specificationId, turnId);

  createConfirmedPhaseOutcome(db, {
    projectId: specificationId,
    phase: 'requirements',
    proposal_turn_id: turnId,
    confirmation_turn_id: turnId,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });

  return { ok: true, advancedToPhase: 'criteria' };
}

function acceptCriteriaReview(db: DB, specificationId: number, turnId: number): SubmitTurnResponseResponse {
  materializeAcceptedCriteriaReviewSet(db, specificationId, turnId);

  createConfirmedPhaseOutcome(db, {
    projectId: specificationId,
    phase: 'criteria',
    proposal_turn_id: turnId,
    confirmation_turn_id: turnId,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });

  return { ok: true, workflowCompleted: true };
}

export function submitTurnResponseTransition({
  db,
  specificationId,
  turn,
  turnId,
  request,
  selectedOptions,
  selectedPositions,
}: {
  db: DB;
  specificationId: number;
  turn: Turn;
  turnId: number;
  request: SubmitTurnResponseRequest;
  selectedOptions: Option[];
  selectedPositions: number[];
}): SubmitTurnResponseResponse | SubmitTurnResponseTransitionError {
  const freeText = request.freeText;

  applyTurnResponseSelections(db, turnId, selectedPositions);

  if (isGroundingStrategyKickoffTurn(turn)) {
    const selectedMode =
      selectedPositions.length === 1 ? getGroundingStrategyModeForPosition(selectedPositions[0]!) : null;
    if (selectedMode) {
      updateSpecificationMode(db, specificationId, selectedMode);
    }
  }

  const selectedOptionIds = selectedOptions.map((option) => option.id);
  const selectedOptionContents = selectedOptions.map((option) => option.content);
  const responseText = formatTurnResponseText({
    selectedOptionContents,
    freeText,
  });

  const reviewAction = request.kind === 'select-options' ? request.reviewAction : null;
  const expectedReviewAction =
    request.kind === 'select-options' ? getReviewActionForSelectedPositions(turn, selectedPositions) : null;

  if (expectedReviewAction && reviewAction !== expectedReviewAction) {
    return {
      ok: false,
      status: 400,
      error: 'Review turns must submit the explicit reviewAction for the selected option',
    };
  }

  if (!expectedReviewAction && reviewAction) {
    return {
      ok: false,
      status: 400,
      error: 'reviewAction is only valid for review turns',
    };
  }

  const itemComments = request.kind === 'select-options' ? request.itemComments : undefined;

  const dataPart = {
    type: 'data-turn-response',
    data: {
      turnId,
      selectedOptionIds,
      ...(freeText ? { freeText } : {}),
      ...(expectedReviewAction ? { reviewAction: expectedReviewAction } : {}),
      ...(itemComments?.length ? { itemComments } : {}),
    },
  } as const satisfies Extract<BrunchUserPart, { type: 'data-turn-response' }>;

  updateTurn(db, turnId, {
    answer: responseText,
    user_parts: serializeParts([
      ...(responseText ? ([{ type: 'text', text: responseText }] as const) : []),
      dataPart,
    ] satisfies BrunchUserPart[]),
  });

  const persistedTurn = getTurn(db, turnId) ?? turn;
  const fullSetReviewAction = getPersistedFullSetReviewAction(persistedTurn);
  if (fullSetReviewAction === 'accept') {
    return turn.phase === 'requirements'
      ? acceptRequirementsReview(db, specificationId, turnId)
      : turn.phase === 'criteria'
        ? acceptCriteriaReview(db, specificationId, turnId)
        : { ok: true };
  }

  return { ok: true };
}
