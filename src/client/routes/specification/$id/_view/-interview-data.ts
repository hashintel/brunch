import { useMemo } from 'react';

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
}

export function useInterviewDataAdapter(specificationState: SpecificationState): InterviewDataAdapter {
  const durableSpecification = useMemo(
    () => createInterviewDurableSpecificationState(specificationState),
    [specificationState],
  );
  const ephemeralChat = useMemo(
    () => createInterviewEphemeralChatState(specificationState),
    [getSpecificationRecord(specificationState).id],
  );

  return { durableSpecification, ephemeralChat };
}
