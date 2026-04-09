import type { EntitiesData, ProjectState, ProjectStateTurn } from '../../shared/api-types.js';
import {
  assistantPartsSchema,
  isAskQuestionUIPart,
  type AskQuestionUIPart,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type StructuredQuestion,
  type BrunchUserPart,
  type DataTurnResponse,
  userPartsSchema,
} from '../../shared/chat.js';

export interface WorkspaceDurableProjectState {
  project: ProjectState['project'];
  workflow: ProjectState['workflow'];
  turns: ProjectStateTurn[];
  lastTurn: ProjectStateTurn | undefined;
  showTurnCard: boolean;
  lastTurnHasResponse: boolean;
}

export interface WorkspaceDurableEntityState {
  framing: EntitiesData['framing'];
  constraints: EntitiesData['constraints'];
  requirements: EntitiesData['requirements'];
  criteria: EntitiesData['criteria'];
  decisions: EntitiesData['decisions'];
  assumptions: EntitiesData['assumptions'];
  relationships: EntitiesData['relationships'];
  isLoading: boolean;
}

export interface WorkspaceEphemeralChatState {
  seedMessages: BrunchUIMessage[];
}

export interface PendingQuestionOption {
  position: number;
  content: string;
  is_recommended: boolean;
}

export interface PendingQuestionViewModel {
  id: string;
  question: string;
  why: string;
  impact: StructuredQuestion['impact'];
  options: PendingQuestionOption[];
}

export interface PhaseSummaryViewModel {
  turnId: number;
  phase: ProjectStateTurn['phase'];
  summary: string;
}

export type WorkspaceTurnCardViewModel =
  | { kind: 'persisted-turn'; turn: ProjectStateTurn }
  | { kind: 'pending-question'; pendingQuestion: PendingQuestionViewModel };

export interface WorkspaceControllerViewState {
  project: WorkspaceDurableProjectState['project'];
  workflow: WorkspaceDurableProjectState['workflow'];
  turnCard: WorkspaceTurnCardViewModel | null;
  phaseSummary: PhaseSummaryViewModel | null;
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

export function getPersistedTurnResponse(
  turn: Pick<ProjectStateTurn, 'user_parts'> | undefined,
): DataTurnResponse | null {
  return (
    parseUserParts(turn?.user_parts ?? null).find(
      (part): part is Extract<BrunchUserPart, { type: 'data-turn-response' }> =>
        part.type === 'data-turn-response',
    )?.data ?? null
  );
}

export function hasPersistedTurnResponse(turn: Pick<ProjectStateTurn, 'user_parts'> | undefined): boolean {
  return getPersistedTurnResponse(turn) !== null;
}

export function getPersistedSelectedPositions(
  turn: Pick<ProjectStateTurn, 'user_parts' | 'options'> | undefined,
): number[] {
  const persistedResponse = getPersistedTurnResponse(turn);
  if (!persistedResponse) {
    return [];
  }

  const selectedOptionIds = new Set(persistedResponse.selectedOptionIds);
  return (
    turn?.options?.filter((option) => selectedOptionIds.has(option.id)).map((option) => option.position) ?? []
  );
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
    workflow: projectState.workflow,
    turns: projectState.turns,
    lastTurn,
    showTurnCard: Boolean(lastTurn?.options?.length),
    lastTurnHasResponse: hasPersistedTurnResponse(lastTurn),
  };
}

export function createWorkspaceDurableEntityState(
  entitySnapshot: EntitiesData,
  queryData: EntitiesData | undefined,
  isLoading: boolean,
): WorkspaceDurableEntityState {
  return {
    framing: queryData?.framing ?? entitySnapshot.framing,
    constraints: queryData?.constraints ?? entitySnapshot.constraints,
    requirements: queryData?.requirements ?? entitySnapshot.requirements,
    criteria: queryData?.criteria ?? entitySnapshot.criteria,
    decisions: queryData?.decisions ?? entitySnapshot.decisions,
    assumptions: queryData?.assumptions ?? entitySnapshot.assumptions,
    relationships: queryData?.relationships ?? entitySnapshot.relationships,
    isLoading,
  };
}

export function createWorkspaceEphemeralChatState(projectState: ProjectState): WorkspaceEphemeralChatState {
  return {
    seedMessages: hydrateMessages(projectState.turns),
  };
}

function findPendingQuestion(messages: BrunchUIMessage[]): PendingQuestionViewModel | null {
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
        id: `${message.id}:${part.toolCallId}`,
        question: input.question,
        why: input.why,
        impact: input.impact,
        options: input.options.map((option, position) => ({
          position,
          content: option.content,
          is_recommended: option.is_recommended,
        })),
      };
    }

    return null;
  }

  return null;
}

function findPhaseSummary(messages: BrunchUIMessage[]): PhaseSummaryViewModel | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = (message.parts?.length ?? 0) - 1; partIndex >= 0; partIndex -= 1) {
      const part = message.parts?.[partIndex];
      if (!part || part.type !== 'data-phase-summary') {
        continue;
      }

      return {
        turnId: part.data.turnId,
        phase: part.data.phase,
        summary: part.data.summary,
      };
    }
  }

  return null;
}

export function createWorkspaceControllerViewState(
  durableProject: WorkspaceDurableProjectState,
  messages: BrunchUIMessage[],
  isLoading: boolean,
): WorkspaceControllerViewState {
  const { project, workflow, lastTurn, showTurnCard, lastTurnHasResponse } = durableProject;
  const pendingQuestion = isLoading ? findPendingQuestion(messages) : null;
  const latestPhaseSummary = findPhaseSummary(messages);
  const phaseSummary =
    latestPhaseSummary && (isLoading || workflow.phases[latestPhaseSummary.phase].status === 'proposed')
      ? latestPhaseSummary
      : null;
  const turnCard: WorkspaceTurnCardViewModel | null = phaseSummary
    ? null
    : pendingQuestion
      ? { kind: 'pending-question', pendingQuestion }
      : showTurnCard && lastTurn && !isLoading
        ? { kind: 'persisted-turn', turn: lastTurn }
        : null;

  return {
    project,
    workflow,
    turnCard,
    phaseSummary,
    promptInput: {
      visible: phaseSummary || pendingQuestion ? false : !showTurnCard || lastTurnHasResponse,
    },
  };
}

export function findTurnOptionByPosition(turn: ProjectStateTurn | undefined, position: number) {
  return turn?.options?.find((option) => option.position === position);
}

export function findTurnOptionsByPositions(turn: ProjectStateTurn | undefined, positions: number[]) {
  const uniquePositions = [...new Set(positions)];
  return turn?.options?.filter((option) => uniquePositions.includes(option.position)) ?? [];
}
