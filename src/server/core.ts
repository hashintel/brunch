import { buildInterviewerContext } from './context.js';
import {
  getProject,
  getActivePath,
  getOptionsForTurn,
  createTurn,
  advanceHead,
  listProjects,
  createProject,
  type Turn,
  type DB,
  type Project,
} from './db.js';
import { runInterviewer } from './interview.js';
import { runObserver } from './observer.js';

/** Domain events yielded by conductTurn(). Transport-agnostic. */
export type DomainEvent =
  | { type: 'stream-start'; messageId: string }
  | { type: 'thinking'; delta: string }
  | { type: 'text-delta'; delta: string }
  | { type: 'tool-call-start'; toolName: string; toolCallId: string }
  | { type: 'tool-call-delta'; toolCallId: string; delta: string }
  | { type: 'tool-call-end'; toolCallId: string; toolName: string }
  | { type: 'stream-end' }
  | { type: 'turn-created'; turn: Turn }
  | { type: 'error'; message: string }
  | { type: 'observer-complete'; entityIds: { decisions: number[]; assumptions: number[] } }
  | { type: 'observer-error'; message: string }
  | {
      type: 'agent-metrics';
      agent: string;
      durationMs: number;
      durationApiMs: number;
      totalCostUsd: number;
      inputTokens: number;
      outputTokens: number;
    };

/** Extract user text from a UIMessage (parts[]) or legacy format (content string). */
export function extractPrompt(messages: unknown[]): string {
  const lastMessage = messages?.[messages.length - 1] as Record<string, unknown> | undefined;
  if (!lastMessage) return '';
  if (typeof lastMessage.content === 'string') return lastMessage.content;
  const parts = lastMessage.parts as Array<{ type: string; text: string }> | undefined;
  return (
    parts
      ?.filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('') ?? ''
  );
}

/** Turn with optional options for richer history formatting. */
export interface TurnWithOptions extends Turn {
  options?: Array<{ content: string; is_recommended: boolean; is_selected: boolean }>;
}

/**
 * Format conversation history from active-path turns for multi-turn context.
 * @deprecated Use buildInterviewerContext from context.ts directly.
 */
export function formatHistory(turns: TurnWithOptions[], currentPrompt: string): string {
  return buildInterviewerContext(turns, currentPrompt);
}

/**
 * Conduct a turn: create turn, run interviewer, advance HEAD, run observer.
 * Yields DomainEvents for adapter consumption.
 * conductTurn is a thin sequencer — agent-specific logic lives in each agent module.
 */
export async function* conductTurn(
  db: DB,
  projectId: number,
  userMessage: string,
  phase: Turn['phase'] = 'scope',
): AsyncGenerator<DomainEvent> {
  const project = getProject(db, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const rawActivePath = getActivePath(db, projectId);
  const activePath = rawActivePath.map((t) => ({
    ...t,
    options: getOptionsForTurn(db, t.id),
  }));

  const turn = createTurn(db, projectId, {
    parent_turn_id: project.active_turn_id,
    phase,
    question: '',
    answer: userMessage,
  });

  yield { type: 'turn-created', turn };

  // Interviewer agent — streams DomainEvents and persists turn-level data
  try {
    yield* runInterviewer(db, turn, activePath, userMessage, phase);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    yield { type: 'error', message };
    return; // Don't advance head or run observer on interviewer error
  }

  advanceHead(db, projectId, turn.id);

  // Observer agent — runs silently, persists entities, yields observer-complete
  // Non-fatal: observer failure does not affect the interviewer's persisted turn
  try {
    yield* runObserver(db, turn, projectId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    yield { type: 'observer-error', message };
  }
}

/** Get project state: project + active path turns enriched with options. */
export function getProjectState(db: DB, projectId: number) {
  const project = getProject(db, projectId);
  if (!project) return null;
  const rawTurns = getActivePath(db, projectId);
  const turns = rawTurns.map((t) => ({
    ...t,
    options: getOptionsForTurn(db, t.id),
  }));
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
