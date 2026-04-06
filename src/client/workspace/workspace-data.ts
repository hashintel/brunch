import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';

import type { EntitiesData } from '../../shared/api-types.js';
import {
  createWorkspaceDurableEntityState,
  createWorkspaceDurableProjectState,
  createWorkspaceEphemeralChatState,
  type WorkspaceDurableEntityState,
  type WorkspaceDurableProjectState,
  type WorkspaceEphemeralChatState,
} from './workspace-controller-core.js';
import type { WorkspaceLoaderData } from './workspace-loader.js';

export interface WorkspaceDataAdapter {
  durableProject: WorkspaceDurableProjectState;
  durableEntities: WorkspaceDurableEntityState;
  ephemeralChat: WorkspaceEphemeralChatState;
  handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
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
  const durableEntities = useMemo(
    () => createWorkspaceDurableEntityState(workspaceLoaderData.entitySnapshot, data, isLoading),
    [data, isLoading, workspaceLoaderData.entitySnapshot],
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
