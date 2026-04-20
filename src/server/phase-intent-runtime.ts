import type {
  SpecificationLanding,
  SubmitPhaseIntentRequest,
  SubmitPhaseIntentResponse,
  WorkflowPhase,
} from '@/shared/api-types.js';
import type { BrunchUserPart } from '@/shared/chat.js';
import {
  getGroundingStrategyPosition,
  getGroundingStrategyTitle,
  isGroundingStrategyKickoffTurn,
} from '@/shared/grounding-strategy.js';
import { deriveSpecificationLanding } from '@/shared/specification-state.js';
import type { SpecificationTurn } from '@/shared/specification.js';

import { loadActivePathWithOptions } from './core.js';
import {
  applyTurnResponseSelections,
  getCurrentWorkflowState,
  getOptionsForTurn,
  getProject,
  updateProjectMode,
  updateTurn,
  type DB,
  type Turn,
} from './db.js';
import { serializeParts } from './parts.js';

export interface PhaseIntentRuntimeResult {
  readonly ok: true;
}

export interface PhaseIntentRuntimeError {
  readonly ok: false;
  readonly status: 404 | 409;
  readonly error: string;
}

function persistGroundingStrategyKickoffSelection({
  db,
  projectId,
  kickoffTurn,
  mode,
}: {
  db: DB;
  projectId: number;
  kickoffTurn: Pick<Turn, 'id'>;
  mode: 'greenfield' | 'brownfield';
}): PhaseIntentRuntimeResult {
  const selectedPosition = getGroundingStrategyPosition(mode);
  const messageText = getGroundingStrategyTitle(mode);
  if (selectedPosition === null || !messageText) {
    throw new Error('Invalid grounding strategy selection');
  }

  const options = getOptionsForTurn(db, kickoffTurn.id);
  const selectedOption = options.find((option) => option.position === selectedPosition);
  if (!selectedOption) {
    throw new Error('Grounding strategy option not found');
  }

  applyTurnResponseSelections(db, kickoffTurn.id, [selectedPosition]);
  updateProjectMode(db, projectId, mode);
  updateTurn(db, kickoffTurn.id, {
    answer: messageText,
    user_parts: serializeParts([
      { type: 'text', text: messageText },
      {
        type: 'data-turn-response',
        data: {
          turnId: kickoffTurn.id,
          selectedOptionIds: [selectedOption.id],
        },
      },
    ] satisfies BrunchUserPart[]),
  });

  return { ok: true };
}

function findLatestPhaseTurn(
  turns: ReturnType<typeof loadActivePathWithOptions>,
  phase: WorkflowPhase,
): SpecificationTurn | null {
  return [...turns].reverse().find((turn) => turn.phase === phase) ?? null;
}

export function getPhaseIntentRuntimeAvailabilityError(
  request: SubmitPhaseIntentRequest,
  landing: SpecificationLanding | null | undefined,
): PhaseIntentRuntimeError | null {
  if (request.kind === 'phase-entry') {
    return landing?.kind === 'kickoff' && landing.phase === request.phase
      ? null
      : { ok: false, status: 409, error: 'Phase entry is not currently available' };
  }

  return request.phase === landing?.phase &&
    (landing.kind === 'recovery' || (landing.kind === 'kickoff' && landing.mode === 'continue'))
    ? null
    : { ok: false, status: 409, error: 'Phase continue is not currently available' };
}

export function submitPhaseIntentWithRuntimeCompatibility({
  db,
  projectId,
  request,
}: {
  db: DB;
  projectId: number;
  request: SubmitPhaseIntentRequest;
}): SubmitPhaseIntentResponse | PhaseIntentRuntimeError {
  const project = getProject(db, projectId);
  if (!project) {
    return { ok: false, status: 404, error: 'Project not found' };
  }

  const workflow = getCurrentWorkflowState(db, projectId);
  const turns = loadActivePathWithOptions(db, projectId);
  const landing = deriveSpecificationLanding({ workflow, turns });
  const activePhaseTurn = findLatestPhaseTurn(turns, request.phase);

  if (request.kind === 'phase-entry') {
    const availabilityError = getPhaseIntentRuntimeAvailabilityError(request, landing);
    if (availabilityError) {
      return availabilityError;
    }

    const kickoffLanding = landing?.kind === 'kickoff' ? landing : null;

    if (request.phase === 'scope' && kickoffLanding?.mode === 'start' && request.mode) {
      const activeKickoffTurn =
        activePhaseTurn && isGroundingStrategyKickoffTurn(activePhaseTurn) ? activePhaseTurn : null;
      if (activeKickoffTurn) {
        return persistGroundingStrategyKickoffSelection({
          db,
          projectId,
          kickoffTurn: activeKickoffTurn,
          mode: request.mode,
        });
      }

      const messageText = getGroundingStrategyTitle(request.mode);
      if (!messageText) {
        throw new Error('Invalid grounding strategy selection');
      }

      updateProjectMode(db, projectId, request.mode);
      return { ok: true };
    }

    return { ok: true };
  }

  const availabilityError = getPhaseIntentRuntimeAvailabilityError(request, landing);
  if (availabilityError) {
    return availabilityError;
  }

  return { ok: true };
}
