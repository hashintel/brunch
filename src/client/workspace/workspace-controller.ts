import { useChat } from '@ai-sdk/react';
import { useLoaderData, useParams, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport, type ChatStatus } from 'ai';
import { useCallback, useMemo } from 'react';

import { useSubmitTurnResponseMutation } from '@/mutations/workspace-mutations';

import type { ProjectStateTurn } from '../../shared/api-types.js';
import { brunchDataPartSchemas, type BrunchUIMessage } from '../../shared/chat.js';
import {
  createForcedPhaseClosureConfirmation,
  createRecommendedPhaseClosureConfirmation,
} from '../../shared/phase-close.js';
import { useChatHydrationBoundary } from './chat-hydration.js';
import {
  createWorkspaceControllerViewState,
  type PendingQuestionViewModel,
  type PhaseSummaryViewModel,
  type WorkspaceDurableEntityState,
  type WorkspaceDurableProjectState,
} from './workspace-controller-core.js';
import { useWorkspaceDataAdapter } from './workspace-data.js';

export interface WorkspaceControllerChatState {
  messages: BrunchUIMessage[];
  status: ChatStatus;
  isLoading: boolean;
  isStreaming: boolean;
  submitText: (text: string) => void;
  confirmPhaseClosure: (phase: ProjectStateTurn['phase'], turnId: number) => void;
  forcePhaseClosure: (phase: ProjectStateTurn['phase']) => void;
}

export type WorkspaceControllerTurnCardState =
  | {
      kind: 'persisted-turn';
      turn: ProjectStateTurn;
      disabled: boolean;
      errorMessage: string | null;
      submitTurnResponse: (positions: number[], freeText?: string) => Promise<void>;
    }
  | {
      kind: 'pending-question';
      pendingQuestion: PendingQuestionViewModel;
      disabled: true;
    };

export interface WorkspaceControllerPromptInputState {
  visible: boolean;
  disabled: boolean;
}

export interface WorkspaceController {
  project: WorkspaceDurableProjectState['project'];
  workflow: WorkspaceDurableProjectState['workflow'];
  entityState: WorkspaceDurableEntityState;
  chat: WorkspaceControllerChatState;
  turnCard: WorkspaceControllerTurnCardState | null;
  phaseSummary: PhaseSummaryViewModel | null;
  promptInput: WorkspaceControllerPromptInputState;
}

export function useWorkspaceController(): WorkspaceController {
  const workspaceLoaderData = useLoaderData({ from: '/project/$id' });
  const { id } = useParams({ from: '/project/$id' });
  const router = useRouter();
  const projectId = Number(id);

  const workspaceData = useWorkspaceDataAdapter(workspaceLoaderData, projectId);
  const { durableProject, durableEntities, ephemeralChat, handleDataPart } = workspaceData;

  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/projects/${projectId}/chat` }),
    [projectId],
  );
  const { messages, sendMessage, setMessages, status } = useChat<BrunchUIMessage>({
    transport,
    messages: ephemeralChat.seedMessages,
    dataPartSchemas: brunchDataPartSchemas,
    onData: handleDataPart,
    onFinish: () => {
      void router.invalidate();
    },
  });
  const submitTurnResponseMutation = useSubmitTurnResponseMutation({
    projectId,
    turn: durableProject.lastTurn,
    sendMessage,
  });
  const isLoading = status === 'submitted' || status === 'streaming';

  useChatHydrationBoundary(durableProject.project.id, ephemeralChat.seedMessages, setMessages);

  const viewState = useMemo(
    () => createWorkspaceControllerViewState(durableProject, messages, isLoading),
    [durableProject, isLoading, messages],
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

  const confirmPhaseClosure = useCallback(
    (phase: ProjectStateTurn['phase'], turnId: number) => {
      if (isLoading) {
        return;
      }

      void sendMessage({
        parts: [
          { type: 'text', text: `Confirm ${phase} closure` },
          {
            type: 'data-confirmation',
            data: createRecommendedPhaseClosureConfirmation(phase, turnId),
          },
        ],
      });
    },
    [isLoading, sendMessage],
  );

  const forcePhaseClosure = useCallback(
    (phase: ProjectStateTurn['phase']) => {
      if (isLoading) {
        return;
      }

      void sendMessage({
        parts: [
          { type: 'text', text: `Force ${phase} closure` },
          {
            type: 'data-confirmation',
            data: createForcedPhaseClosureConfirmation(phase),
          },
        ],
      });
    },
    [isLoading, sendMessage],
  );

  return {
    project: viewState.project,
    workflow: viewState.workflow,
    entityState: durableEntities,
    chat: {
      messages,
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
