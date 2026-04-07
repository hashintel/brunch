import { useChat } from '@ai-sdk/react';
import { useLoaderData, useParams, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport, type ChatStatus } from 'ai';
import { useCallback, useMemo } from 'react';

import { useSelectTurnOptionMutation } from '@/mutations/workspace-mutations';

import type { ProjectStateTurn } from '../../shared/api-types.js';
import { brunchDataPartSchemas, type BrunchUIMessage } from '../../shared/chat.js';
import { useChatHydrationBoundary } from './chat-hydration.js';
import {
  createWorkspaceControllerViewState,
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
}

export interface WorkspaceControllerTurnCardState {
  turn: ProjectStateTurn;
  disabled: boolean;
  errorMessage: string | null;
  selectOption: (position: number) => Promise<void>;
}

export interface WorkspaceControllerPromptInputState {
  visible: boolean;
  disabled: boolean;
}

export interface WorkspaceController {
  project: WorkspaceDurableProjectState['project'];
  entityState: WorkspaceDurableEntityState;
  chat: WorkspaceControllerChatState;
  turnCard: WorkspaceControllerTurnCardState | null;
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
  const selectOptionMutation = useSelectTurnOptionMutation({
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

  return {
    project: viewState.project,
    entityState: durableEntities,
    chat: {
      messages,
      status,
      isLoading,
      isStreaming: status === 'streaming',
      submitText,
    },
    turnCard: viewState.turnCard
      ? {
          turn: viewState.turnCard.turn,
          disabled: selectOptionMutation.isPending || isLoading,
          errorMessage: selectOptionMutation.errorMessage,
          selectOption: selectOptionMutation.selectOption,
        }
      : null,
    promptInput: {
      visible: viewState.promptInput.visible,
      disabled: isLoading || selectOptionMutation.isPending,
    },
  };
}
