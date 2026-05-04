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
  getTurn,
  listSpecifications as listPersistedSpecifications,
  updateTurn,
  type CreateSpecificationOptions,
  type DB,
  type Option,
  type Specification as PersistedSpecification,
  type Turn,
} from './db.js';
import { serializeParts } from './parts.js';

/** Extract user text from the last UI message. */
export function extractPrompt(messages: BrunchUIMessage[]): string {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return '';
  return extractTextFromMessage(lastMessage);
}

/** Turn with optional options for richer history formatting. */
export type TurnWithOptions = SpecificationTurn;

type ActivePathTurn = Turn & {
  options: Option[];
  captured_items: NonNullable<SpecificationTurn['captured_items']>;
};

function toSpecificationTurn(turn: ActivePathTurn): TurnWithOptions {
  return turn;
}

function toSpecification(specification: PersistedSpecification): Specification {
  return specification;
}

export async function loadActivePathWithOptions(db: DB, specificationId: number): Promise<TurnWithOptions[]> {
  const rawActivePath = await getActivePath(db, specificationId);
  const capturedItemsByTurn = await getCapturedItemsForTurns(
    db,
    specificationId,
    rawActivePath.map((turn) => turn.id),
  );

  return await Promise.all(
    rawActivePath.map(async (turn) =>
      toSpecificationTurn({
        ...turn,
        options: await getOptionsForTurn(db, turn.id),
        captured_items: capturedItemsByTurn.get(turn.id) ?? [],
      }),
    ),
  );
}

export async function prepareTurn(
  db: DB,
  specificationId: number,
  userMessage: string,
  userParts: BrunchUserPart[],
  phase: Turn['phase'] | undefined = undefined,
) {
  const specification = await getSpecification(db, specificationId);
  if (!specification) throw new Error(`Specification ${specificationId} not found`);
  const activePath = await loadActivePathWithOptions(db, specificationId);
  const turn = await createTurn(db, specificationId, {
    parent_turn_id: specification.active_turn_id,
    phase: phase ?? (await getCurrentPhase(db, specificationId)),
    question: '',
    answer: userMessage,
    user_parts: serializeParts(userParts),
  });
  return { specification, turn, activePath };
}

export async function prepareSuccessorTurn(
  db: DB,
  specificationId: number,
  phase: Turn['phase'],
  parentTurnId: number | null,
) {
  const specification = await getSpecification(db, specificationId);
  if (!specification) throw new Error(`Specification ${specificationId} not found`);
  const activePath = await loadActivePathWithOptions(db, specificationId);
  const turn = await createTurn(db, specificationId, {
    parent_turn_id: parentTurnId,
    phase,
    question: '',
    answer: null,
    user_parts: null,
    assistant_parts: null,
  });
  return { specification, turn, activePath };
}

export async function resolveTurn(
  db: DB,
  turnId: number,
  userMessage: string,
  userParts: BrunchUserPart[],
): Promise<Turn> {
  await updateTurn(db, turnId, {
    answer: userMessage,
    user_parts: serializeParts(userParts),
  });
  const resolvedTurn = await getTurn(db, turnId);
  if (!resolvedTurn) {
    throw new Error(`Turn ${turnId} not found`);
  }
  return resolvedTurn;
}

export async function finalizeTurn(db: DB, specificationId: number, turnId: number): Promise<void> {
  await advanceHead(db, specificationId, turnId);
}

export async function readSpecificationStateProjection(
  db: DB,
  specificationId: number,
): Promise<SpecificationState | null> {
  const specification = await getSpecification(db, specificationId);
  if (!specification) return null;
  const turns = await loadActivePathWithOptions(db, specificationId);
  const workflow = await getCurrentWorkflowState(db, specificationId);
  const structuralArtifactTurnIds = await getStructuralArtifactTurnIds(db, specificationId);
  return {
    specification: toSpecification(specification),
    workflow,
    landing: deriveSpecificationLanding({ workflow, turns, structuralArtifactTurnIds }),
    turns,
    structuralArtifactTurnIds,
  };
}

/** Get specification state: specification + active path turns enriched with options. */
export async function getSpecificationState(
  db: DB,
  specificationId: number,
): Promise<SpecificationState | null> {
  return await readSpecificationStateProjection(db, specificationId);
}

/** List all specifications with compact workflow summary. */
export async function listSpecifications(db: DB): Promise<SpecificationListItem[]> {
  const specifications = await listPersistedSpecifications(db);
  return await Promise.all(
    specifications.map(async (specification) => {
      const workflow = await getCurrentWorkflowState(db, specification.id);
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
    }),
  );
}

/** Create a new specification with the given name and optional mode. */
export async function createNewSpecification(
  db: DB,
  name: string,
  options?: CreateSpecificationOptions,
): Promise<PersistedSpecification> {
  return await createSpecification(db, name, options);
}
