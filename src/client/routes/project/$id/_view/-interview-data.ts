import { useCallback, useMemo } from 'react';

import type { ProjectState } from '@/shared/api-types.js';

import {
  createInterviewDurableProjectState,
  createInterviewEphemeralChatState,
} from './-interview-controller-core.js';
import type {
  InterviewDurableProjectState,
  InterviewEphemeralChatState,
} from './-interview-controller-core.js';

export interface InterviewDataAdapter {
  readonly durableProject: InterviewDurableProjectState;
  readonly ephemeralChat: InterviewEphemeralChatState;
  readonly handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
}

export function useInterviewDataAdapter(
  projectState: ProjectState,
  invalidateRouter: () => Promise<void>,
): InterviewDataAdapter {
  const durableProject = useMemo(() => createInterviewDurableProjectState(projectState), [projectState]);
  const ephemeralChat = useMemo(
    () => createInterviewEphemeralChatState(projectState),
    [projectState.project.id],
  );
  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type === 'data-observer-result') {
        void invalidateRouter();
      }
    },
    [invalidateRouter],
  );

  return { durableProject, ephemeralChat, handleDataPart };
}
