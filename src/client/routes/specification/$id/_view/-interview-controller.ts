import { useChat } from '@ai-sdk/react';
import { useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useSubmitPhaseIntentMutation,
  useSubmitTurnResponseMutation,
} from '@/client/mutations/interview-mutations';
import type { ReviewAction, WorkflowPhase } from '@/shared/api-types.js';
import { brunchDataPartSchemas, getActivityToolLabel, summarizeAssistantActivity } from '@/shared/chat.js';
import type { ActivitySummary, BrunchUIMessage } from '@/shared/chat.js';
import {
  createConfirmProposedPhaseClosureCommand,
  createForceCloseActivePhaseCommand,
  getPhaseClosureCommandText,
} from '@/shared/phase-close.js';
import type { DataConfirmation } from '@/shared/phase-close.js';
import { getPhaseRoutePath } from '@/shared/phase-descriptors.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import { type SpecificationMode, type SpecificationTurn } from '@/shared/specification.js';

import {
  useInvalidateSpecificationQueryDomains,
  usePromoteStreamedFrontierTurnToBundle,
  useSpecificationBundleData,
} from '../-specification-data.js';
import {
  buildPhaseTurnIds,
  createInterviewControllerViewState,
  filterMessagesByPhase,
  reconcileStablePhaseTurns,
} from './-interview-controller-core.js';
import type {
  InterviewDurableSpecificationState,
  KickoffControlViewModel,
  PendingQuestionViewModel,
  PhaseSummaryViewModel,
  RecoveryControlViewModel,
} from './-interview-controller-core.js';
import { useInterviewDataAdapter } from './-interview-data.js';
import { getSpecificationScopedChatId } from './-interview-hydration.js';
import {
  useSpecificationRuntimeLifecycle,
  useSpecificationScopedAutoPhaseIntent,
} from './-specification-lifecycle.js';

