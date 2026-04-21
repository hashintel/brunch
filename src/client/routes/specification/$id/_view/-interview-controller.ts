import { useChat } from '@ai-sdk/react';
import { useLoaderData, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isVisibleKnowledgeKind } from '@/client/components/knowledge-display';
import {
  useSubmitPhaseIntentMutation,
  useSubmitTurnResponseMutation,
} from '@/client/mutations/interview-mutations';
import type { EntitiesData, ReviewAction, WorkflowPhase } from '@/shared/api-types.js';
import { brunchDataPartSchemas, summarizeAssistantActivity } from '@/shared/chat.js';
import type { ActivitySummary, BrunchUIMessage } from '@/shared/chat.js';
import { knowledgeCollectionKeyByKind } from '@/shared/knowledge.js';
import {
  createConfirmProposedPhaseClosureCommand,
  createForceCloseActivePhaseCommand,
  getPhaseClosureCommandText,
} from '@/shared/phase-close.js';
import type { DataConfirmation } from '@/shared/phase-close.js';
import { getNextActivePhase, getPhaseRoutePath } from '@/shared/phase-descriptors.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import {
  getSpecificationRecord,
  type SpecificationMode,
  type SpecificationTurn,
} from '@/shared/specification.js';

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
import { useSpecificationScopedAutoPhaseIntent } from './-specification-lifecycle.js';

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
        itemComments?: Array<{ itemIndex: number; comment: string }>,
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
      readonly submitKickoff: (mode?: SpecificationMode) => void;
    }
  | {
      readonly kind: 'recovery';
      readonly recovery: RecoveryControlViewModel;
      readonly disabled: boolean;
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
}

function visibleCapturesAreSynced(
  turn: Pick<SpecificationTurn, 'captured_items'>,
  entityState: EntitiesData,
): boolean {
  return (turn.captured_items ?? [])
    .filter((item) => isVisibleKnowledgeKind(item.kind))
    .every((item) =>
      entityState[knowledgeCollectionKeyByKind[item.kind]].some((entity) => entity.id === item.id),
    );
}

function getLatestAssistantActivity(
  messages: readonly BrunchUIMessage[],
  status: ChatStatus,
): ActivitySummary | undefined {
  if (status !== 'streaming') {
    return undefined;
  }

  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message?.role !== 'assistant' || !message.parts) {
      continue;
    }

    const activitySummary = summarizeAssistantActivity(message.parts);
    if (activitySummary) {
      return activitySummary;
    }
  }

  return undefined;
}

