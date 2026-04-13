import type { ProjectState, ProjectStateTurn, WorkflowPhase } from '@/shared/api-types.js';
import { isAskQuestionUIPart } from '@/shared/chat.js';
import type {
  AskQuestionUIPart,
  BrunchAssistantPart,
  BrunchUIMessage,
  BrunchUserPart,
  DataTurnResponse,
  StructuredQuestion,
} from '@/shared/chat.js';

export interface InterviewDurableProjectState {
  readonly project: ProjectState['project'];
  readonly workflow: ProjectState['workflow'];
  readonly turns: readonly ProjectStateTurn[];
  readonly lastTurn: ProjectStateTurn | undefined;
  readonly showTurnCard: boolean;
  readonly lastTurnHasResponse: boolean;
}

export interface InterviewEphemeralChatState {
  readonly seedMessages: readonly BrunchUIMessage[];
}

export interface PendingQuestionOption {
  readonly position: number;
  readonly content: string;
  readonly is_recommended: boolean;
}

export interface PendingQuestionViewModel {
  readonly id: string;
  readonly question: string;
  readonly why: string;
  readonly impact: StructuredQuestion['impact'];
  readonly options: readonly PendingQuestionOption[];
}

export interface PhaseSummaryViewModel {
  readonly turnId: number;
  readonly phase: ProjectStateTurn['phase'];
  readonly summary: string;
}

export type InterviewTurnCardViewModel =
  | { readonly kind: 'persisted-turn'; readonly turn: ProjectStateTurn }
  | { readonly kind: 'pending-question'; readonly pendingQuestion: PendingQuestionViewModel };

export interface InterviewControllerViewState {
  readonly project: InterviewDurableProjectState['project'];
  readonly workflow: InterviewDurableProjectState['workflow'];
  readonly turnCard: InterviewTurnCardViewModel | null;
  readonly phaseSummary: PhaseSummaryViewModel | null;
  readonly promptInput: {
    readonly visible: boolean;
  };
}

function parseAssistantParts(json: string | null): BrunchAssistantPart[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as BrunchAssistantPart[];
  } catch {
    return [];
  }
}

function parseUserParts(json: string | null): BrunchUserPart[] {
  if (!json) return [];
  try {
    return JSON.parse(json) as BrunchUserPart[];
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

function hydrateMessages(turns: readonly ProjectStateTurn[]): BrunchUIMessage[] {
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

export function createInterviewDurableProjectState(projectState: ProjectState): InterviewDurableProjectState {
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

/** Build the set of turn IDs belonging to a given phase. */
export function buildPhaseTurnIds(turns: readonly ProjectStateTurn[], phase: WorkflowPhase): Set<number> {
  return new Set(turns.filter((t) => t.phase === phase).map((t) => t.id));
}

/**
 * Filter hydrated messages to only those belonging to the specified phase's turns.
 * Messages whose IDs don't match the `turn-{id}-*` pattern (e.g. streaming messages)
 * are always included — they belong to the active phase.
 */
export function filterMessagesByPhase(
  messages: readonly BrunchUIMessage[],
  phaseTurnIds: ReadonlySet<number>,
): BrunchUIMessage[] {
  return messages.filter((message) => {
    const match = /^turn-(\d+)-/.exec(message.id);
    if (!match) return true;
    return phaseTurnIds.has(Number(match[1]));
  });
}

export function createInterviewEphemeralChatState(projectState: ProjectState): InterviewEphemeralChatState {
  return {
    seedMessages: hydrateMessages(projectState.turns),
  };
}

function findPendingQuestion(messages: readonly BrunchUIMessage[]): PendingQuestionViewModel | null {
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

function findPhaseSummary(messages: readonly BrunchUIMessage[]): PhaseSummaryViewModel | null {
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

export function createInterviewControllerViewState(
  durableProject: InterviewDurableProjectState,
  messages: readonly BrunchUIMessage[],
  isLoading: boolean,
): InterviewControllerViewState {
  const { project, workflow, lastTurn, showTurnCard, lastTurnHasResponse } = durableProject;
  const pendingQuestion = isLoading ? findPendingQuestion(messages) : null;
  const latestPhaseSummary = findPhaseSummary(messages);
  const phaseSummary =
    latestPhaseSummary && (isLoading || workflow.phases[latestPhaseSummary.phase].proposalPending)
      ? latestPhaseSummary
      : null;
  const turnCard: InterviewTurnCardViewModel | null = phaseSummary
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

export function findTurnOptionByPosition(
  turn: ProjectStateTurn | undefined,
  position: number,
): NonNullable<ProjectStateTurn['options']>[number] | undefined {
  return turn?.options?.find((option) => option.position === position);
}

export function findTurnOptionsByPositions(
  turn: ProjectStateTurn | undefined,
  positions: number[],
): NonNullable<ProjectStateTurn['options']> {
  const uniquePositions = [...new Set(positions)];
  return turn?.options?.filter((option) => uniquePositions.includes(option.position)) ?? [];
}
