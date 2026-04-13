import { useCallback, useMemo, useState } from 'react';

import type { EntitiesData, Project, ProjectState } from '@/shared/api-types.js';

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

async function fetchWorkspaceEntities(projectId: Project['id']): Promise<EntitiesData> {
  const response = await fetch(`/api/projects/${projectId}/entities`);
  if (!response.ok) {
    throw new Error('Failed to fetch entities');
  }

  return (await response.json()) as EntitiesData;
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
  projectState: ProjectState,
  entitySnapshot: EntitiesData,
  projectId: Project['id'],
): WorkspaceDataAdapter {
  const [entityRefreshState, setEntityRefreshState] = useState<WorkspaceEntityRefreshState>({
    loaderSnapshot: entitySnapshot,
    data: undefined,
    isLoading: false,
  });
  const activeEntityRefreshState = getActiveWorkspaceEntityRefreshState(entitySnapshot, entityRefreshState);

  const durableProject = useMemo(() => createWorkspaceDurableProjectState(projectState), [projectState]);
  const durableEntities = useMemo(
    () =>
      createWorkspaceDurableEntityState(
        entitySnapshot,
        activeEntityRefreshState.data,
        activeEntityRefreshState.isLoading,
      ),
    [activeEntityRefreshState.data, activeEntityRefreshState.isLoading, entitySnapshot],
  );
  const ephemeralChat = useMemo(
    () => createWorkspaceEphemeralChatState(projectState),
    [projectState.project.id],
  );
  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type !== 'data-observer-result') {
        return;
      }

      void (async () => {
        setEntityRefreshState((currentState) =>
          currentState.loaderSnapshot === entitySnapshot
            ? { ...currentState, isLoading: true }
            : {
                loaderSnapshot: entitySnapshot,
                data: undefined,
                isLoading: true,
              },
        );

        try {
          const refreshedEntities = await fetchWorkspaceEntities(projectId);
          setEntityRefreshState((currentState) =>
            currentState.loaderSnapshot === entitySnapshot
              ? {
                  loaderSnapshot: entitySnapshot,
                  data: refreshedEntities,
                  isLoading: false,
                }
              : currentState,
          );
        } catch {
          setEntityRefreshState((currentState) =>
            currentState.loaderSnapshot === entitySnapshot
              ? { ...currentState, isLoading: false }
              : currentState,
          );
        }
      })();
    },
    [projectId, entitySnapshot],
  );

  return {
    durableProject,
    durableEntities,
    ephemeralChat,
    handleDataPart,
  };
}
