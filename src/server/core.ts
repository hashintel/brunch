import type { ProjectListItem, ProjectState, ProjectStateTurn, TurnKind } from '@/shared/api-types.js';
import type { BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import { extractTextFromMessage } from '@/shared/chat.js';
import {
  groundingStrategyChoices,
  groundingStrategyKickoffDescription,
  groundingStrategyKickoffQuestion,
} from '@/shared/grounding-strategy.js';
import type { WorkflowPhase } from '@/shared/phase-close.js';
import { phaseOrder } from '@/shared/phase-routes.js';
import { deriveSpecificationLanding } from '@/shared/project-state-turn.js';

import {
  getProject,
  getActivePath,
  getOptionsForTurn,
  getCurrentPhase,
  getCurrentWorkflowState,
  createTurn,
  advanceHead,
  createOption,
  getCapturedItemsForTurns,
  listProjects,
  createProject,
  getTurn,
  updateTurn,
  type CreateProjectOptions,
  type Turn,
  type DB,
  type Project,
} from './db.js';
import { serializeParts } from './parts.js';

/** Extract user text from the last UI message. */
export function extractPrompt(messages: BrunchUIMessage[]): string {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return '';
  return extractTextFromMessage(lastMessage);
}

/** Turn with optional options for richer history formatting. */
export type TurnWithOptions = ProjectStateTurn;

export function loadActivePathWithOptions(db: DB, projectId: number): TurnWithOptions[] {
  const rawActivePath = getActivePath(db, projectId);
  const capturedItemsByTurn = getCapturedItemsForTurns(
    db,
    projectId,
    rawActivePath.map((turn) => turn.id),
  );

  return rawActivePath.map((t) => ({
    ...t,
    options: getOptionsForTurn(db, t.id),
    captured_items: capturedItemsByTurn.get(t.id) ?? [],
  }));
}

export function prepareTurn(
  db: DB,
  projectId: number,
  userMessage: string,
  userParts: BrunchUserPart[],
  phase: Turn['phase'] | undefined = undefined,
) {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const activePath = loadActivePathWithOptions(db, projectId);
  const turn = createTurn(db, projectId, {
    parent_turn_id: project.active_turn_id,
    phase: phase ?? getCurrentPhase(db, projectId),
    question: '',
    answer: userMessage,
    user_parts: serializeParts(userParts),
  });
  return { project, turn, activePath };
}

function createFrontierOfferTurn(
  db: DB,
  projectId: number,
  parentTurnId: number | null,
  phase: WorkflowPhase,
): Turn {
  const phaseTurns = getActivePath(db, projectId).filter((turn) => turn.phase === phase);
  const hasSubstantiveHistory = phaseTurns.some(
    (turn) =>
      turn.turn_kind !== 'kickoff' &&
      (turn.question.trim().length > 0 || getOptionsForTurn(db, turn.id).length > 0),
  );
  const turnKind: TurnKind = hasSubstantiveHistory ? 'recovery' : 'kickoff';

  const turn = createTurn(db, projectId, {
    parent_turn_id: parentTurnId,
    phase,
    turn_kind: turnKind,
    question: '',
    answer: null,
    user_parts: null,
    assistant_parts: null,
    why: null,
  });

  if (turnKind === 'kickoff' && phase === 'scope' && !hasSubstantiveHistory) {
    updateTurn(db, turn.id, {
      question: groundingStrategyKickoffQuestion,
      why: groundingStrategyKickoffDescription,
    });
    for (const choice of groundingStrategyChoices) {
      createOption(db, turn.id, {
        position: choice.position,
        content: choice.title,
        is_recommended: choice.isRecommended,
      });
    }
  }

  return turn;
}

export function ensureProjectFrontier(db: DB, projectId: number): Turn | null {
  const project = getProject(db, projectId);
  if (!project) {
    return null;
  }

  const workflow = getCurrentWorkflowState(db, projectId);
  const activePhase = getCurrentPhase(db, projectId);
  const phaseState = workflow.phases[activePhase];
  if (phaseState.status === 'closed' || phaseState.proposalPending) {
    return null;
  }

  const activeTurn = project.active_turn_id ? getTurn(db, project.active_turn_id) : undefined;
  if (activeTurn?.phase === activePhase && activeTurn.answer === null) {
    return activeTurn;
  }

  const frontierTurn = createFrontierOfferTurn(db, projectId, project.active_turn_id ?? null, activePhase);
  advanceHead(db, projectId, frontierTurn.id);
  return frontierTurn;
}

export function prepareSuccessorTurn(
  db: DB,
  projectId: number,
  phase: Turn['phase'],
  parentTurnId: number | null,
) {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const activePath = loadActivePathWithOptions(db, projectId);
  const turn = createTurn(db, projectId, {
    parent_turn_id: parentTurnId,
    phase,
    question: '',
    answer: null,
    user_parts: null,
    assistant_parts: null,
  });
  return { project, turn, activePath };
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

export function finalizeTurn(db: DB, projectId: number, turnId: number): void {
  advanceHead(db, projectId, turnId);
}

export function readProjectStateProjection(db: DB, projectId: number): ProjectState | null {
  const project = getProject(db, projectId);
  if (!project) return null;
  const turns = loadActivePathWithOptions(db, projectId);
  const workflow = getCurrentWorkflowState(db, projectId);
  return {
    project,
    workflow,
    landing: deriveSpecificationLanding({ workflow, turns }),
    turns,
  };
}

/** Get project state: project + active path turns enriched with options. */
export function getProjectState(db: DB, projectId: number): ProjectState | null {
  const project = getProject(db, projectId);
  if (!project) return null;
  ensureProjectFrontier(db, projectId);
  return readProjectStateProjection(db, projectId);
}

/** List all projects with compact workflow summary. */
export function listProjectStates(db: DB): ProjectListItem[] {
  return listProjects(db).map((project) => {
    const workflow = getCurrentWorkflowState(db, project.id);
    const currentPhase = phaseOrder.find((p) => workflow.phases[p].status !== 'closed');
    return {
      ...project,
      workflowSummary: {
        scope: workflow.phases.scope.status,
        design: workflow.phases.design.status,
        requirements: workflow.phases.requirements.status,
        criteria: workflow.phases.criteria.status,
        currentReadiness: currentPhase ? workflow.phases[currentPhase].readiness : null,
      },
    };
  });
}

/** Create a new project with the given name and optional mode/cwd. */
export function createNewProject(db: DB, name: string, options?: CreateProjectOptions): Project {
  const project = createProject(db, name, options);
  ensureProjectFrontier(db, project.id);
  return getProject(db, project.id)!;
}
