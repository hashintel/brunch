import type { ChatStatus } from 'ai';

import type { ReviewAction, SpecificationLanding, WorkflowPhase } from '@/shared/api-types.js';
import { getActivityToolLabel, isAskQuestionUIPart, summarizeAssistantActivity } from '@/shared/chat.js';
import type {
  ActivitySummary,
  AskQuestionUIPart,
  BrunchUIMessage,
  BrunchUIMessagePart,
  BrunchUserPart,
  PrefaceData,
  ReviewSetData,
  StructuredQuestion,
} from '@/shared/chat.js';
import { getNextActivePhase } from '@/shared/phase-descriptors.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import {
  getTurnPreface,
  hasPersistedTurnResponse,
  safeParsePersistedAssistantParts,
  safeParsePersistedUserParts,
  turnHasCompletedAnswer,
} from '@/shared/specification-state.js';
import {
  getSpecificationRecord,
  type SpecificationMode,
  type SpecificationState,
  type SpecificationTurn,
} from '@/shared/specification.js';

export interface InterviewDurableSpecificationState {
  readonly specification: ReturnType<typeof getSpecificationRecord>;
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
  readonly toolCallId: string;
  readonly acknowledgedTurnId?: number;
  readonly question: string;
  readonly why: string;
  readonly impact: StructuredQuestion['impact'];
  readonly options: readonly PendingQuestionOption[];
  readonly reviewActions?: StructuredQuestion['reviewActions'];
  readonly reviewSet?: ReviewSetData;
  readonly preface?: PrefaceData;
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
      readonly pendingPreface?: PrefaceData;
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
  readonly specification: InterviewDurableSpecificationState['specification'];
  readonly workflow: InterviewDurableSpecificationState['workflow'];
  readonly bottomArtifact: InterviewBottomArtifactViewModel | null;
}

