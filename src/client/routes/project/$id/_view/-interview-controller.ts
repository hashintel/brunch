import { useChat } from '@ai-sdk/react';
import { useLoaderData, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSubmitTurnResponseMutation } from '@/client/mutations/interview-mutations';
import type { ProjectStateTurn, WorkflowPhase } from '@/shared/api-types.js';
import { brunchDataPartSchemas } from '@/shared/chat.js';
import type { BrunchUIMessage } from '@/shared/chat.js';
import {
  createConfirmProposedPhaseClosureCommand,
  createForceCloseActivePhaseCommand,
  getPhaseClosureCommandText,
} from '@/shared/phase-close.js';
import type { DataConfirmation } from '@/shared/phase-close.js';
import { getNextActivePhase, phaseRouteSegments } from '@/shared/phase-routes.js';

import {
  buildPhaseTurnIds,
  createInterviewControllerViewState,
  filterMessagesByPhase,
  reconcileStablePhaseTurns,
} from './-interview-controller-core.js';
import type {
  PendingQuestionViewModel,
  PhaseSummaryViewModel,
  InterviewDurableProjectState,
} from './-interview-controller-core.js';
import { useInterviewDataAdapter } from './-interview-data.js';
import { getProjectScopedChatId } from './-interview-hydration.js';

export interface InterviewControllerChatState {
  readonly messages: readonly BrunchUIMessage[];
  readonly status: ChatStatus;
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly submitText: (text: string) => void;
  readonly confirmPhaseClosure: (phase: ProjectStateTurn['phase'], turnId: number) => void;
  readonly forcePhaseClosure: (phase: ProjectStateTurn['phase']) => void;
}

export type InterviewControllerTurnCardState =
  | {
      readonly kind: 'persisted-turn';
      readonly turn: ProjectStateTurn;
      readonly state: 'active' | 'submitted';
      readonly disabled: boolean;
      readonly errorMessage: string | null;
      readonly submitTurnResponse: (positions: number[], freeText?: string) => Promise<void>;
    }
  | {
      readonly kind: 'pending-question';
      readonly pendingQuestion: PendingQuestionViewModel;
      readonly disabled: true;
    };

export interface InterviewControllerPromptInputState {
  readonly visible: boolean;
  readonly disabled: boolean;
}

export interface InterviewController {
  readonly project: InterviewDurableProjectState['project'];
  readonly workflow: InterviewDurableProjectState['workflow'];
  readonly phaseTurns: readonly ProjectStateTurn[];
  readonly captureStatusByTurnId: ReadonlyMap<number, 'waiting' | 'applying'>;
  readonly chat: InterviewControllerChatState;
  readonly turnCard: InterviewControllerTurnCardState | null;
  readonly phaseSummary: PhaseSummaryViewModel | null;
  readonly promptInput: InterviewControllerPromptInputState;
}

