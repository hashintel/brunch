import { useLoaderData } from '@tanstack/react-router';
import { useMemo } from 'react';

import type { SpecificationLanding } from '@/shared/api-types.js';
import {
  getSpecificationRecord,
  type SpecificationState,
  type SpecificationTurn,
} from '@/shared/specification.js';

export interface SpecificationCoreData {
  readonly specification: SpecificationState['specification'];
  readonly workflow: SpecificationState['workflow'];
  readonly landing: SpecificationLanding | null;
}

export function useSpecificationCoreData(): SpecificationCoreData {
  const specificationState = useLoaderData({ from: '/specification/$id' });

  return useMemo(
    () => ({
      specification: getSpecificationRecord(specificationState),
      workflow: specificationState.workflow,
      landing: specificationState.landing ?? null,
    }),
    [specificationState],
  );
}

export function useSpecificationTurns(): readonly SpecificationTurn[] {
  return useLoaderData({ from: '/specification/$id' }).turns;
}

export function useSpecificationEntities() {
  return useLoaderData({ from: '/specification/$id/_view' });
}
