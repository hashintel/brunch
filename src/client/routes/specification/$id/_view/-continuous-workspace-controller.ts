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
import type { ActivitySummary, BrunchUIMessage } from '@/shared/chat.js';
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
  InterviewBottomArtifactViewModel,
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

function useLatestCallback<Args extends readonly unknown[], Return>(
  callback: (...args: Args) => Return,
): (...args: Args) => Return {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: Args) => callbackRef.current(...args), []);
}

function sameBottomArtifact(
  left: InterviewBottomArtifactViewModel | null,
  right: InterviewBottomArtifactViewModel | null,
) {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind) return false;

  switch (left.kind) {
    case 'persisted-turn':
      return right.kind === 'persisted-turn' && left.turn === right.turn && left.state === right.state;
    case 'pending-question':
      return right.kind === 'pending-question' && left.pendingQuestion === right.pendingQuestion;
    case 'kickoff':
      return (
        right.kind === 'kickoff' &&
        left.kickoff.phase === right.kickoff.phase &&
        left.kickoff.mode === right.kickoff.mode
      );
    case 'recovery':
      return right.kind === 'recovery' && left.recovery.phase === right.recovery.phase;
    case 'phase-summary':
      return (
        right.kind === 'phase-summary' &&
        left.phaseSummary.turnId === right.phaseSummary.turnId &&
        left.phaseSummary.phase === right.phaseSummary.phase &&
        left.phaseSummary.summary === right.phaseSummary.summary
      );
    case 'generating':
      return right.kind === 'generating' && left.pendingPreface === right.pendingPreface;
    case 'phase-handoff':
      return (
        right.kind === 'phase-handoff' &&
        left.phase === right.phase &&
        left.nextPhase === right.nextPhase &&
        left.summary === right.summary &&
        left.isReviewPhase === right.isReviewPhase
      );
    case 'workflow-complete':
      return (
        right.kind === 'workflow-complete' &&
        left.phase === right.phase &&
        left.summary === right.summary &&
        left.isReviewPhase === right.isReviewPhase
      );
  }
}

function useStableBottomArtifact(bottomArtifact: InterviewBottomArtifactViewModel | null) {
  const stableRef = useRef(bottomArtifact);
  if (!sameBottomArtifact(stableRef.current, bottomArtifact)) {
    stableRef.current = bottomArtifact;
  }
  return stableRef.current;
}

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameActivitySummary(left: ActivitySummary | undefined, right: ActivitySummary | undefined) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.seconds === right.seconds && sameStringArray(left.tools, right.tools);
}

function sameEnrichedBottomArtifact(
  left: InterviewControllerBottomArtifactState | null,
  right: InterviewControllerBottomArtifactState | null,
) {
  if (left === right) return true;
  if (!left || !right || left.kind !== right.kind) return false;

  switch (left.kind) {
    case 'persisted-turn':
      return (
        right.kind === 'persisted-turn' &&
        left.turn === right.turn &&
        left.state === right.state &&
        left.disabled === right.disabled &&
        left.errorMessage === right.errorMessage &&
        sameActivitySummary(left.liveActivity, right.liveActivity)
      );
    case 'pending-question':
      return (
        right.kind === 'pending-question' &&
        left.pendingQuestion === right.pendingQuestion &&
        left.disabled === right.disabled &&
        sameActivitySummary(left.liveActivity, right.liveActivity)
      );
    case 'kickoff':
      return (
        right.kind === 'kickoff' &&
        left.kickoff.phase === right.kickoff.phase &&
        left.kickoff.mode === right.kickoff.mode &&
        left.disabled === right.disabled &&
        left.errorMessage === right.errorMessage
      );
    case 'recovery':
      return (
        right.kind === 'recovery' &&
        left.recovery.phase === right.recovery.phase &&
        left.disabled === right.disabled &&
        left.errorMessage === right.errorMessage
      );
    case 'phase-summary':
      return (
        right.kind === 'phase-summary' &&
        left.phaseSummary.turnId === right.phaseSummary.turnId &&
        left.phaseSummary.phase === right.phaseSummary.phase &&
        left.phaseSummary.summary === right.phaseSummary.summary &&
        left.disabled === right.disabled
      );
    case 'generating':
      return (
        right.kind === 'generating' &&
        left.pendingPreface === right.pendingPreface &&
        left.liveReasoningText === right.liveReasoningText &&
        left.liveToolsRunning === right.liveToolsRunning &&
        sameActivitySummary(left.liveActivity, right.liveActivity) &&
        JSON.stringify(left.liveToolItems ?? null) === JSON.stringify(right.liveToolItems ?? null)
      );
    case 'phase-handoff':
      return (
        right.kind === 'phase-handoff' &&
        left.phase === right.phase &&
        left.nextPhase === right.nextPhase &&
        left.summary === right.summary &&
        left.isReviewPhase === right.isReviewPhase
      );
    case 'workflow-complete':
      return (
        right.kind === 'workflow-complete' &&
        left.phase === right.phase &&
        left.summary === right.summary &&
        left.isReviewPhase === right.isReviewPhase
      );
  }
}

