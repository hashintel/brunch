import { useChat } from '@ai-sdk/react';
import { useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  useSubmitPhaseIntentMutation,
  useSubmitTurnResponseMutation,
} from '@/client/mutations/interview-mutations';
import type { WorkflowPhase } from '@/shared/api-types.js';
import { brunchDataPartSchemas } from '@/shared/chat.js';
import type { BrunchUIMessage } from '@/shared/chat.js';
import {
  createConfirmProposedPhaseClosureCommand,
  createForceCloseActivePhaseCommand,
  getPhaseClosureCommandText,
} from '@/shared/phase-close.js';
import type { DataConfirmation } from '@/shared/phase-close.js';
import { getCurrentOpenPhase, getPhaseRoutePath, phaseOrder } from '@/shared/phase-descriptors.js';
import type { PhaseIntentRequest } from '@/shared/phase-intents.js';
import { type SpecificationTurn } from '@/shared/specification.js';

import {
  useInvalidateSpecificationQueryDomains,
  usePromoteStreamedFrontierTurnToBundle,
  useSpecificationBundleData,
} from '../-specification-data.js';
import {
  buildPhaseTurnIds,
  createInterviewControllerViewState,
  enrichBottomArtifact,
  filterMessagesByPhase,
  getLatestAssistantActivity,
  getLatestReasoningText,
  getLiveToolItems,
  reconcileStablePhaseTurns,
  sameTurnReferences,
} from './-interview-controller-core.js';
import type {
  InterviewControllerBottomArtifactState,
  InterviewDurableSpecificationState,
} from './-interview-controller-core.js';
import { useInterviewDataAdapter } from './-interview-data.js';
import { getSpecificationScopedChatId } from './-interview-hydration.js';
import {
  useSpecificationRuntimeLifecycle,
  useSpecificationScopedAutoPhaseIntent,
} from './-specification-lifecycle.js';
import { specificationWorkspaceStream, type WorkspaceStreamArtifact } from './-workspace-stream-projector.js';

export interface ContinuousWorkspaceSection {
  readonly phase: WorkflowPhase;
  readonly artifacts: readonly WorkspaceStreamArtifact[];
  readonly phaseTurns: readonly SpecificationTurn[];
  readonly isActive: boolean;
}

export interface ContinuousWorkspaceChatState {
  readonly messages: readonly BrunchUIMessage[];
  readonly status: ChatStatus;
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly submitText: (text: string) => void;
  readonly confirmPhaseClosure: (phase: SpecificationTurn['phase'], turnId: number) => void;
  readonly forcePhaseClosure: (phase: SpecificationTurn['phase']) => void;
}

export interface ContinuousWorkspaceController {
  readonly specification: InterviewDurableSpecificationState['specification'];
  readonly workflow: InterviewDurableSpecificationState['workflow'];
  readonly sections: readonly ContinuousWorkspaceSection[];
  readonly activePhase: WorkflowPhase;
  readonly captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>;
  readonly chat: ContinuousWorkspaceChatState;
  readonly bottomArtifact: InterviewControllerBottomArtifactState | null;
}