export interface InterviewControllerChatState {
  readonly messages: readonly BrunchUIMessage[];
  readonly status: ChatStatus;
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly submitText: (text: string) => void;
  readonly confirmPhaseClosure: (phase: SpecificationTurn['phase'], turnId: number) => void;
  readonly forcePhaseClosure: (phase: SpecificationTurn['phase']) => void;
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
      readonly pendingPreface?: import('@/shared/chat.js').PrefaceData;
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

export interface InterviewController {
  readonly specification: InterviewDurableSpecificationState['specification'];
  readonly workflow: InterviewDurableSpecificationState['workflow'];
  readonly phaseTurns: readonly SpecificationTurn[];
  readonly captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>;
  readonly chat: InterviewControllerChatState;
  readonly bottomArtifact: InterviewControllerBottomArtifactState | null;
  readonly structuralArtifactTurnIds: readonly number[] | undefined;
}

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

function getLiveToolItems(messages: readonly BrunchUIMessage[], status: ChatStatus) {
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

function hasRunningLiveTool(messages: readonly BrunchUIMessage[], status: ChatStatus): boolean {
  return getLiveToolParts(messages, status).some(
    (part) => part && 'state' in part && part.state !== 'output-available',
  );
}

function getLatestAssistantActivity(
  messages: readonly BrunchUIMessage[],
  status: ChatStatus,
): ActivitySummary | undefined {
  const liveAssistantMessage = getLatestLiveAssistantMessage(messages, status);
  if (!liveAssistantMessage?.parts) {
    return undefined;
  }

  return summarizeAssistantActivity(liveAssistantMessage.parts) ?? undefined;
}

function getLatestReasoningText(
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

function sameTurnReferences(
  left: readonly SpecificationTurn[],
  right: readonly SpecificationTurn[],
): boolean {
  return left.length === right.length && left.every((turn, index) => turn === right[index]);
}

export function useInterviewController(phase: WorkflowPhase): InterviewController {
  const specificationState = useSpecificationBundleData();
  const turns = specificationState.turns;
  const router = useRouter();
  const { invalidateSpecificationBundle, invalidateEntities } = useInvalidateSpecificationQueryDomains();
  const promoteStreamedFrontierTurnToBundle = usePromoteStreamedFrontierTurnToBundle();
  const specificationId = specificationState.specification.id;

  const refreshReadModel = useCallback(
    () => invalidateSpecificationBundle(),
    [invalidateSpecificationBundle],
  );
  const { durableSpecification, ephemeralChat } = useInterviewDataAdapter(specificationState);

  const phaseTurnIds = useMemo(() => buildPhaseTurnIds(turns, phase), [phase, turns]);

  const durablePhaseTurns = useMemo(() => turns.filter((turn) => turn.phase === phase), [phase, turns]);
  const [stablePhaseTurns, setStablePhaseTurns] = useState(() => durablePhaseTurns);
  const stablePhaseKeyRef = useRef(`${durableSpecification.specification.id}:${phase}`);
  const stablePhaseKey = `${durableSpecification.specification.id}:${phase}`;
  const projectedPhaseTurns = useMemo(
    () =>
      stablePhaseKeyRef.current === stablePhaseKey
        ? reconcileStablePhaseTurns(stablePhaseTurns, durablePhaseTurns)
        : durablePhaseTurns,
    [durablePhaseTurns, stablePhaseKey, stablePhaseTurns],
  );

  useEffect(() => {
    setStablePhaseTurns((current) =>
      sameTurnReferences(current, projectedPhaseTurns) ? current : projectedPhaseTurns,
    );
    stablePhaseKeyRef.current = stablePhaseKey;
  }, [projectedPhaseTurns, stablePhaseKey]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/specifications/${specificationId}/chat` }),
    [specificationId],
  );
  const navigateToPhase = useCallback(
    (nextPhase: WorkflowPhase) =>
      router.navigate({
        to: getPhaseRoutePath(nextPhase) as '/specification/$id/grounding',
        params: { id: String(specificationId) },
      }),
    [router, specificationId],
  );
  const runtime = useSpecificationRuntimeLifecycle({
    specificationId,
    phase,
    workflow: durableSpecification.workflow,
    turns,
    structuralArtifactTurnIds: specificationState.structuralArtifactTurnIds,
    refreshReadModel,
    refreshEntities: invalidateEntities,
    navigateToPhase,
  });
  const handleChatData = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      runtime.handleObserverResult(dataPart, async () => {
        await Promise.all([refreshReadModel(), invalidateEntities()]);
      });
    },
    [invalidateEntities, refreshReadModel, runtime],
  );

  const { messages, sendMessage, status, error } = useChat<BrunchUIMessage>({
    id: getSpecificationScopedChatId(durableSpecification.specification.id),
    transport,
    messages: [...ephemeralChat.seedMessages],
    dataPartSchemas: brunchDataPartSchemas,
    onData: handleChatData,
    onFinish: runtime.handleChatFinish,
  });
  const submitTurnResponseMutation = useSubmitTurnResponseMutation({
    specificationId,
    turn: durableSpecification.lastTurn,
    sendMessage,
  });
  const submitPhaseIntentMutation = useSubmitPhaseIntentMutation({ specificationId });
  const controlErrorMessage = submitPhaseIntentMutation.errorMessage ?? error?.message ?? null;
  const isLoading = status === 'submitted' || status === 'streaming';

  const phaseMessages = useMemo(
    () => filterMessagesByPhase(messages, phaseTurnIds),
    [messages, phaseTurnIds],
  );
  const liveActivity = useMemo(
    () => getLatestAssistantActivity(phaseMessages, status),
    [phaseMessages, status],
  );
  const liveReasoningText = useMemo(
    () => getLatestReasoningText(phaseMessages, status),
    [phaseMessages, status],
  );
  const liveToolItems = useMemo(() => getLiveToolItems(phaseMessages, status), [phaseMessages, status]);
  const liveToolsRunning = useMemo(() => hasRunningLiveTool(phaseMessages, status), [phaseMessages, status]);

  const submitText = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) {
        return;
      }

      void sendMessage({ text });
    },
    [isLoading, sendMessage],
  );

  const submitPhaseClosureCommand = useCallback(
    (command: DataConfirmation) => {
      if (isLoading) {
        return;
      }

      runtime.submitPhaseClosureCommand(() =>
        sendMessage({
          parts: [
            { type: 'text', text: getPhaseClosureCommandText(command) },
            {
              type: 'data-confirmation',
              data: command,
            },
          ],
        }),
      );
    },
    [isLoading, runtime.submitPhaseClosureCommand, sendMessage],
  );

  const submitTypedPhaseIntent = useCallback(
    async (intent: PhaseIntentRequest): Promise<boolean> => {
      if (isLoading) {
        return false;
      }

      const result =
        intent.kind === 'phase-entry'
          ? await submitPhaseIntentMutation.submitPhaseEntry(
              intent.phase,
              intent.mode ? { mode: intent.mode } : undefined,
            )
          : await submitPhaseIntentMutation.submitPhaseContinue(intent.phase);
      if (!result) {
        return false;
      }

      await Promise.resolve(
        sendMessage({
          parts: [
            {
              type: 'data-phase-intent',
              data: intent,
            },
          ],
        }),
      );
      return true;
    },
    [isLoading, sendMessage, submitPhaseIntentMutation],
  );

  const confirmPhaseClosure = useCallback(
    (closurePhase: SpecificationTurn['phase'], turnId: number) => {
      submitPhaseClosureCommand(createConfirmProposedPhaseClosureCommand(closurePhase, turnId));
    },
    [submitPhaseClosureCommand],
  );

  const forcePhaseClosure = useCallback(
    (closurePhase: SpecificationTurn['phase']) => {
      submitPhaseClosureCommand(createForceCloseActivePhaseCommand(closurePhase));
    },
    [submitPhaseClosureCommand],
  );

  const isAutoSubmittingPhaseIntent = useSpecificationScopedAutoPhaseIntent({
    specificationId,
    phase,
    workflow: durableSpecification.workflow,
    landing: durableSpecification.landing,
    chatStatus: status,
    submitPhaseIntent: submitTypedPhaseIntent,
  });

  const viewState = useMemo(
    () =>
      createInterviewControllerViewState(
        durableSpecification,
        phase,
        phaseMessages,
        isLoading,
        runtime.submittedTurnId,
        isAutoSubmittingPhaseIntent,
      ),
    [
      durableSpecification,
      isAutoSubmittingPhaseIntent,
      isLoading,
      phase,
      phaseMessages,
      runtime.submittedTurnId,
    ],
  );

  useEffect(() => {
    if (viewState.bottomArtifact?.kind !== 'pending-question') {
      return;
    }

    const pendingQuestion = viewState.bottomArtifact.pendingQuestion;
    if (!pendingQuestion.acknowledgedTurnId) {
      return;
    }

    promoteStreamedFrontierTurnToBundle({
      turnId: pendingQuestion.acknowledgedTurnId,
      phase,
      question: pendingQuestion,
    });
  }, [phase, promoteStreamedFrontierTurnToBundle, viewState.bottomArtifact]);

  return {
    specification: viewState.specification,
    workflow: viewState.workflow,
    phaseTurns: projectedPhaseTurns,
    captureStatusByTurnId: runtime.captureStatusByTurnId,
    structuralArtifactTurnIds: specificationState.structuralArtifactTurnIds,
    chat: {
      messages: phaseMessages,
      status,
      isLoading,
      isStreaming: status === 'streaming',
      submitText,
      confirmPhaseClosure,
      forcePhaseClosure,
    },
    bottomArtifact: viewState.bottomArtifact
      ? viewState.bottomArtifact.kind === 'persisted-turn'
        ? {
            kind: 'persisted-turn',
            turn: viewState.bottomArtifact.turn,
            state: viewState.bottomArtifact.state,
            disabled: viewState.bottomArtifact.state === 'submitted',
            errorMessage: submitTurnResponseMutation.errorMessage,
            liveActivity,
            submitTurnResponse: async (
              positions: number[],
              freeText?: string,
              reviewAction?: ReviewAction,
              itemComments?: Array<{ reviewItemId: string; comment: string }>,
            ) => {
              const activeTurn =
                viewState.bottomArtifact?.kind === 'persisted-turn' ? viewState.bottomArtifact.turn : null;
              if (activeTurn === null) {
                return;
              }

              await runtime.submitTrackedTurnResponse(activeTurn, () =>
                submitTurnResponseMutation.submitTurnResponse(
                  positions,
                  freeText,
                  reviewAction,
                  itemComments,
                ),
              );
            },
          }
        : viewState.bottomArtifact.kind === 'pending-question'
          ? {
              kind: 'pending-question',
              pendingQuestion: viewState.bottomArtifact.pendingQuestion,
              disabled: true,
              liveActivity,
            }
          : viewState.bottomArtifact.kind === 'kickoff'
            ? (() => {
                const kickoff = viewState.bottomArtifact.kickoff;

                return {
                  kind: 'kickoff' as const,
                  kickoff,
                  disabled: isLoading,
                  errorMessage: controlErrorMessage,
                  submitKickoff: (selectedMode?: SpecificationMode) => {
                    if (isLoading) {
                      return;
                    }

                    if (kickoff.phase === 'grounding' && kickoff.mode === 'start' && selectedMode) {
                      void submitTypedPhaseIntent({
                        kind: 'phase-entry',
                        phase: kickoff.phase,
                        mode: selectedMode,
                      });
                      return;
                    }

                    void submitTypedPhaseIntent(
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
              })()
            : viewState.bottomArtifact.kind === 'recovery'
              ? (() => {
                  const recovery = viewState.bottomArtifact.recovery;

                  return {
                    kind: 'recovery' as const,
                    recovery,
                    disabled: isLoading,
                    errorMessage: controlErrorMessage,
                    submitRecovery: () => {
                      if (isLoading) {
                        return;
                      }

                      void submitTypedPhaseIntent({
                        kind: 'phase-continue',
                        phase: recovery.phase,
                      });
                    },
                  };
                })()
              : viewState.bottomArtifact.kind === 'phase-summary'
                ? (() => {
                    const phaseSummary = viewState.bottomArtifact.phaseSummary;

                    return {
                      kind: 'phase-summary' as const,
                      phaseSummary,
                      disabled: isLoading,
                      confirmPhaseSummary: () => confirmPhaseClosure(phaseSummary.phase, phaseSummary.turnId),
                    };
                  })()
                : viewState.bottomArtifact.kind === 'generating'
                  ? {
                      kind: 'generating' as const,
                      liveActivity,
                      liveReasoningText,
                      liveToolItems: liveToolItems?.map(({ detail, key, label }) => ({ detail, key, label })),
                      liveToolsRunning,
                      pendingPreface: viewState.bottomArtifact.pendingPreface,
                    }
                  : viewState.bottomArtifact.kind === 'phase-handoff'
                    ? {
                        kind: 'phase-handoff' as const,
                        phase: viewState.bottomArtifact.phase,
                        nextPhase: viewState.bottomArtifact.nextPhase,
                        summary: viewState.bottomArtifact.summary,
                        isReviewPhase: viewState.bottomArtifact.isReviewPhase,
                      }
                    : {
                        kind: 'workflow-complete' as const,
                        phase: viewState.bottomArtifact.phase,
                        summary: viewState.bottomArtifact.summary,
                        isReviewPhase: viewState.bottomArtifact.isReviewPhase,
                      }
      : null,
  };
}
