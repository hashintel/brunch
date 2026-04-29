import type { SubmitPhaseIntentRequest, WorkflowPhase } from '@/shared/api-types.js';
import type { BrunchUserPart } from '@/shared/chat.js';
import {
  getForceCloseActionErrorMessage,
  getForceClosePhaseAction,
  getForcedPhaseClosureSummary,
} from '@/shared/phase-close.js';
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
  confirmPhaseOutcome,
  createConfirmedPhaseOutcome,
  findPhaseOutcomeForTurn,
  findProposedPhaseOutcomeByTurn,
  getCurrentPhase,
  getCurrentWorkflowState,
  getSpecification,
  getTurn,
  supersedePhaseOutcome,
  type DB,
} from './db.js';
import { getPhaseIntentRuntimeAvailabilityError } from './phase-intent-runtime.js';

type PreparedChatTurn = ReturnType<typeof prepareTurn> | ReturnType<typeof prepareSuccessorTurn>;

export type ChatRouteTransitionResult =
  | {
      readonly ok: true;
      readonly kind: 'phase-closure-confirmed';
    }
  | {
      readonly ok: true;
      readonly kind: 'phase-force-closed';
    }
  | {
      readonly ok: true;
      readonly kind: 'interviewer-turn';
      readonly prepared: PreparedChatTurn;
      readonly observedTurnId: number | null;
      readonly skipObserverForCurrentChatTurn: boolean;
      readonly deferObserverCaptureToRuntime: boolean;
    };

export type ChatRouteTransitionErrorKind =
  | 'force-close-not-allowed'
  | 'phase-closure-phase-mismatch'
  | 'phase-closure-proposal-not-found'
  | 'phase-intent-not-available'
  | 'specification-not-found';

export interface ChatRouteTransitionError {
  readonly ok: false;
  readonly kind: ChatRouteTransitionErrorKind;
  readonly message: string;
}

type ChatReply = {
  readonly text: string;
  readonly parts: BrunchUserPart[];
};

export type ChatCommand =
  | {
      readonly kind: 'confirm-phase-closure';
      readonly proposalTurnId: number;
      readonly phase: WorkflowPhase;
      readonly reply: ChatReply;
    }
  | {
      readonly kind: 'force-close-phase';
      readonly phase: WorkflowPhase;
      readonly reply: ChatReply;
    }
  | {
      readonly kind: 'phase-entry';
      readonly request: SubmitPhaseIntentRequest;
    }
  | {
      readonly kind: 'continue';
      readonly reply: ChatReply;
    };

export function applyChatRouteTransition(
  {
    db,
    specificationId,
  }: {
    db: DB;
    specificationId: number;
  },
  command: ChatCommand,
): ChatRouteTransitionResult | ChatRouteTransitionError {
  if (command.kind === 'confirm-phase-closure') {
    const confirmationTarget = findProposedPhaseOutcomeByTurn(db, specificationId, command.proposalTurnId);
    if (!confirmationTarget) {
      return {
        ok: false,
        kind: 'phase-closure-proposal-not-found',
        message: 'Phase closure proposal not found',
      };
    }
    if (confirmationTarget.phase !== command.phase) {
      return {
        ok: false,
        kind: 'phase-closure-phase-mismatch',
        message: 'Phase closure confirmation phase mismatch',
      };
    }

    const proposalTurn = getTurn(db, confirmationTarget.proposal_turn_id);
    if (!proposalTurn || proposalTurn.specification_id !== specificationId) {
      return {
        ok: false,
        kind: 'phase-closure-proposal-not-found',
        message: 'Phase closure proposal not found',
      };
    }

    resolveTurn(db, proposalTurn.id, command.reply.text, command.reply.parts);
    confirmPhaseOutcome(db, confirmationTarget.id, proposalTurn.id);
    finalizeTurn(db, specificationId, proposalTurn.id);
    return {
      ok: true,
      kind: 'phase-closure-confirmed',
    };
  }

  if (command.kind === 'force-close-phase') {
    if (!getSpecification(db, specificationId)) {
      return { ok: false, kind: 'specification-not-found', message: 'Specification not found' };
    }

    const forceCloseAction = getForceClosePhaseAction(
      getCurrentWorkflowState(db, specificationId),
      command.phase,
    );
    const forceCloseError = getForceCloseActionErrorMessage(forceCloseAction);
    if (forceCloseError) {
      return {
        ok: false,
        kind: 'force-close-not-allowed',
        message: forceCloseError,
      };
    }

    const prepared = prepareTurn(db, specificationId, command.reply.text, command.reply.parts, command.phase);
    createConfirmedPhaseOutcome(db, {
      specificationId,
      phase: command.phase,
      proposal_turn_id: prepared.turn.id,
      confirmation_turn_id: prepared.turn.id,
      summary: getForcedPhaseClosureSummary(command.phase),
    });
    finalizeTurn(db, specificationId, prepared.turn.id);

    return {
      ok: true,
      kind: 'phase-force-closed',
    };
  }

  if (command.kind === 'phase-entry') {
    const specificationState = getSpecificationState(db, specificationId);
    if (!specificationState) {
      return { ok: false, kind: 'specification-not-found', message: 'Specification not found' };
    }

    const availabilityError = getPhaseIntentRuntimeAvailabilityError(
      command.request,
      specificationState.landing,
    );
    if (availabilityError) {
      return {
        ok: false,
        kind: 'phase-intent-not-available',
        message: availabilityError.error,
      };
    }

    return {
      ok: true,
      kind: 'interviewer-turn',
      prepared: prepareSuccessorTurn(
        db,
        specificationId,
        command.request.phase,
        getSpecificationRecord(specificationState).active_turn_id ?? null,
      ),
      observedTurnId: null,
      skipObserverForCurrentChatTurn: false,
      deferObserverCaptureToRuntime: false,
    };
  }

  if (!getSpecification(db, specificationId)) {
    return { ok: false, kind: 'specification-not-found', message: 'Specification not found' };
  }

  const specificationState = getSpecificationState(db, specificationId);
  if (!specificationState) {
    return { ok: false, kind: 'specification-not-found', message: 'Specification not found' };
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
      resolveTurn(db, activeTurn.id, command.reply.text, command.reply.parts);
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

  const answeredTurn = prepareTurn(
    db,
    specificationId,
    command.reply.text,
    command.reply.parts,
    currentPhase,
  );
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