export type InterviewControllerBottomArtifactState =
  | {
      readonly kind: 'persisted-turn';
      readonly turn: SpecificationTurn;
      readonly state: 'active' | 'submitted';
      readonly disabled: boolean;
      readonly errorMessage: string | null;
      readonly liveActivity?: ActivitySummary;
      readonly submitTurnResponse: (
        positions: number[],
        freeText?: string,
        reviewAction?: ReviewAction,
        itemComments?: Array<{ reviewItemId: string; comment: string }>,
      ) => Promise<void>;
    }
  | {
      readonly kind: 'pending-question';
      readonly pendingQuestion: PendingQuestionViewModel;
      readonly disabled: true;
      readonly liveActivity?: ActivitySummary;
    }
  | {
      readonly kind: 'kickoff';
      readonly kickoff: KickoffControlViewModel;
      readonly disabled: boolean;
      readonly errorMessage: string | null;
      readonly submitKickoff: (mode?: SpecificationMode) => void;
    }
  | {
      readonly kind: 'recovery';
      readonly recovery: RecoveryControlViewModel;
      readonly disabled: boolean;
      readonly errorMessage: string | null;
      readonly submitRecovery: () => void;
    }
  | {
      readonly kind: 'phase-summary';
      readonly phaseSummary: PhaseSummaryViewModel;
      readonly disabled: boolean;
      readonly confirmPhaseSummary: () => void;
    }
  | {
      readonly kind: 'generating';
      readonly liveActivity?: ActivitySummary;
      readonly liveReasoningText?: string;
      readonly pendingPreface?: PrefaceData;
      readonly liveToolItems?: Array<{
        readonly detail?: string;
        readonly key: string;
        readonly label: string;
      }>;
      readonly liveToolsRunning: boolean;
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

export function createInterviewDurableSpecificationState(
  specificationState: SpecificationState,
): InterviewDurableSpecificationState {
  const lastTurn = specificationState.turns[specificationState.turns.length - 1] as
    | SpecificationTurn
    | undefined;

  return {
    specification: getSpecificationRecord(specificationState),
    workflow: specificationState.workflow,
    turns: specificationState.turns,
    landing: specificationState.landing ?? null,
    lastTurn,
    showTurnCard: turnHasRenderableCard(lastTurn),
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
  durableSpecification: InterviewDurableSpecificationState,
  phase: WorkflowPhase,
): SpecificationTurn | null {
  const phaseState = durableSpecification.workflow.phases[phase];
  if (phaseState.status === 'closed') {
    return null;
  }

  if (phaseState.turnId !== null) {
    const currentPhaseTurn = durableSpecification.turns.find(
      (turn) => turn.id === phaseState.turnId && turn.phase === phase,
    );
    if (currentPhaseTurn) {
      return currentPhaseTurn;
    }
  }

  for (let index = durableSpecification.turns.length - 1; index >= 0; index -= 1) {
    const turn = durableSpecification.turns[index];
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
      const acknowledgedTurnId =
        part.state === 'output-available' && part.output?.ok && typeof part.output.turnId === 'number'
          ? part.output.turnId
          : null;

      return {
        id: acknowledgedTurnId ? `persisted-turn-${acknowledgedTurnId}` : `${message.id}:${part.toolCallId}`,
        toolCallId: part.toolCallId,
        ...(acknowledgedTurnId ? { acknowledgedTurnId } : {}),
        question: input.question,
        why: input.why,
        impact: input.impact,
        options: input.options.map((option, position) => ({
          position,
          content: option.content,
          is_recommended: option.is_recommended,
        })),
        ...(input.reviewActions ? { reviewActions: input.reviewActions } : {}),
        ...(input.reviewSet ? { reviewSet: input.reviewSet } : {}),
      };
    }

    return null;
  }

  return null;
}

type PresentPrefaceUIPart = Extract<BrunchUIMessagePart, { type: 'tool-present_preface' }>;

function isPresentPrefaceUIPart(part: BrunchUIMessagePart): part is PresentPrefaceUIPart {
  return part.type === 'tool-present_preface';
}

function findPendingPreface(messages: readonly BrunchUIMessage[]): PrefaceData | null {
  function getPrefaceInput(part: PresentPrefaceUIPart): PrefaceData | null {
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
      if (!part || !isPresentPrefaceUIPart(part)) {
        continue;
      }

      return getPrefaceInput(part);
    }

    return null;
  }

  return null;
}

