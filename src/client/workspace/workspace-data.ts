import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { EntitiesData, ProjectState, ProjectStateTurn } from '../../shared/api-types.js';
import {
  assistantPartsSchema,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type BrunchUserPart,
  userPartsSchema,
} from '../../shared/chat.js';
import type { WorkspaceLoaderData } from './workspace-loader.js';

export interface WorkspaceDurableProjectState {
  project: ProjectState['project'];
  turns: ProjectStateTurn[];
  lastTurn: ProjectStateTurn | undefined;
  showTurnCard: boolean;
  lastTurnHasSelection: boolean;
}

export interface WorkspaceDurableEntityState {
  decisions: EntitiesData['decisions'];
  assumptions: EntitiesData['assumptions'];
  isLoading: boolean;
}

export interface WorkspaceEphemeralChatState {
  seedMessages: BrunchUIMessage[];
}

export interface WorkspaceDataAdapter {
  durableProject: WorkspaceDurableProjectState;
  durableEntities: WorkspaceDurableEntityState;
  ephemeralChat: WorkspaceEphemeralChatState;
  handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
}

function parseAssistantParts(json: string | null): BrunchAssistantPart[] {
  if (!json) return [];
  try {
    return assistantPartsSchema.parse(JSON.parse(json)) as BrunchAssistantPart[];
  } catch {
    return [];
  }
}

function parseUserParts(json: string | null): BrunchUserPart[] {
  if (!json) return [];
  try {
    return userPartsSchema.parse(JSON.parse(json));
  } catch {
    return [];
  }
}

function hydrateMessages(turns: ProjectStateTurn[]): BrunchUIMessage[] {
  const messages: BrunchUIMessage[] = [];

  for (const turn of turns) {
    const hydratedUserParts = parseUserParts(turn.user_parts);
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

    const assistantParts = parseAssistantParts(turn.assistant_parts);
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

export function createWorkspaceDurableProjectState(projectState: ProjectState): WorkspaceDurableProjectState {
  const lastTurn = projectState.turns[projectState.turns.length - 1] as ProjectStateTurn | undefined;

  return {
    project: projectState.project,
    turns: projectState.turns,
    lastTurn,
    showTurnCard: Boolean(lastTurn?.options?.length),
    lastTurnHasSelection: lastTurn?.options?.some((option) => option.is_selected) ?? false,
  };
}

export function createWorkspaceEphemeralChatState(projectState: ProjectState): WorkspaceEphemeralChatState {
  return {
    seedMessages: hydrateMessages(projectState.turns),
  };
}

async function fetchWorkspaceEntities(projectId: number): Promise<EntitiesData> {
  const response = await fetch(`/api/projects/${projectId}/entities`);
  if (!response.ok) {
    throw new Error('Failed to fetch entities');
  }

  return response.json();
}

function getWorkspaceEntitiesQueryKey(projectId: number) {
  return ['entities', projectId] as const;
}

export function useWorkspaceDataAdapter(
  workspaceLoaderData: WorkspaceLoaderData,
  projectId: number,
): WorkspaceDataAdapter {
  const queryClient = useQueryClient();
  const entityQueryKey = useMemo(() => getWorkspaceEntitiesQueryKey(projectId), [projectId]);

  useEffect(() => {
    queryClient.setQueryData(entityQueryKey, workspaceLoaderData.entitySnapshot);
  }, [entityQueryKey, queryClient, workspaceLoaderData.entitySnapshot]);

  const { data, isLoading } = useQuery<EntitiesData>({
    queryKey: entityQueryKey,
    queryFn: () => fetchWorkspaceEntities(projectId),
    initialData: workspaceLoaderData.entitySnapshot,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const durableProject = useMemo(
    () => createWorkspaceDurableProjectState(workspaceLoaderData.projectState),
    [workspaceLoaderData.projectState],
  );
  const durableEntities = useMemo<WorkspaceDurableEntityState>(
    () => ({
      decisions: data?.decisions ?? workspaceLoaderData.entitySnapshot.decisions,
      assumptions: data?.assumptions ?? workspaceLoaderData.entitySnapshot.assumptions,
      isLoading,
    }),
    [
      data,
      isLoading,
      workspaceLoaderData.entitySnapshot.assumptions,
      workspaceLoaderData.entitySnapshot.decisions,
    ],
  );
  const ephemeralChat = useMemo(
    () => createWorkspaceEphemeralChatState(workspaceLoaderData.projectState),
    [workspaceLoaderData.projectState.project.id],
  );
  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type === 'data-observer-result') {
        void queryClient.invalidateQueries({ queryKey: entityQueryKey });
      }
    },
    [entityQueryKey, queryClient],
  );

  return {
    durableProject,
    durableEntities,
    ephemeralChat,
    handleDataPart,
  };
}
