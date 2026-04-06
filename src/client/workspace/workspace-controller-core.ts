import type { EntitiesData, ProjectState, ProjectStateTurn } from '../../shared/api-types.js';
import {
  assistantPartsSchema,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type BrunchUserPart,
  userPartsSchema,
} from '../../shared/chat.js';

export interface WorkspaceDurableProjectState {
  project: ProjectState['project'];
  turns: ProjectStateTurn[];
  lastTurn: ProjectStateTurn | undefined;
  showTurnCard: boolean;
  lastTurnHasSelection: boolean;
}

export interface WorkspaceDurableEntityState {
  decisions: EntitiesData['decisions'];
  assumptions: EntitiesData['assumptions'];
  isLoading: boolean;
}

export interface WorkspaceEphemeralChatState {
  seedMessages: BrunchUIMessage[];
}

export interface WorkspaceControllerViewState {
  project: WorkspaceDurableProjectState['project'];
  turnCard: { turn: ProjectStateTurn } | null;
  promptInput: {
    visible: boolean;
  };
}

function parseAssistantParts(json: string | null): BrunchAssistantPart[] {
  if (!json) return [];
  try {
    return assistantPartsSchema.parse(JSON.parse(json)) as BrunchAssistantPart[];
  } catch {
    return [];
  }
}

function parseUserParts(json: string | null): BrunchUserPart[] {
  if (!json) return [];
  try {
    return userPartsSchema.parse(JSON.parse(json));
  } catch {
    return [];
  }
}

function hydrateMessages(turns: ProjectStateTurn[]): BrunchUIMessage[] {
  const messages: BrunchUIMessage[] = [];

  for (const turn of turns) {
    const hydratedUserParts = parseUserParts(turn.user_parts);
    const userParts =
      hydratedUserParts.length > 0
        ? hydratedUserParts.some((part) => part.type === 'text') || !turn.answer
          ? hydratedUserParts
          : ([{ type: 'text', text: turn.answer }, ...hydratedUserParts] as BrunchUserPart[])
        : turn.answer
          ? ([{ type: 'text', text: turn.answer }] as BrunchUserPart[])
          : [];

    if (userParts.length > 0) {
      messages.push({
        id: `turn-${turn.id}-answer`,
        role: 'user',
        parts: userParts,
      });
    }

    const assistantParts = parseAssistantParts(turn.assistant_parts);
    if (assistantParts.length > 0) {
      messages.push({
        id: `turn-${turn.id}-assistant`,
        role: 'assistant',
        parts: assistantParts,
      });
      continue;
    }

    if (turn.question) {
      messages.push({
        id: `turn-${turn.id}-assistant`,
        role: 'assistant',
        parts: [{ type: 'text', text: turn.question }],
      });
    }
  }

  return messages;
}

export function createWorkspaceDurableProjectState(projectState: ProjectState): WorkspaceDurableProjectState {
  const lastTurn = projectState.turns[projectState.turns.length - 1] as ProjectStateTurn | undefined;

  return {
    project: projectState.project,
    turns: projectState.turns,
    lastTurn,
    showTurnCard: Boolean(lastTurn?.options?.length),
    lastTurnHasSelection: lastTurn?.options?.some((option) => option.is_selected) ?? false,
  };
}

export function createWorkspaceDurableEntityState(
  entitySnapshot: EntitiesData,
  queryData: EntitiesData | undefined,
  isLoading: boolean,
): WorkspaceDurableEntityState {
  return {
    decisions: queryData?.decisions ?? entitySnapshot.decisions,
    assumptions: queryData?.assumptions ?? entitySnapshot.assumptions,
    isLoading,
  };
}

export function createWorkspaceEphemeralChatState(projectState: ProjectState): WorkspaceEphemeralChatState {
  return {
    seedMessages: hydrateMessages(projectState.turns),
  };
}

export function createWorkspaceControllerViewState(
  durableProject: WorkspaceDurableProjectState,
  isLoading: boolean,
): WorkspaceControllerViewState {
  const { project, lastTurn, showTurnCard, lastTurnHasSelection } = durableProject;

  return {
    project,
    turnCard: showTurnCard && lastTurn && !isLoading ? { turn: lastTurn } : null,
    promptInput: {
      visible: !showTurnCard || lastTurnHasSelection,
    },
  };
}

export function findTurnOptionByPosition(turn: ProjectStateTurn | undefined, position: number) {
  return turn?.options?.find((option) => option.position === position);
}
