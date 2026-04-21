import { useCallback, useMemo } from 'react';

import { getSpecificationRecord, type SpecificationState } from '@/shared/specification.js';

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
  invalidateEntities: () => Promise<void>,
): InterviewDataAdapter {
  const durableSpecification = useMemo(
    () => createInterviewDurableSpecificationState(specificationState),
    [specificationState],
  );
  const ephemeralChat = useMemo(
    () => createInterviewEphemeralChatState(specificationState),
    [getSpecificationRecord(specificationState).id],
  );
  const handleDataPart = useCallback(
    (dataPart: { type: string; data?: unknown }) => {
      if (dataPart.type === 'data-observer-result') {
        void invalidateEntities();
      }
    },
    [invalidateEntities],
  );

  return { durableSpecification, ephemeralChat, handleDataPart };
}
