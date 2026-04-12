import { useCallback, useMemo, useState } from 'react';

import type { EntitiesData } from '../../shared/api-types.js';
import {
  createWorkspaceDurableEntityState,
  createWorkspaceDurableProjectState,
  createWorkspaceEphemeralChatState,
} from './workspace-controller-core.js';
import type {
  WorkspaceDurableEntityState,
  WorkspaceDurableProjectState,
  WorkspaceEphemeralChatState,
} from './workspace-controller-core.js';
import type { WorkspaceLoaderData } from './workspace-loader.js';

export interface WorkspaceDataAdapter {
  readonly durableProject: WorkspaceDurableProjectState;
  readonly durableEntities: WorkspaceDurableEntityState;
  readonly ephemeralChat: WorkspaceEphemeralChatState;
  readonly handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
}

interface WorkspaceEntityRefreshState {
  readonly loaderSnapshot: EntitiesData;
  readonly data: EntitiesData | undefined;
  readonly isLoading: boolean;
}

async function fetchWorkspaceEntities(projectId: number): Promise<EntitiesData> {
  const response = await fetch(`/api/projects/${projectId}/entities`);
  if (!response.ok) {
    throw new Error('Failed to fetch entities');
  }

  return response.json();
}

function getActiveWorkspaceEntityRefreshState(
  loaderSnapshot: EntitiesData,
  entityRefreshState: WorkspaceEntityRefreshState,
): WorkspaceEntityRefreshState {
  if (entityRefreshState.loaderSnapshot === loaderSnapshot) {
    return entityRefreshState;
  }

  return {
    loaderSnapshot,
    data: undefined,
    isLoading: false,
  };
}

export function useWorkspaceDataAdapter(
  workspaceLoaderData: WorkspaceLoaderData,
  projectId: number,
): WorkspaceDataAdapter {
  const [entityRefreshState, setEntityRefreshState] = useState<WorkspaceEntityRefreshState>({
    loaderSnapshot: workspaceLoaderData.entitySnapshot,
    data: undefined,
    isLoading: false,
  });
  const activeEntityRefreshState = getActiveWorkspaceEntityRefreshState(
    workspaceLoaderData.entitySnapshot,
    entityRefreshState,
  );

  const durableProject = useMemo(
    () => createWorkspaceDurableProjectState(workspaceLoaderData.projectState),
    [workspaceLoaderData.projectState],
  );
  const durableEntities = useMemo(
    () =>
      createWorkspaceDurableEntityState(
        workspaceLoaderData.entitySnapshot,
        activeEntityRefreshState.data,
        activeEntityRefreshState.isLoading,
      ),
    [activeEntityRefreshState.data, activeEntityRefreshState.isLoading, workspaceLoaderData.entitySnapshot],
  );
  const ephemeralChat = useMemo(
    () => createWorkspaceEphemeralChatState(workspaceLoaderData.projectState),
    [workspaceLoaderData.projectState.project.id],
  );
  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type !== 'data-observer-result') {
        return;
      }

      void (async () => {
        setEntityRefreshState((currentState) =>
          currentState.loaderSnapshot === workspaceLoaderData.entitySnapshot
            ? { ...currentState, isLoading: true }
            : {
                loaderSnapshot: workspaceLoaderData.entitySnapshot,
                data: undefined,
                isLoading: true,
              },
        );

        try {
          const refreshedEntities = await fetchWorkspaceEntities(projectId);
          setEntityRefreshState((currentState) =>
            currentState.loaderSnapshot === workspaceLoaderData.entitySnapshot
              ? {
                  loaderSnapshot: workspaceLoaderData.entitySnapshot,
                  data: refreshedEntities,
                  isLoading: false,
                }
              : currentState,
          );
        } catch {
          setEntityRefreshState((currentState) =>
            currentState.loaderSnapshot === workspaceLoaderData.entitySnapshot
              ? { ...currentState, isLoading: false }
              : currentState,
          );
        }
      })();
    },
    [projectId, workspaceLoaderData.entitySnapshot],
  );

  return {
    durableProject,
    durableEntities,
    ephemeralChat,
    handleDataPart,
  };
}
