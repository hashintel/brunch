import type { BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import { extractTextFromMessage } from '@/shared/chat.js';
import { getCurrentOpenPhase } from '@/shared/phase-descriptors.js';
import { deriveSpecificationLanding } from '@/shared/specification-state.js';
import type {
  Specification,
  SpecificationListItem,
  SpecificationState,
  SpecificationTurn,
} from '@/shared/specification.js';

import {
  advanceHead,
  createSpecification,
  createTurn,
  getActivePath,
  getCapturedItemsForTurns,
  getCurrentPhase,
  getStructuralArtifactTurnIds,
  getCurrentWorkflowState,
  getOptionsForTurn,
  getSpecification,
  countTurnsPerThread,
  getTurnsForThread,
  listThreadsForChat,
  getTurn,
  listSpecifications as listPersistedSpecifications,
  updateTurn,
  type CreateSpecificationOptions,
  type DB,
  type Specification as PersistedSpecification,
  type InterviewTurn,
  type Phase,
  type Turn,
} from './db.js';
import { serializeParts } from './parts.js';

/** Extract display text from a non-interview thread turn's parts JSON. */
function extractThreadTurnText(turn: Turn): string {
  const raw = turn.user_parts ?? turn.assistant_parts;
  if (!raw) return '';
  try {
    const parts = JSON.parse(raw) as Array<{ type: string; text?: string }>;
    return parts
      .filter((p) => p.type === 'text' && typeof p.text === 'string')
      .map((p) => p.text!)
      .join('');
  } catch {
    return raw;
  }
}

/** Extract user text from the last UI message. */
export function extractPrompt(messages: BrunchUIMessage[]): string {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return '';
  return extractTextFromMessage(lastMessage);
}

/** Turn with optional options for richer history formatting. */
export type TurnWithOptions = SpecificationTurn;

type ActivePathTurn = InterviewTurn & {
  options: ReturnType<typeof getOptionsForTurn>;
  captured_items: NonNullable<SpecificationTurn['captured_items']>;
};

function toSpecificationTurn(turn: ActivePathTurn): TurnWithOptions {
  return turn;
}

function toSpecification(specification: PersistedSpecification): Specification {
  return specification;
}

export function loadActivePathWithOptions(db: DB, specificationId: number): TurnWithOptions[] {
  const rawActivePath = getActivePath(db, specificationId);
  const capturedItemsByTurn = getCapturedItemsForTurns(
    db,
    specificationId,
    rawActivePath.map((turn) => turn.id),
  );

  return rawActivePath.map((turn) =>
    toSpecificationTurn({
      ...turn,
      options: getOptionsForTurn(db, turn.id),
      captured_items: capturedItemsByTurn.get(turn.id) ?? [],
    }),
  );
}

export function prepareTurn(
  db: DB,
  specificationId: number,
  userMessage: string,
  userParts: BrunchUserPart[],
  phase?: Phase,
) {
  const specification = getSpecification(db, specificationId);
  if (!specification) throw new Error(`Specification ${specificationId} not found`);
  const activePath = loadActivePathWithOptions(db, specificationId);
  const turn = createTurn(db, specificationId, {
    parent_turn_id: specification.active_turn_id,
    phase: phase ?? getCurrentPhase(db, specificationId),
    question: '',
    answer: userMessage,
    user_parts: serializeParts(userParts),
  });
  return { specification, turn, activePath };
}

export function prepareSuccessorTurn(
  db: DB,
  specificationId: number,
  phase: Phase,
  parentTurnId: number | null,
) {
  const specification = getSpecification(db, specificationId);
  if (!specification) throw new Error(`Specification ${specificationId} not found`);
  const activePath = loadActivePathWithOptions(db, specificationId);
  const turn = createTurn(db, specificationId, {
    parent_turn_id: parentTurnId,
    phase,
    question: '',
    answer: null,
    user_parts: null,
    assistant_parts: null,
  });
  return { specification, turn, activePath };
}

export function resolveTurn(db: DB, turnId: number, userMessage: string, userParts: BrunchUserPart[]): Turn {
  updateTurn(db, turnId, {
    answer: userMessage,
    user_parts: serializeParts(userParts),
  });
  const resolvedTurn = getTurn(db, turnId);
  if (!resolvedTurn) {
    throw new Error(`Turn ${turnId} not found`);
  }
  return resolvedTurn;
}

export function finalizeTurn(db: DB, specificationId: number, turnId: number): void {
  advanceHead(db, specificationId, turnId);
}

export function readSpecificationStateProjection(db: DB, specificationId: number): SpecificationState | null {
  const specification = getSpecification(db, specificationId);
  if (!specification) return null;
  const turns = loadActivePathWithOptions(db, specificationId);
  const workflow = getCurrentWorkflowState(db, specificationId);
  const structuralArtifactTurnIds = getStructuralArtifactTurnIds(db, specificationId);

  let threads: SpecificationState['threads'];
  if (specification.primary_chat_id) {
    const rawThreads = listThreadsForChat(db, specification.primary_chat_id);
    const turnCountMap = countTurnsPerThread(
      db,
      rawThreads.map((t) => t.id),
    );
    threads = rawThreads.map((t) => {
      const turnCount = turnCountMap.get(t.id) ?? 0;
      // Include turns for non-interview threads so the client can render them
      const threadTurns =
        t.kind !== 'interview' && turnCount > 0
          ? getTurnsForThread(db, t.id).map((turn) => ({
              id: turn.id,
              role: turn.user_parts != null ? ('user' as const) : ('assistant' as const),
              text: extractThreadTurnText(turn),
              created_at: turn.created_at,
            }))
          : undefined;
      return {
        id: t.id,
        chat_id: t.chat_id,
        kind: t.kind,
        target_item_id: t.target_item_id,
        invoked_in_turn_id: t.invoked_in_turn_id,
        active_turn_id: t.active_turn_id,
        status: t.status,
        turn_count: turnCount,
        created_at: t.created_at,
        turns: threadTurns,
      };
    });
  }

  return {
    specification: toSpecification(specification),
    workflow,
    landing: deriveSpecificationLanding({ workflow, turns, structuralArtifactTurnIds }),
    turns,
    structuralArtifactTurnIds,
    threads,
  };
}

/** Get specification state: specification + active path turns enriched with options. */
export function getSpecificationState(db: DB, specificationId: number): SpecificationState | null {
  return readSpecificationStateProjection(db, specificationId);
}

/** List all specifications with compact workflow summary. */
export function listSpecifications(db: DB): SpecificationListItem[] {
  return listPersistedSpecifications(db).map((specification) => {
    const workflow = getCurrentWorkflowState(db, specification.id);
    const currentPhase = getCurrentOpenPhase(workflow.phases);
    return {
      ...specification,
      workflowSummary: {
        grounding: workflow.phases.grounding.status,
        design: workflow.phases.design.status,
        requirements: workflow.phases.requirements.status,
        criteria: workflow.phases.criteria.status,
        currentReadiness: currentPhase ? workflow.phases[currentPhase].readiness : null,
      },
    };
  });
}

/** Create a new specification with the given name and optional mode. */
export function createNewSpecification(
  db: DB,
  name: string,
  options?: CreateSpecificationOptions,
): PersistedSpecification {
  return createSpecification(db, name, options);
}
