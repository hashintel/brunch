import { useCallback, useMemo, useState } from 'react';

import type { EntitiesData, Project, ProjectState } from '@/shared/api-types.js';

import {
  createInterviewDurableEntityState,
  createInterviewDurableProjectState,
  createInterviewEphemeralChatState,
} from './-interview-controller-core.js';
import type {
  InterviewDurableEntityState,
  InterviewDurableProjectState,
  InterviewEphemeralChatState,
} from './-interview-controller-core.js';

export interface InterviewDataAdapter {
  readonly durableProject: InterviewDurableProjectState;
  readonly durableEntities: InterviewDurableEntityState;
  readonly ephemeralChat: InterviewEphemeralChatState;
  readonly handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
}

interface InterviewEntityRefreshState {
  readonly loaderSnapshot: EntitiesData;
  readonly data: EntitiesData | undefined;
  readonly isLoading: boolean;
}

async function fetchInterviewEntities(projectId: Project['id']): Promise<EntitiesData> {
  const response = await fetch(`/api/projects/${projectId}/entities`);
  if (!response.ok) {
    throw new Error('Failed to fetch entities');
  }

  return (await response.json()) as EntitiesData;
}

function getActiveInterviewEntityRefreshState(
  loaderSnapshot: EntitiesData,
  entityRefreshState: InterviewEntityRefreshState,
): InterviewEntityRefreshState {
  if (entityRefreshState.loaderSnapshot === loaderSnapshot) {
    return entityRefreshState;
  }

  return {
    loaderSnapshot,
    data: undefined,
    isLoading: false,
  };
}

export function useInterviewDataAdapter(
  projectState: ProjectState,
  entitySnapshot: EntitiesData,
  projectId: Project['id'],
): InterviewDataAdapter {
  const [entityRefreshState, setEntityRefreshState] = useState<InterviewEntityRefreshState>({
    loaderSnapshot: entitySnapshot,
    data: undefined,
    isLoading: false,
  });
  const activeEntityRefreshState = getActiveInterviewEntityRefreshState(entitySnapshot, entityRefreshState);

  const durableProject = useMemo(() => createInterviewDurableProjectState(projectState), [projectState]);
  const durableEntities = useMemo(
    () =>
      createInterviewDurableEntityState(
        entitySnapshot,
        activeEntityRefreshState.data,
        activeEntityRefreshState.isLoading,
      ),
    [activeEntityRefreshState.data, activeEntityRefreshState.isLoading, entitySnapshot],
  );
  const ephemeralChat = useMemo(
    () => createInterviewEphemeralChatState(projectState),
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
          const refreshedEntities = await fetchInterviewEntities(projectId);
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
