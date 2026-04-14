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
  const [pendingCloseNavigation, setPendingCloseNavigation] = useState(false);
  const pendingCloseRef = useRef(false);

  useEffect(() => {
    setStablePhaseTurns(durableProject.turns.filter((turn) => turn.phase === phase));
  }, [durableProject.project.id, phase]);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/projects/${projectId}/chat` }),
    [projectId],
  );
  const { messages, sendMessage, status } = useChat<BrunchUIMessage>({
    id: getProjectScopedChatId(durableProject.project.id),
    transport,
    messages: [...ephemeralChat.seedMessages],
    dataPartSchemas: brunchDataPartSchemas,
    onData: handleDataPart,
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
    () => createInterviewControllerViewState(durableProject, phase, phaseMessages, isLoading),
    [durableProject, isLoading, phase, phaseMessages],
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
            disabled: submitTurnResponseMutation.isPending || isLoading,
            errorMessage: submitTurnResponseMutation.errorMessage,
            submitTurnResponse: submitTurnResponseMutation.submitTurnResponse,
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
