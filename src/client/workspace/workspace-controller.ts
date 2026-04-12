import { useChat } from '@ai-sdk/react';
import { useLoaderData, useParams, useRouter } from '@tanstack/react-router';
import { DefaultChatTransport } from 'ai';
import type { ChatStatus } from 'ai';
import { useCallback, useMemo } from 'react';

import { useSubmitTurnResponseMutation } from '@/mutations/workspace-mutations';

import type { ProjectStateTurn } from '../../shared/api-types.js';
import { brunchDataPartSchemas } from '../../shared/chat.js';
import type { BrunchUIMessage } from '../../shared/chat.js';
import {
  createConfirmProposedPhaseClosureCommand,
  createForceCloseActivePhaseCommand,
  getPhaseClosureCommandText,
} from '../../shared/phase-close.js';
import type { DataConfirmation } from '../../shared/phase-close.js';
import { getProjectScopedChatId } from './chat-hydration.js';
import { createWorkspaceControllerViewState } from './workspace-controller-core.js';
import type {
  PendingQuestionViewModel,
  PhaseSummaryViewModel,
  WorkspaceDurableEntityState,
  WorkspaceDurableProjectState,
} from './workspace-controller-core.js';
import { useWorkspaceDataAdapter } from './workspace-data.js';

export interface WorkspaceControllerChatState {
  readonly messages: readonly BrunchUIMessage[];
  readonly status: ChatStatus;
  readonly isLoading: boolean;
  readonly isStreaming: boolean;
  readonly submitText: (text: string) => void;
  readonly confirmPhaseClosure: (phase: ProjectStateTurn['phase'], turnId: number) => void;
  readonly forcePhaseClosure: (phase: ProjectStateTurn['phase']) => void;
}

export type WorkspaceControllerTurnCardState =
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

export interface WorkspaceControllerPromptInputState {
  readonly visible: boolean;
  readonly disabled: boolean;
}

export interface WorkspaceController {
  readonly project: WorkspaceDurableProjectState['project'];
  readonly workflow: WorkspaceDurableProjectState['workflow'];
  readonly entityState: WorkspaceDurableEntityState;
  readonly chat: WorkspaceControllerChatState;
  readonly turnCard: WorkspaceControllerTurnCardState | null;
  readonly phaseSummary: PhaseSummaryViewModel | null;
  readonly promptInput: WorkspaceControllerPromptInputState;
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
  const { messages, sendMessage, status } = useChat<BrunchUIMessage>({
    id: getProjectScopedChatId(durableProject.project.id),
    transport,
    messages: [...ephemeralChat.seedMessages],
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

  const submitPhaseClosureCommand = useCallback(
    (command: DataConfirmation) => {
      if (isLoading) {
        return;
      }

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
    (phase: ProjectStateTurn['phase'], turnId: number) => {
      submitPhaseClosureCommand(createConfirmProposedPhaseClosureCommand(phase, turnId));
    },
    [submitPhaseClosureCommand],
  );

  const forcePhaseClosure = useCallback(
    (phase: ProjectStateTurn['phase']) => {
      submitPhaseClosureCommand(createForceCloseActivePhaseCommand(phase));
    },
    [submitPhaseClosureCommand],
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