function useStableEnrichedBottomArtifact(bottomArtifact: InterviewControllerBottomArtifactState | null) {
  const stableRef = useRef(bottomArtifact);
  if (!sameEnrichedBottomArtifact(stableRef.current, bottomArtifact)) {
    stableRef.current = bottomArtifact;
  }
  return stableRef.current;
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
  const seedMessages = useMemo(() => [...ephemeralChat.seedMessages], [ephemeralChat.seedMessages]);

  const { messages, sendMessage, status, error } = useChat<BrunchUIMessage>({
    id: getSpecificationScopedChatId(durableSpecification.specification.id),
    transport,
    messages: seedMessages,
    dataPartSchemas: brunchDataPartSchemas,
    onData: handleChatData,
    onFinish: runtime.handleChatFinish,
  });
  const { errorMessage: submitTurnResponseErrorMessage, submitTurnResponse } = useSubmitTurnResponseMutation({
    specificationId,
    turn: durableSpecification.lastTurn,
    sendMessage,
  });
  const {
    errorMessage: submitPhaseIntentErrorMessage,
    submitPhaseContinue,
    submitPhaseEntry,
  } = useSubmitPhaseIntentMutation({ specificationId });
  const controlErrorMessage = submitPhaseIntentErrorMessage ?? error?.message ?? null;
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
  const liveToolsRunning = (liveToolItems?.length ?? 0) > 0 && status === 'streaming';

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
          ? await submitPhaseEntry(intent.phase, intent.mode ? { mode: intent.mode } : undefined)
          : await submitPhaseContinue(intent.phase);
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
    [isLoading, sendMessage, submitPhaseContinue, submitPhaseEntry],
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
  const stableSubmitTrackedTurnResponse = useLatestCallback(runtime.submitTrackedTurnResponse);
  const stableSubmitTurnResponse = useLatestCallback(submitTurnResponse);
  const stableSubmitTypedPhaseIntent = useLatestCallback(submitTypedPhaseIntent);
  const stableConfirmPhaseClosure = useLatestCallback(confirmPhaseClosure);

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
  const stableBottomArtifact = useStableBottomArtifact(viewState.bottomArtifact);

  const rawEnrichedBottomArtifact = useMemo(
    () =>
      enrichBottomArtifact(stableBottomArtifact, {
        submitTurnResponseErrorMessage,
        submitTrackedTurnResponse: stableSubmitTrackedTurnResponse,
        submitTurnResponse: stableSubmitTurnResponse,
        liveActivity,
        isLoading,
        controlErrorMessage,
        submitTypedPhaseIntent: stableSubmitTypedPhaseIntent,
        confirmPhaseClosure: stableConfirmPhaseClosure,
        liveReasoningText,
        liveToolItems,
        liveToolsRunning,
      }),
    [
      controlErrorMessage,
      isLoading,
      liveActivity,
      liveReasoningText,
      liveToolItems,
      liveToolsRunning,
      stableConfirmPhaseClosure,
      stableSubmitTrackedTurnResponse,
      stableSubmitTurnResponse,
      stableSubmitTypedPhaseIntent,
      stableBottomArtifact,
      submitTurnResponseErrorMessage,
    ],
  );
  const enrichedBottomArtifact = useStableEnrichedBottomArtifact(rawEnrichedBottomArtifact);

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
