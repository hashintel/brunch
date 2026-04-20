import { useCallback, useMemo } from 'react';

import type { SpecificationState } from '@/shared/specification.js';

import {
  createInterviewDurableSpecificationState,
  createInterviewEphemeralChatState,
} from './-interview-controller-core.js';
import type {
  InterviewDurableSpecificationState,
  InterviewEphemeralChatState,
} from './-interview-controller-core.js';

export interface InterviewDataAdapter {
  readonly durableSpecification: InterviewDurableSpecificationState;
  readonly ephemeralChat: InterviewEphemeralChatState;
  readonly handleDataPart: (dataPart: { type: string; data?: unknown }) => void;
}

export function useInterviewDataAdapter(
  specificationState: SpecificationState,
  invalidateRouter: () => Promise<void>,
): InterviewDataAdapter {
  const durableSpecification = useMemo(
    () => createInterviewDurableSpecificationState(specificationState),
    [specificationState],
  );
  const ephemeralChat = useMemo(
    () => createInterviewEphemeralChatState(specificationState),
    [specificationState.project.id],
  );
  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type === 'data-observer-result') {
        void invalidateRouter();
      }
    },
    [invalidateRouter],
  );

  return { durableSpecification, ephemeralChat, handleDataPart };
}