export function useContinuousWorkspaceController(): ContinuousWorkspaceController {
  const specificationState = useSpecificationBundleData();
  const turns = specificationState.turns;
  const router = useRouter();
  const { invalidateSpecificationBundle, invalidateEntities } = useInvalidateSpecificationQueryDomains();
  const promoteStreamedFrontierTurnToBundle = usePromoteStreamedFrontierTurnToBundle();
  const specificationId = specificationState.specification.id;

  const currentReachablePhase = getCurrentOpenPhase(specificationState.workflow.phases);
  const activePhase = currentReachablePhase ?? phaseOrder[phaseOrder.length - 1]!;

  const refreshReadModel = useCallback(
    () => invalidateSpecificationBundle(),
    [invalidateSpecificationBundle],
  );
  const { durableSpecification, ephemeralChat } = useInterviewDataAdapter(specificationState);

  // Active-phase turn stabilization
  const phaseTurnIds = useMemo(() => buildPhaseTurnIds(turns, activePhase), [activePhase, turns]);
  const durablePhaseTurns = useMemo(
    () => turns.filter((turn) => turn.phase === activePhase),
    [activePhase, turns],
  );
  const [stablePhaseTurns, setStablePhaseTurns] = useState(() => durablePhaseTurns);
  const stablePhaseKeyRef = useRef(`${durableSpecification.specification.id}:${activePhase}`);
  const stablePhaseKey = `${durableSpecification.specification.id}:${activePhase}`;
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

  // Chat transport + lifecycle (spec-scoped, not phase-scoped)
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
    phase: activePhase,
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

  // Active-phase messages (phase-filtered for view state + live activity)
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
  const liveToolsRunning =
    (liveToolItems?.length ?? 0) > 0 && (status === 'streaming' || status === 'submitted');

  // Chat actions
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
    phase: activePhase,
    workflow: durableSpecification.workflow,
    landing: durableSpecification.landing,
    chatStatus: status,
    submitPhaseIntent: submitTypedPhaseIntent,
  });

  // Active-phase view state (bottom artifact)
  const viewState = useMemo(
    () =>
      createInterviewControllerViewState(
        durableSpecification,
        activePhase,
        phaseMessages,
        isLoading,
        runtime.submittedTurnId,
        isAutoSubmittingPhaseIntent,
      ),
    [
      durableSpecification,
      isAutoSubmittingPhaseIntent,
      isLoading,
      activePhase,
      phaseMessages,
      runtime.submittedTurnId,
    ],
  );

  // Promote streamed frontier turn
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
      phase: activePhase,
      question: pendingQuestion,
    });
  }, [activePhase, promoteStreamedFrontierTurnToBundle, viewState.bottomArtifact]);

  const enrichedBottomArtifact = enrichBottomArtifact(viewState.bottomArtifact, {
    submitTurnResponseErrorMessage: submitTurnResponseMutation.errorMessage,
    submitTrackedTurnResponse: runtime.submitTrackedTurnResponse,
    submitTurnResponse: submitTurnResponseMutation.submitTurnResponse,
    liveActivity,
    isLoading,
    controlErrorMessage,
    submitTypedPhaseIntent,
    confirmPhaseClosure,
    liveReasoningText,
    liveToolItems,
    liveToolsRunning,
  });

  // Project sections for all realized phases
  const sections = useMemo((): readonly ContinuousWorkspaceSection[] => {
    const result: ContinuousWorkspaceSection[] = [];

    for (const phase of phaseOrder) {
      const phaseState = durableSpecification.workflow.phases[phase];

      if (phaseState.status === 'unstarted' && phase !== activePhase) {
        continue;
      }

      if (phase === activePhase) {
        const { streamArtifacts } = specificationWorkspaceStream({
          phase,
          phaseTurns: projectedPhaseTurns,
          phaseState,
          bottomArtifact: enrichedBottomArtifact,
          structuralArtifactTurnIds: specificationState.structuralArtifactTurnIds,
        });
        result.push({
          phase,
          artifacts: streamArtifacts,
          phaseTurns: projectedPhaseTurns,
          isActive: true,
        });
      } else {
        const closedPhaseTurns = turns.filter((t) => t.phase === phase);
        const { streamArtifacts } = specificationWorkspaceStream({
          phase,
          phaseTurns: closedPhaseTurns,
          phaseState,
          bottomArtifact: null,
          structuralArtifactTurnIds: specificationState.structuralArtifactTurnIds,
        });
        result.push({ phase, artifacts: streamArtifacts, phaseTurns: closedPhaseTurns, isActive: false });
      }
    }

    return result;
  }, [
    activePhase,
    durableSpecification.workflow.phases,
    enrichedBottomArtifact,
    projectedPhaseTurns,
    specificationState.structuralArtifactTurnIds,
    turns,
  ]);

  return {
    specification: viewState.specification,
    workflow: viewState.workflow,
    sections,
    activePhase,
    captureStatusByTurnId: runtime.captureStatusByTurnId,
    chat: {
      messages: phaseMessages,
      status,
      isLoading,
      isStreaming: status === 'streaming',
      submitText,
      confirmPhaseClosure,
      forcePhaseClosure,
    },
    bottomArtifact: enrichedBottomArtifact,
  };
}
