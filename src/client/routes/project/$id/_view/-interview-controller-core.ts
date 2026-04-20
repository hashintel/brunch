import type { SpecificationLanding, WorkflowPhase } from '@/shared/api-types.js';
import { isAskQuestionUIPart } from '@/shared/chat.js';
import type {
  AskQuestionUIPart,
  BrunchUIMessage,
  BrunchUserPart,
  StructuredQuestion,
} from '@/shared/chat.js';
import { getNextActivePhase } from '@/shared/phase-descriptors.js';
import {
  hasPersistedTurnResponse,
  safeParsePersistedAssistantParts,
  safeParsePersistedUserParts,
  turnHasCompletedAnswer,
} from '@/shared/project-state-turn.js';
import type { SpecificationState, SpecificationTurn } from '@/shared/specification.js';

export interface InterviewDurableProjectState {
  readonly project: SpecificationState['project'];
  readonly workflow: SpecificationState['workflow'];
  readonly turns: readonly SpecificationTurn[];
  readonly landing: SpecificationLanding | null;
  readonly lastTurn: SpecificationTurn | undefined;
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

export type KickoffMode = 'start' | 'continue';

export interface KickoffControlViewModel {
  readonly phase: WorkflowPhase;
  readonly mode: KickoffMode;
}

export interface RecoveryControlViewModel {
  readonly phase: WorkflowPhase;
}

export interface PhaseSummaryViewModel {
  readonly turnId: number;
  readonly phase: SpecificationTurn['phase'];
  readonly summary: string;
}

export type InterviewActiveArtifactViewModel =
  | {
      readonly kind: 'persisted-turn';
      readonly turn: SpecificationTurn;
      readonly state: 'active' | 'submitted';
    }
  | { readonly kind: 'pending-question'; readonly pendingQuestion: PendingQuestionViewModel }
  | { readonly kind: 'kickoff'; readonly kickoff: KickoffControlViewModel }
  | { readonly kind: 'recovery'; readonly recovery: RecoveryControlViewModel };

export type InterviewBottomArtifactViewModel =
  | InterviewActiveArtifactViewModel
  | {
      readonly kind: 'phase-summary';
      readonly phaseSummary: PhaseSummaryViewModel;
    }
  | {
      readonly kind: 'generating';
    }
  | {
      readonly kind: 'phase-handoff';
      readonly phase: WorkflowPhase;
      readonly nextPhase: WorkflowPhase;
      readonly summary: string | null;
      readonly isReviewPhase: boolean;
    }
  | {
      readonly kind: 'workflow-complete';
      readonly phase: WorkflowPhase;
      readonly summary: string | null;
      readonly isReviewPhase: boolean;
    };

export interface InterviewControllerViewState {
  readonly project: InterviewDurableProjectState['project'];
  readonly workflow: InterviewDurableProjectState['workflow'];
  readonly bottomArtifact: InterviewBottomArtifactViewModel | null;
}

function hydrateMessages(turns: readonly SpecificationTurn[]): BrunchUIMessage[] {
  const messages: BrunchUIMessage[] = [];

  for (const turn of turns) {
    const hydratedUserParts = safeParsePersistedUserParts(turn.user_parts);
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

    const assistantParts = safeParsePersistedAssistantParts(turn.assistant_parts);
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

export function createInterviewDurableProjectState(
  specificationState: SpecificationState,
): InterviewDurableProjectState {
  const lastTurn = specificationState.turns[specificationState.turns.length - 1] as
    | SpecificationTurn
    | undefined;

  return {
    project: specificationState.project,
    workflow: specificationState.workflow,
    turns: specificationState.turns,
    landing: specificationState.landing ?? null,
    lastTurn,
    showTurnCard: Boolean(lastTurn?.options?.length),
    lastTurnHasResponse: hasPersistedTurnResponse(lastTurn),
  };
}

/** Build the set of turn IDs belonging to a given phase. */
export function buildPhaseTurnIds(turns: readonly SpecificationTurn[], phase: WorkflowPhase): Set<number> {
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

export function createInterviewEphemeralChatState(
  specificationState: SpecificationState,
): InterviewEphemeralChatState {
  return {
    seedMessages: hydrateMessages(specificationState.turns),
  };
}

export function reconcileStablePhaseTurns(
  stableTurns: readonly SpecificationTurn[],
  durableTurns: readonly SpecificationTurn[],
): SpecificationTurn[] {
  const stableTurnsById = new Map(stableTurns.map((turn) => [turn.id, turn]));

  return durableTurns.map((durableTurn) => {
    const stableTurn = stableTurnsById.get(durableTurn.id);
    if (!stableTurn) {
      return durableTurn;
    }

    if (turnHasCompletedAnswer(stableTurn)) {
      const stableCapturedCount = stableTurn.captured_items?.length ?? 0;
      const durableCapturedCount = durableTurn.captured_items?.length ?? 0;
      return durableCapturedCount > stableCapturedCount ? durableTurn : stableTurn;
    }

    return turnHasCompletedAnswer(durableTurn) ? durableTurn : stableTurn;
  });
}

function findPhaseTurn(
  durableProject: InterviewDurableProjectState,
  phase: WorkflowPhase,
): SpecificationTurn | null {
  const phaseState = durableProject.workflow.phases[phase];
  if (phaseState.status === 'closed') {
    return null;
  }

  if (phaseState.turnId !== null) {
    const currentPhaseTurn = durableProject.turns.find(
      (turn) => turn.id === phaseState.turnId && turn.phase === phase,
    );
    if (currentPhaseTurn) {
      return currentPhaseTurn;
    }
  }

  for (let index = durableProject.turns.length - 1; index >= 0; index -= 1) {
    const turn = durableProject.turns[index];
    if (turn?.phase === phase) {
      return turn;
    }
  }

  return null;
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
  phase: WorkflowPhase,
  messages: readonly BrunchUIMessage[],
  isLoading: boolean,
  submittedTurnId: number | null = null,
  isAutoSubmittingPhaseIntent = false,
): InterviewControllerViewState {
  const { project, workflow } = durableProject;
  const phaseState = workflow.phases[phase];
  const nextPhase = getNextActivePhase(workflow.phases, phase);
  const isReviewPhase = phase === 'requirements' || phase === 'criteria';

  if (phaseState.status === 'closed') {
    const bottomArtifact: InterviewBottomArtifactViewModel | null = nextPhase
      ? {
          kind: 'phase-handoff',
          phase,
          nextPhase,
          summary: phaseState.summary,
          isReviewPhase,
        }
      : {
          kind: 'workflow-complete',
          phase,
          summary: phaseState.summary,
          isReviewPhase,
        };

    return {
      project,
      workflow,
      bottomArtifact,
    };
  }

  const landing = durableProject.landing?.phase === phase ? durableProject.landing : null;
  const phaseTurn =
    landing?.kind === 'frontier-turn'
      ? (durableProject.turns.find((turn) => turn.id === landing.turnId) ?? null)
      : findPhaseTurn(durableProject, phase);
  const showTurnCard = landing?.kind === 'frontier-turn' && Boolean(phaseTurn?.options?.length);
  const isSubmittedTurn = phaseTurn?.id === submittedTurnId;
  const showSubmittedTurnCard = isSubmittedTurn && Boolean(phaseTurn?.options?.length);
  const pendingQuestion = isLoading || submittedTurnId !== null ? findPendingQuestion(messages) : null;
  const latestPhaseSummary = findPhaseSummary(messages);
  const phaseSummary =
    latestPhaseSummary &&
    (isLoading || submittedTurnId !== null || workflow.phases[latestPhaseSummary.phase].proposalPending)
      ? latestPhaseSummary
      : null;
  const showPersistedTurn =
    (landing?.kind === 'frontier-turn' ? showTurnCard : showSubmittedTurnCard) &&
    phaseTurn !== null &&
    (!isLoading || isSubmittedTurn) &&
    (!turnHasCompletedAnswer(phaseTurn) || isSubmittedTurn);
  const showRecovery =
    !isLoading &&
    !isAutoSubmittingPhaseIntent &&
    !phaseSummary &&
    !pendingQuestion &&
    !showPersistedTurn &&
    landing?.kind === 'recovery';
  const showKickoff =
    !isLoading &&
    !isAutoSubmittingPhaseIntent &&
    !phaseSummary &&
    !pendingQuestion &&
    !showPersistedTurn &&
    landing?.kind === 'kickoff';
  const bottomArtifact: InterviewBottomArtifactViewModel | null = phaseSummary
    ? { kind: 'phase-summary', phaseSummary }
    : pendingQuestion
      ? { kind: 'pending-question', pendingQuestion }
      : showPersistedTurn && phaseTurn
        ? {
            kind: 'persisted-turn',
            turn: phaseTurn,
            state: isSubmittedTurn ? 'submitted' : 'active',
          }
        : showRecovery
          ? {
              kind: 'recovery',
              recovery: {
                phase,
              },
            }
          : showKickoff
            ? {
                kind: 'kickoff',
                kickoff: {
                  phase,
                  mode: landing.mode,
                },
              }
            : isLoading || isAutoSubmittingPhaseIntent
              ? { kind: 'generating' }
              : null;

  return {
    project,
    workflow,
    bottomArtifact,
  };
}