function turnHasRenderableCard(
  turn: Pick<SpecificationTurn, 'question' | 'options' | 'assistant_parts'> | null | undefined,
): boolean {
  return Boolean(turn?.question?.trim() || turn?.options?.length || (turn && getTurnPreface(turn)));
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
  durableSpecification: InterviewDurableSpecificationState,
  phase: WorkflowPhase,
  messages: readonly BrunchUIMessage[],
  isLoading: boolean,
  submittedTurnId: number | null = null,
  isAutoSubmittingPhaseIntent = false,
): InterviewControllerViewState {
  const { specification, workflow } = durableSpecification;
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
      specification,
      workflow,
      bottomArtifact,
    };
  }

  const landing = durableSpecification.landing?.phase === phase ? durableSpecification.landing : null;
  const phaseTurn =
    landing?.kind === 'frontier-turn'
      ? (durableSpecification.turns.find((turn) => turn.id === landing.turnId) ?? null)
      : findPhaseTurn(durableSpecification, phase);
  const showTurnCard = landing?.kind === 'frontier-turn' && turnHasRenderableCard(phaseTurn);
  const isSubmittedTurn = phaseTurn?.id === submittedTurnId;
  const showSubmittedTurnCard = isSubmittedTurn && turnHasRenderableCard(phaseTurn);
  const pendingPreface = isLoading || submittedTurnId !== null ? findPendingPreface(messages) : null;
  const pendingQuestionBase = isLoading || submittedTurnId !== null ? findPendingQuestion(messages) : null;
  const pendingQuestion =
    pendingQuestionBase && pendingPreface
      ? { ...pendingQuestionBase, preface: pendingPreface }
      : pendingQuestionBase;
  const pendingQuestionAcknowledgesPhaseTurn =
    pendingQuestion?.acknowledgedTurnId !== undefined && pendingQuestion.acknowledgedTurnId === phaseTurn?.id;
  const latestPhaseSummary = findPhaseSummary(messages);
  const phaseSummary =
    latestPhaseSummary &&
    (isLoading || submittedTurnId !== null || workflow.phases[latestPhaseSummary.phase].proposalPending)
      ? latestPhaseSummary
      : null;
  const showPersistedTurn =
    (landing?.kind === 'frontier-turn' ? showTurnCard : showSubmittedTurnCard) &&
    phaseTurn !== null &&
    (!isLoading || isSubmittedTurn || pendingQuestionAcknowledgesPhaseTurn) &&
    (!turnHasCompletedAnswer(phaseTurn) || isSubmittedTurn);
  const showRecovery =
    !isLoading &&
    !isAutoSubmittingPhaseIntent &&
    !phaseSummary &&
    (!pendingQuestion || pendingQuestionAcknowledgesPhaseTurn) &&
    !showPersistedTurn &&
    landing?.kind === 'recovery';
  const showKickoff =
    !isLoading &&
    !isAutoSubmittingPhaseIntent &&
    !phaseSummary &&
    (!pendingQuestion || pendingQuestionAcknowledgesPhaseTurn) &&
    !showPersistedTurn &&
    landing?.kind === 'kickoff';
  const bottomArtifact: InterviewBottomArtifactViewModel | null = phaseSummary
    ? { kind: 'phase-summary', phaseSummary }
    : pendingQuestion && !pendingQuestionAcknowledgesPhaseTurn
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
              ? { kind: 'generating', ...(pendingPreface ? { pendingPreface } : {}) }
              : null;

  return {
    specification,
    workflow,
    bottomArtifact,
  };
}

// ---------------------------------------------------------------------------
// Shared pure helpers (used by both interview and continuous-workspace controllers)
// ---------------------------------------------------------------------------

const MAX_TOOL_DETAIL_LENGTH = 80;
const HYDRATED_TURN_MESSAGE_ID_PATTERN = /^turn-\d+-/;

function isLiveAssistantMessage(message: BrunchUIMessage): boolean {
  return message.role === 'assistant' && !HYDRATED_TURN_MESSAGE_ID_PATTERN.test(message.id);
}

function getLatestLiveAssistantMessage(
  messages: readonly BrunchUIMessage[],
  status: ChatStatus,
): BrunchUIMessage | undefined {
  if (status !== 'submitted' && status !== 'streaming') {
    return undefined;
  }

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message && isLiveAssistantMessage(message)) {
      return message;
    }
  }

  return undefined;
}

function truncateToolDetail(value: string): string {
  const sanitized = value.replace(/[\n\r]+/g, ' ').trim();
  return sanitized.length > MAX_TOOL_DETAIL_LENGTH
    ? `${sanitized.slice(0, MAX_TOOL_DETAIL_LENGTH - 1)}…`
    : sanitized;
}

function getToolInputString(input: Record<string, unknown>, key: string): string | null {
  const value = input[key];
  return typeof value === 'string' && value.trim() ? truncateToolDetail(value) : null;
}

