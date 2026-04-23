import type { SubmitPhaseIntentRequest } from '@/shared/api-types.js';
import type { BrunchUserPart } from '@/shared/chat.js';
import { getPersistedTurnResponse, getTurnPreface } from '@/shared/specification-state.js';
import { getSpecificationRecord } from '@/shared/specification.js';

import {
  finalizeTurn,
  getSpecificationState,
  prepareSuccessorTurn,
  prepareTurn,
  resolveTurn,
} from './core.js';
import {
  findPhaseOutcomeForTurn,
  getCurrentPhase,
  getSpecification,
  getTurn,
  supersedePhaseOutcome,
  type DB,
  type Phase,
  type PhaseOutcome,
} from './db.js';
import { getPhaseIntentRuntimeAvailabilityError } from './phase-intent-runtime.js';

type PreparedChatTurn = ReturnType<typeof prepareTurn> | ReturnType<typeof prepareSuccessorTurn>;

export type ChatRouteTransitionPlan =
  | {
      readonly ok: true;
      readonly kind: 'confirm-phase-closure';
      readonly confirmationTargetId: number;
      readonly confirmedClosureTurnId: number;
    }
  | {
      readonly ok: true;
      readonly kind: 'force-close';
      readonly prepared: PreparedChatTurn;
    }
  | {
      readonly ok: true;
      readonly kind: 'interviewer-turn';
      readonly prepared: PreparedChatTurn;
      readonly observedTurnId: number | null;
      readonly skipObserverForCurrentChatTurn: boolean;
      readonly deferObserverCaptureToRuntime: boolean;
    };

export interface ChatRouteTransitionError {
  readonly ok: false;
  readonly status: 404 | 409;
  readonly error: string;
}

export function prepareChatRouteTransition({
  db,
  specificationId,
  promptText,
  persistedUserParts,
  confirmationTarget,
  forceClosePhase,
  phaseIntentRequest,
}: {
  db: DB;
  specificationId: number;
  promptText: string;
  persistedUserParts: BrunchUserPart[];
  confirmationTarget?: Pick<PhaseOutcome, 'id' | 'phase' | 'proposal_turn_id'>;
  forceClosePhase?: Phase;
  phaseIntentRequest?: SubmitPhaseIntentRequest;
}): ChatRouteTransitionPlan | ChatRouteTransitionError {
  if (confirmationTarget) {
    const proposalTurn = getTurn(db, confirmationTarget.proposal_turn_id);
    if (!proposalTurn || proposalTurn.specification_id !== specificationId) {
      return { ok: false, status: 404, error: 'Phase closure proposal not found' };
    }

    resolveTurn(db, proposalTurn.id, promptText, persistedUserParts);
    return {
      ok: true,
      kind: 'confirm-phase-closure',
      confirmationTargetId: confirmationTarget.id,
      confirmedClosureTurnId: proposalTurn.id,
    };
  }

  if (forceClosePhase) {
    if (!getSpecification(db, specificationId)) {
      return { ok: false, status: 404, error: 'Project not found' };
    }

    return {
      ok: true,
      kind: 'force-close',
      prepared: prepareTurn(db, specificationId, promptText, persistedUserParts, forceClosePhase),
    };
  }

  if (phaseIntentRequest) {
    const specificationState = getSpecificationState(db, specificationId);
    if (!specificationState) {
      return { ok: false, status: 404, error: 'Project not found' };
    }

    const availabilityError = getPhaseIntentRuntimeAvailabilityError(
      phaseIntentRequest,
      specificationState.landing,
    );
    if (availabilityError) {
      return availabilityError;
    }

    return {
      ok: true,
      kind: 'interviewer-turn',
      prepared: prepareSuccessorTurn(
        db,
        specificationId,
        phaseIntentRequest.phase,
        getSpecificationRecord(specificationState).active_turn_id ?? null,
      ),
      observedTurnId: null,
      skipObserverForCurrentChatTurn: false,
      deferObserverCaptureToRuntime: false,
    };
  }

  const specificationState = getSpecificationState(db, specificationId);
  if (!specificationState) {
    return { ok: false, status: 404, error: 'Project not found' };
  }

  const currentPhase = getCurrentPhase(db, specificationId);
  const activeTurnId = getSpecificationRecord(specificationState).active_turn_id;
  const activeTurn = activeTurnId ? getTurn(db, activeTurnId) : undefined;

  const activeOutcome = activeTurn ? findPhaseOutcomeForTurn(db, specificationId, activeTurn.id) : undefined;
  if (activeOutcome?.status === 'proposed') {
    supersedePhaseOutcome(db, activeOutcome.id);
  }

  if (activeTurn) {
    const skipObserverForCurrentChatTurn =
      Boolean(getTurnPreface(activeTurn)) && !activeTurn.question?.trim();
    const deferObserverCaptureToRuntime =
      getPersistedTurnResponse(activeTurn) !== null &&
      (activeTurn.phase === 'grounding' || activeTurn.phase === 'design');
    const successorPhase = activeTurn.answer === null ? activeTurn.phase : currentPhase;
    if (activeTurn.answer === null) {
      resolveTurn(db, activeTurn.id, promptText, persistedUserParts);
    }
    finalizeTurn(db, specificationId, activeTurn.id);

    return {
      ok: true,
      kind: 'interviewer-turn',
      prepared: prepareSuccessorTurn(db, specificationId, successorPhase, activeTurn.id),
      observedTurnId: activeTurn.id,
      skipObserverForCurrentChatTurn,
      deferObserverCaptureToRuntime,
    };
  }

  const answeredTurn = prepareTurn(db, specificationId, promptText, persistedUserParts, currentPhase);
  finalizeTurn(db, specificationId, answeredTurn.turn.id);

  return {
    ok: true,
    kind: 'interviewer-turn',
    prepared: prepareSuccessorTurn(db, specificationId, currentPhase, answeredTurn.turn.id),
    observedTurnId: answeredTurn.turn.id,
    skipObserverForCurrentChatTurn: false,
    deferObserverCaptureToRuntime: false,
  };
}
