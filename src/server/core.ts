import type { ProjectListItem, ProjectState, ProjectStateTurn } from '@/shared/api-types.js';
import type { BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import { extractTextFromMessage } from '@/shared/chat.js';
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

/** Create a new project with the given name and optional mode. */
export function createNewProject(db: DB, name: string, options?: CreateProjectOptions): Project {
  return createProject(db, name, options);
}
