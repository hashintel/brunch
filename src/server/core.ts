import type { BrunchUIMessage, BrunchUserPart } from '../shared/chat.js';
import { extractTextFromMessage } from '../shared/chat.js';
import {
  getProject,
  getActivePath,
  getOptionsForTurn,
  createTurn,
  advanceHead,
  listProjects,
  createProject,
  type Option,
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
export interface TurnWithOptions extends Turn {
  options?: Array<Pick<Option, 'id' | 'position' | 'content' | 'is_recommended' | 'is_selected'>>;
}

export function loadActivePathWithOptions(db: DB, projectId: number): TurnWithOptions[] {
  const rawActivePath = getActivePath(db, projectId);
  return rawActivePath.map((t) => ({
    ...t,
    options: getOptionsForTurn(db, t.id),
  }));
}

export function prepareTurn(
  db: DB,
  projectId: number,
  userMessage: string,
  userParts: BrunchUserPart[],
  phase: Turn['phase'] = 'scope',
) {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const activePath = loadActivePathWithOptions(db, projectId);
  const turn = createTurn(db, projectId, {
    parent_turn_id: project.active_turn_id,
    phase,
    question: '',
    answer: userMessage,
    user_parts: serializeParts(userParts),
  });
  return { project, turn, activePath };
}

export function finalizeTurn(db: DB, projectId: number, turnId: number): void {
  advanceHead(db, projectId, turnId);
}

/** Get project state: project + active path turns enriched with options. */
export function getProjectState(db: DB, projectId: number) {
  const project = getProject(db, projectId);
  if (!project) return null;
  const turns = loadActivePathWithOptions(db, projectId);
  return { project, turns };
}

/** List all projects. */
export function listProjectStates(db: DB): Project[] {
  return listProjects(db);
}

/** Create a new project with the given name. */
export function createNewProject(db: DB, name: string): Project {
  return createProject(db, name);
}
