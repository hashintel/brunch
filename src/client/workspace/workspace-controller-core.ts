import type { EntitiesData, ProjectState, ProjectStateTurn } from '../../shared/api-types.js';
import {
  assistantPartsSchema,
  isAskQuestionUIPart,
  type AskQuestionUIPart,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type StructuredQuestion,
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

function findLiveQuestionTurn(
  durableProject: WorkspaceDurableProjectState,
  messages: BrunchUIMessage[],
): ProjectStateTurn | null {
  function getStructuredQuestionInput(part: AskQuestionUIPart): StructuredQuestion | null {
    switch (part.state) {
      case 'input-available':
      case 'approval-requested':
      case 'approval-responded':
      case 'output-available':
      case 'output-denied':
        return part.input;
      case 'output-error':
        return part.input ?? null;
      case 'input-streaming':
        return null;
    }
  }

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = (message.parts?.length ?? 0) - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts?.[partIndex];
      if (!part || !isAskQuestionUIPart(part)) {
        continue;
      }

      const input = getStructuredQuestionInput(part);
      if (!input) {
        continue;
      }

      return {
        id: durableProject.lastTurn?.id ?? 0,
        project_id: durableProject.project.id,
        parent_turn_id: durableProject.lastTurn?.id ?? null,
        phase: durableProject.lastTurn?.phase ?? 'scope',
        question: input.question,
        why: input.why,
        impact: input.impact,
        answer: null,
        is_resolution: false,
        user_parts: null,
        assistant_parts: null,
        created_at: durableProject.lastTurn?.created_at ?? '',
        options: input.options.map((option, position) => ({
          id: -(position + 1),
          position,
          content: option.content,
          is_recommended: option.is_recommended,
          is_selected: false,
        })),
      };
    }

    return null;
  }

  return null;
}

export function createWorkspaceControllerViewState(
  durableProject: WorkspaceDurableProjectState,
  messages: BrunchUIMessage[],
  isLoading: boolean,
): WorkspaceControllerViewState {
  const { project, lastTurn, showTurnCard, lastTurnHasSelection } = durableProject;
  const liveTurn = isLoading ? findLiveQuestionTurn(durableProject, messages) : null;
  const turnCardTurn = liveTurn ?? (showTurnCard && lastTurn && !isLoading ? lastTurn : null);

  return {
    project,
    turnCard: turnCardTurn ? { turn: turnCardTurn } : null,
    promptInput: {
      visible: liveTurn ? false : !showTurnCard || lastTurnHasSelection,
    },
  };
}

export function findTurnOptionByPosition(turn: ProjectStateTurn | undefined, position: number) {
  return turn?.options?.find((option) => option.position === position);
}