function extractToolDetail(input: unknown): string | null {
  if (input === null || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const command = getToolInputString(record, 'command');
  if (command) {
    return command;
  }

  const path = getToolInputString(record, 'path') ?? getToolInputString(record, 'workdir');
  const pattern = getToolInputString(record, 'pattern');
  if (pattern && path) {
    return truncateToolDetail(`${pattern} in ${path}`);
  }
  if (path) {
    return path;
  }

  for (const key of ['glob', 'query', 'url', 'requestFilePath', 'responseFilePath'] as const) {
    const value = getToolInputString(record, key);
    if (value) {
      return value;
    }
  }

  return null;
}

function getLiveToolParts(messages: readonly BrunchUIMessage[], status: ChatStatus) {
  return getLatestLiveAssistantMessage(messages, status)?.parts ?? [];
}

export function getLiveToolItems(messages: readonly BrunchUIMessage[], status: ChatStatus) {
  const toolItems = new Map<
    string,
    {
      detail?: string;
      key: string;
      label: string;
    }
  >();

  for (const part of getLiveToolParts(messages, status)) {
    const label = part ? getActivityToolLabel(part) : null;
    if (!part || !label || !('input' in part) || !('state' in part) || !('toolCallId' in part)) {
      continue;
    }

    const existing = toolItems.get(part.toolCallId);
    const detail = extractToolDetail(part.input) ?? existing?.detail;

    toolItems.set(part.toolCallId, {
      ...(detail ? { detail } : {}),
      key: part.toolCallId,
      label,
    });
  }

  return toolItems.size > 0 ? [...toolItems.values()] : undefined;
}

export function hasRunningLiveTool(messages: readonly BrunchUIMessage[], status: ChatStatus): boolean {
  return getLiveToolParts(messages, status).some(
    (part) => part && 'state' in part && part.state !== 'output-available',
  );
}

export function getLatestAssistantActivity(
  messages: readonly BrunchUIMessage[],
  status: ChatStatus,
): ActivitySummary | undefined {
  const liveAssistantMessage = getLatestLiveAssistantMessage(messages, status);
  if (!liveAssistantMessage?.parts) {
    return undefined;
  }

  return summarizeAssistantActivity(liveAssistantMessage.parts) ?? undefined;
}

export function getLatestReasoningText(
  messages: readonly BrunchUIMessage[],
  status: ChatStatus,
): string | undefined {
  const liveAssistantMessage = getLatestLiveAssistantMessage(messages, status);
  if (!liveAssistantMessage?.parts) {
    return undefined;
  }

  const chunks: string[] = [];
  for (const part of liveAssistantMessage.parts) {
    if (part.type === 'reasoning') {
      chunks.push(part.text);
    }
  }

  return chunks.length > 0 ? chunks.join('') : undefined;
}

export function sameTurnReferences(
  left: readonly SpecificationTurn[],
  right: readonly SpecificationTurn[],
): boolean {
  return left.length === right.length && left.every((turn, index) => turn === right[index]);
}

// ---------------------------------------------------------------------------
// Shared bottom-artifact enrichment
// ---------------------------------------------------------------------------

export interface BottomArtifactEnrichmentDeps {
  readonly submitTurnResponseErrorMessage: string | null;
  readonly submitTrackedTurnResponse: (
    turn: Pick<SpecificationTurn, 'id' | 'phase'>,
    submit: () => Promise<boolean>,
  ) => Promise<boolean>;
  readonly submitTurnResponse: (
    positions?: number[],
    freeText?: string,
    reviewAction?: ReviewAction,
    itemComments?: Array<{ reviewItemId: string; comment: string }>,
  ) => Promise<boolean>;
  readonly liveActivity: ActivitySummary | undefined;
  readonly isLoading: boolean;
  readonly controlErrorMessage: string | null;
  readonly submitTypedPhaseIntent: (intent: PhaseIntentRequest) => void;
  readonly confirmPhaseClosure: (phase: SpecificationTurn['phase'], turnId: number) => void;
  readonly liveReasoningText: string | undefined;
  readonly liveToolItems: Array<{ detail?: string; key: string; label: string }> | undefined;
  readonly liveToolsRunning: boolean;
}

export function enrichBottomArtifact(
  bottomArtifact: InterviewBottomArtifactViewModel | null,
  deps: BottomArtifactEnrichmentDeps,
): InterviewControllerBottomArtifactState | null {
  if (!bottomArtifact) {
    return null;
  }

  if (bottomArtifact.kind === 'persisted-turn') {
    return {
      kind: 'persisted-turn',
      turn: bottomArtifact.turn,
      state: bottomArtifact.state,
      disabled: bottomArtifact.state === 'submitted',
      errorMessage: deps.submitTurnResponseErrorMessage,
      liveActivity: deps.liveActivity,
      submitTurnResponse: async (
        positions: number[],
        freeText?: string,
        reviewAction?: ReviewAction,
        itemComments?: Array<{ reviewItemId: string; comment: string }>,
      ) => {
        const activeTurn = bottomArtifact.kind === 'persisted-turn' ? bottomArtifact.turn : null;
        if (activeTurn === null) {
          return;
        }

        await deps.submitTrackedTurnResponse(activeTurn, () =>
          deps.submitTurnResponse(positions, freeText, reviewAction, itemComments),
        );
      },
    };
  }

  if (bottomArtifact.kind === 'pending-question') {
    return {
      kind: 'pending-question',
      pendingQuestion: bottomArtifact.pendingQuestion,
      disabled: true,
      liveActivity: deps.liveActivity,
    };
  }

  if (bottomArtifact.kind === 'kickoff') {
    const kickoff = bottomArtifact.kickoff;
    return {
      kind: 'kickoff',
      kickoff,
      disabled: deps.isLoading,
      errorMessage: deps.controlErrorMessage,
      submitKickoff: (selectedMode?: SpecificationMode) => {
        if (deps.isLoading) {
          return;
        }

        if (kickoff.phase === 'grounding' && kickoff.mode === 'start' && selectedMode) {
          deps.submitTypedPhaseIntent({
            kind: 'phase-entry',
            phase: kickoff.phase,
            mode: selectedMode,
          });
          return;
        }

        deps.submitTypedPhaseIntent(
          kickoff.mode === 'start'
            ? {
                kind: 'phase-entry',
                phase: kickoff.phase,
              }
            : {
                kind: 'phase-continue',
                phase: kickoff.phase,
              },
        );
      },
    };
  }

  if (bottomArtifact.kind === 'recovery') {
    const recovery = bottomArtifact.recovery;
    return {
      kind: 'recovery',
      recovery,
      disabled: deps.isLoading,
      errorMessage: deps.controlErrorMessage,
      submitRecovery: () => {
        if (deps.isLoading) {
          return;
        }

        deps.submitTypedPhaseIntent({
          kind: 'phase-continue',
          phase: recovery.phase,
        });
      },
    };
  }

  if (bottomArtifact.kind === 'phase-summary') {
    const phaseSummary = bottomArtifact.phaseSummary;
    return {
      kind: 'phase-summary',
      phaseSummary,
      disabled: deps.isLoading,
      confirmPhaseSummary: () => deps.confirmPhaseClosure(phaseSummary.phase, phaseSummary.turnId),
    };
  }

  if (bottomArtifact.kind === 'generating') {
    return {
      kind: 'generating',
      liveActivity: deps.liveActivity,
      liveReasoningText: deps.liveReasoningText,
      liveToolItems: deps.liveToolItems?.map(({ detail, key, label }) => ({
        detail,
        key,
        label,
      })),
      liveToolsRunning: deps.liveToolsRunning,
      pendingPreface: bottomArtifact.pendingPreface,
    };
  }

  if (bottomArtifact.kind === 'phase-handoff') {
    return {
      kind: 'phase-handoff',
      phase: bottomArtifact.phase,
      nextPhase: bottomArtifact.nextPhase,
      summary: bottomArtifact.summary,
      isReviewPhase: bottomArtifact.isReviewPhase,
    };
  }

  // workflow-complete
  return {
    kind: 'workflow-complete',
    phase: bottomArtifact.phase,
    summary: bottomArtifact.summary,
    isReviewPhase: bottomArtifact.isReviewPhase,
  };
}