export function useInterviewController(phase: WorkflowPhase): InterviewController {
  const projectState = useLoaderData({ from: '/project/$id' });
  const router = useRouter();
  const projectId = projectState.project.id;

  const invalidateRouter = useCallback(() => router.invalidate(), [router]);
  const { durableProject, ephemeralChat, handleDataPart } = useInterviewDataAdapter(
    projectState,
    invalidateRouter,
  );

  const phaseTurnIds = useMemo(
    () => buildPhaseTurnIds(durableProject.turns, phase),
    [durableProject.turns, phase],
  );

  const [stablePhaseTurns, setStablePhaseTurns] = useState(() =>
    durableProject.turns.filter((turn) => turn.phase === phase),
  );
  const [submittedTurnId, setSubmittedTurnId] = useState<number | null>(null);
  const [captureStatusByTurnId, setCaptureStatusByTurnId] = useState<Map<number, 'waiting' | 'applying'>>(
    () => new Map(),
  );
  const [pendingCloseNavigation, setPendingCloseNavigation] = useState(false);
  const pendingCloseRef = useRef(false);
  const stablePhaseKeyRef = useRef(`${durableProject.project.id}:${phase}`);

  useEffect(() => {
    const phaseTurns = durableProject.turns.filter((turn) => turn.phase === phase);
    const stablePhaseKey = `${durableProject.project.id}:${phase}`;

    setStablePhaseTurns((current) =>
      stablePhaseKeyRef.current === stablePhaseKey
        ? reconcileStablePhaseTurns(current, phaseTurns)
        : phaseTurns,
    );
    stablePhaseKeyRef.current = stablePhaseKey;
  }, [durableProject.project.id, durableProject.turns, phase]);

  useEffect(() => {
    setSubmittedTurnId(null);
    setCaptureStatusByTurnId(new Map());
  }, [durableProject.project.id, phase]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/projects/${projectId}/chat` }),
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
        }
      }

      handleDataPart(dataPart);
    },
    [handleDataPart, submittedTurnId],
  );

  const { messages, sendMessage, status } = useChat<BrunchUIMessage>({
    id: getProjectScopedChatId(durableProject.project.id),
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
    turn: durableProject.lastTurn,
    sendMessage,
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  // Phase-filtered messages for display
  const phaseMessages = useMemo(
    () => filterMessagesByPhase(messages, phaseTurnIds),
    [messages, phaseTurnIds],
  );

  const viewState = useMemo(
    () =>
      createInterviewControllerViewState(durableProject, phase, phaseMessages, isLoading, submittedTurnId),
    [durableProject, isLoading, phase, phaseMessages, submittedTurnId],
  );

  useEffect(() => {
    if (submittedTurnId === null) {
      return;
    }

    if (viewState.turnCard?.kind === 'pending-question' || viewState.phaseSummary) {
      setCaptureStatusByTurnId((current) => {
        if (current.has(submittedTurnId)) {
          return current;
        }
        return new Map(current).set(submittedTurnId, 'waiting');
      });
    }

    const phaseTurnId = durableProject.workflow.phases[phase].turnId;
    if (durableProject.workflow.phases[phase].status === 'closed' || phaseTurnId !== submittedTurnId) {
      setSubmittedTurnId(null);
    }
  }, [submittedTurnId, durableProject.workflow, phase, viewState.phaseSummary, viewState.turnCard]);

  useEffect(() => {
    setCaptureStatusByTurnId((current) => {
      let next: Map<number, 'waiting' | 'applying'> | null = null;

      for (const turn of stablePhaseTurns) {
        if ((turn.captured_items?.length ?? 0) === 0 || !current.has(turn.id)) {
          continue;
        }

        if (next === null) {
          next = new Map(current);
        }
        next.delete(turn.id);
      }

      return next ?? current;
    });
  }, [stablePhaseTurns]);

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

  const confirmPhaseClosure = useCallback(
    (closurePhase: ProjectStateTurn['phase'], turnId: number) => {
      submitPhaseClosureCommand(createConfirmProposedPhaseClosureCommand(closurePhase, turnId));
    },
    [submitPhaseClosureCommand],
  );

  const forcePhaseClosure = useCallback(
    (closurePhase: ProjectStateTurn['phase']) => {
      submitPhaseClosureCommand(createForceCloseActivePhaseCommand(closurePhase));
    },
    [submitPhaseClosureCommand],
  );

  // Navigate to next phase after close confirmation succeeds
  useEffect(() => {
    if (!pendingCloseNavigation) return;
    if (durableProject.workflow.phases[phase].status !== 'closed') return;

    setPendingCloseNavigation(false);
    const nextPhase = getNextActivePhase(durableProject.workflow.phases, phase);
    if (nextPhase) {
      void router.navigate({
        to: `/project/$id/${phaseRouteSegments[nextPhase]}` as '/project/$id/framing',
        params: { id: String(projectId) },
      });
    }
  }, [pendingCloseNavigation, durableProject.workflow, phase, router, projectId]);

  return {
    project: viewState.project,
    workflow: viewState.workflow,
    phaseTurns: stablePhaseTurns,
    captureStatusByTurnId,
    chat: {
      messages: phaseMessages,
      status,
      isLoading,
      isStreaming: status === 'streaming',
      submitText,
      confirmPhaseClosure,
      forcePhaseClosure,
    },
    turnCard: viewState.turnCard
      ? viewState.turnCard.kind === 'persisted-turn'
        ? {
            kind: 'persisted-turn',
            turn: viewState.turnCard.turn,
            state: viewState.turnCard.state,
            disabled: viewState.turnCard.state === 'submitted',
            errorMessage: submitTurnResponseMutation.errorMessage,
            submitTurnResponse: async (positions: number[], freeText?: string) => {
              const turnId =
                viewState.turnCard?.kind === 'persisted-turn' ? viewState.turnCard.turn.id : null;
              if (turnId === null) {
                return;
              }

              setSubmittedTurnId(turnId);
              const didSubmit = await submitTurnResponseMutation.submitTurnResponse(positions, freeText);
              if (!didSubmit) {
                setSubmittedTurnId(null);
              }
            },
          }
        : {
            kind: 'pending-question',
            pendingQuestion: viewState.turnCard.pendingQuestion,
            disabled: true,
          }
      : null,
    phaseSummary: viewState.phaseSummary,
    promptInput: {
      visible: viewState.promptInput.visible,
      disabled: isLoading || submitTurnResponseMutation.isPending,
    },
  };
}