export function useInterviewController(phase: WorkflowPhase, entityState: EntitiesData): InterviewController {
  const specificationState = useLoaderData({ from: '/specification/$id' });
  const router = useRouter();
  const projectId = getSpecificationRecord(specificationState).id;

  const invalidateRouter = useCallback(() => router.invalidate(), [router]);
  const { durableSpecification, ephemeralChat, handleDataPart } = useInterviewDataAdapter(
    specificationState,
    invalidateRouter,
  );

  const phaseTurnIds = useMemo(
    () => buildPhaseTurnIds(durableSpecification.turns, phase),
    [durableSpecification.turns, phase],
  );

  const [stablePhaseTurns, setStablePhaseTurns] = useState(() =>
    durableSpecification.turns.filter((turn) => turn.phase === phase),
  );
  const [submittedTurnId, setSubmittedTurnId] = useState<number | null>(null);
  const [captureStatusByTurnId, setCaptureStatusByTurnId] = useState<Map<number, 'waiting' | 'applying'>>(
    () => new Map(),
  );
  const [pendingCaptureSyncTurnIds, setPendingCaptureSyncTurnIds] = useState<Set<number>>(() => new Set());
  const [pendingCloseNavigation, setPendingCloseNavigation] = useState(false);
  const pendingCloseRef = useRef(false);
  const stablePhaseKeyRef = useRef(`${durableSpecification.specification.id}:${phase}`);

  useEffect(() => {
    const phaseTurns = durableSpecification.turns.filter((turn) => turn.phase === phase);
    const stablePhaseKey = `${durableSpecification.specification.id}:${phase}`;

    setStablePhaseTurns((current) =>
      stablePhaseKeyRef.current === stablePhaseKey
        ? reconcileStablePhaseTurns(current, phaseTurns)
        : phaseTurns,
    );
    stablePhaseKeyRef.current = stablePhaseKey;
  }, [durableSpecification.specification.id, durableSpecification.turns, phase]);

  useEffect(() => {
    setSubmittedTurnId(null);
    setCaptureStatusByTurnId(new Map());
    setPendingCaptureSyncTurnIds(new Set());
  }, [durableSpecification.specification.id, phase]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/specifications/${projectId}/chat` }),
    [projectId],
  );
  const handleChatData = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type === 'data-observer-result') {
        const observerTurnId =
          typeof dataPart.data === 'object' &&
          dataPart.data !== null &&
          'turnId' in dataPart.data &&
          typeof dataPart.data.turnId === 'number'
            ? dataPart.data.turnId
            : submittedTurnId;

        if (observerTurnId !== null) {
          setCaptureStatusByTurnId((current) => new Map(current).set(observerTurnId, 'applying'));
          setPendingCaptureSyncTurnIds((current) => new Set(current).add(observerTurnId));
        }
      }

      handleDataPart(dataPart);
    },
    [handleDataPart, submittedTurnId],
  );

  const { messages, sendMessage, status } = useChat<BrunchUIMessage>({
    id: getSpecificationScopedChatId(durableSpecification.specification.id),
    transport,
    messages: [...ephemeralChat.seedMessages],
    dataPartSchemas: brunchDataPartSchemas,
    onData: handleChatData,
    onFinish: () => {
      if (pendingCloseRef.current) {
        pendingCloseRef.current = false;
        setPendingCloseNavigation(true);
      }
      void router.invalidate();
    },
  });
  const submitTurnResponseMutation = useSubmitTurnResponseMutation({
    projectId,
    turn: durableSpecification.lastTurn,
    sendMessage,
  });
  const submitPhaseIntentMutation = useSubmitPhaseIntentMutation({ projectId });
  const isLoading = status === 'submitted' || status === 'streaming';

  const phaseMessages = useMemo(
    () => filterMessagesByPhase(messages, phaseTurnIds),
    [messages, phaseTurnIds],
  );
  const liveActivity = useMemo(
    () => getLatestAssistantActivity(phaseMessages, status),
    [phaseMessages, status],
  );

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

      pendingCloseRef.current = true;
      void sendMessage({
        parts: [
          { type: 'text', text: getPhaseClosureCommandText(command) },
          {
            type: 'data-confirmation',
            data: command,
          },
        ],
      });
    },
    [isLoading, sendMessage],
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

  useEffect(() => {
    if (!pendingCloseNavigation) return;
    if (durableSpecification.workflow.phases[phase].status !== 'closed') return;

    setPendingCloseNavigation(false);
    const nextPhase = getNextActivePhase(durableSpecification.workflow.phases, phase);
    if (nextPhase) {
      void router.navigate({
        to: getPhaseRoutePath(nextPhase) as '/specification/$id/grounding',
        params: { id: String(projectId) },
      });
    }
  }, [pendingCloseNavigation, durableSpecification.workflow, phase, router, projectId]);

  const isAutoSubmittingPhaseIntent = useSpecificationScopedAutoPhaseIntent({
    projectId,
    phase,
    workflow: durableSpecification.workflow,
    landing: durableSpecification.landing,
    isChatLoading: isLoading,
    submitPhaseIntent: submitTypedPhaseIntent,
  });

  const viewState = useMemo(
    () =>
      createInterviewControllerViewState(
        durableSpecification,
        phase,
        phaseMessages,
        isLoading,
        submittedTurnId,
        isAutoSubmittingPhaseIntent,
      ),
    [durableSpecification, isAutoSubmittingPhaseIntent, isLoading, phase, phaseMessages, submittedTurnId],
  );

  useEffect(() => {
    if (submittedTurnId === null) {
      return;
    }

    if (
      viewState.bottomArtifact?.kind === 'pending-question' ||
      viewState.bottomArtifact?.kind === 'phase-summary'
    ) {
      setCaptureStatusByTurnId((current) => {
        if (current.has(submittedTurnId)) {
          return current;
        }
        return new Map(current).set(submittedTurnId, 'waiting');
      });
    }

    const phaseTurnId = durableSpecification.workflow.phases[phase].turnId;
    if (durableSpecification.workflow.phases[phase].status === 'closed' || phaseTurnId !== submittedTurnId) {
      setSubmittedTurnId(null);
    }
  }, [submittedTurnId, durableSpecification.workflow, phase, viewState.bottomArtifact]);

  useEffect(() => {
    const syncedTurnIds = stablePhaseTurns
      .filter((turn) => pendingCaptureSyncTurnIds.has(turn.id) && visibleCapturesAreSynced(turn, entityState))
      .map((turn) => turn.id);

    if (syncedTurnIds.length === 0) {
      return;
    }

    setPendingCaptureSyncTurnIds((current) => {
      const next = new Set(current);
      for (const turnId of syncedTurnIds) {
        next.delete(turnId);
      }
      return next;
    });
    setCaptureStatusByTurnId((current) => {
      const next = new Map(current);
      for (const turnId of syncedTurnIds) {
        next.delete(turnId);
      }
      return next;
    });
  }, [entityState, pendingCaptureSyncTurnIds, stablePhaseTurns]);

  const effectiveCaptureStatusByTurnId = useMemo(() => {
    const next = new Map(captureStatusByTurnId);
    for (const turnId of pendingCaptureSyncTurnIds) {
      next.set(turnId, 'applying');
    }
    return next;
  }, [captureStatusByTurnId, pendingCaptureSyncTurnIds]);

  return {
    specification: viewState.specification,
    workflow: viewState.workflow,
    phaseTurns: stablePhaseTurns,
    captureStatusByTurnId: effectiveCaptureStatusByTurnId,
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
              itemComments?: Array<{ itemIndex: number; comment: string }>,
            ) => {
              const turnId =
                viewState.bottomArtifact?.kind === 'persisted-turn' ? viewState.bottomArtifact.turn.id : null;
              if (turnId === null) {
                return;
              }

              setSubmittedTurnId(turnId);
              const didSubmit = await submitTurnResponseMutation.submitTurnResponse(
                positions,
                freeText,
                reviewAction,
                itemComments,
              );
              if (!didSubmit) {
                setSubmittedTurnId(null);
              }
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
                  ? { kind: 'generating' as const, liveActivity }
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
