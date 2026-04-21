import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { queryClient } from '@/client/query-client.js';
import type { EntitiesData, SpecificationLanding } from '@/shared/api-types.js';
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

export const specificationQueryKeys = {
  core: (specificationId: string) => ['specification', specificationId, 'core'] as const,
  turns: (specificationId: string) => ['specification', specificationId, 'turns'] as const,
  entities: (specificationId: string) => ['specification', specificationId, 'entities'] as const,
};

const inflightSpecificationStateRequests = new Map<string, Promise<SpecificationState>>();

function useSpecificationId() {
  return useParams({ from: '/specification/$id' }).id;
}

function projectSpecificationCoreData(specificationState: SpecificationState): SpecificationCoreData {
  return {
    specification: getSpecificationRecord(specificationState),
    workflow: specificationState.workflow,
    landing: specificationState.landing ?? null,
  };
}

async function fetchSpecificationWorkspaceState(specificationId: string): Promise<SpecificationState> {
  const inflightRequest = inflightSpecificationStateRequests.get(specificationId);
  if (inflightRequest) {
    return inflightRequest;
  }

  const request = (async () => {
    const response = await fetch(`/api/specifications/${specificationId}`);
    if (!response.ok) {
      throw new Error('Failed to load specification');
    }
    return (await response.json()) as SpecificationState;
  })().finally(() => {
    inflightSpecificationStateRequests.delete(specificationId);
  });

  inflightSpecificationStateRequests.set(specificationId, request);
  return request;
}

async function fetchSpecificationCoreData(specificationId: string): Promise<SpecificationCoreData> {
  return projectSpecificationCoreData(await fetchSpecificationWorkspaceState(specificationId));
}

async function fetchSpecificationTurns(specificationId: string): Promise<readonly SpecificationTurn[]> {
  return (await fetchSpecificationWorkspaceState(specificationId)).turns;
}

async function fetchSpecificationEntities(specificationId: string): Promise<EntitiesData> {
  const response = await fetch(`/api/specifications/${specificationId}/entities?mode=active-path`);
  if (!response.ok) {
    throw new Error('Failed to load project entities');
  }
  return (await response.json()) as EntitiesData;
}

export async function primeSpecificationCoreAndTurns(specificationId: string) {
  const specificationState = await fetchSpecificationWorkspaceState(specificationId);
  queryClient.setQueryData(
    specificationQueryKeys.core(specificationId),
    projectSpecificationCoreData(specificationState),
  );
  queryClient.setQueryData(specificationQueryKeys.turns(specificationId), specificationState.turns);
}

export async function primeSpecificationEntities(specificationId: string) {
  queryClient.setQueryData(
    specificationQueryKeys.entities(specificationId),
    await fetchSpecificationEntities(specificationId),
  );
}

export function useInvalidateSpecificationQueryDomains() {
  const specificationId = useSpecificationId();
  const client = useQueryClient();

  const invalidateCore = useCallback(
    async () => client.invalidateQueries({ queryKey: specificationQueryKeys.core(specificationId) }),
    [client, specificationId],
  );
  const invalidateTurns = useCallback(
    async () => client.invalidateQueries({ queryKey: specificationQueryKeys.turns(specificationId) }),
    [client, specificationId],
  );
  const invalidateEntities = useCallback(
    async () => client.invalidateQueries({ queryKey: specificationQueryKeys.entities(specificationId) }),
    [client, specificationId],
  );
  const invalidateCoreAndTurns = useCallback(async () => {
    await Promise.all([invalidateCore(), invalidateTurns()]);
  }, [invalidateCore, invalidateTurns]);

  return {
    invalidateCore,
    invalidateTurns,
    invalidateEntities,
    invalidateCoreAndTurns,
  };
}

export function useSpecificationCoreData(): SpecificationCoreData {
  const specificationId = useSpecificationId();

  return useSuspenseQuery({
    queryKey: specificationQueryKeys.core(specificationId),
    queryFn: () => fetchSpecificationCoreData(specificationId),
  }).data;
}

export function useSpecificationTurns(): readonly SpecificationTurn[] {
  const specificationId = useSpecificationId();

  return useSuspenseQuery({
    queryKey: specificationQueryKeys.turns(specificationId),
    queryFn: () => fetchSpecificationTurns(specificationId),
  }).data;
}

export function useSpecificationEntities(): EntitiesData {
  const specificationId = useSpecificationId();

  return useSuspenseQuery({
    queryKey: specificationQueryKeys.entities(specificationId),
    queryFn: () => fetchSpecificationEntities(specificationId),
  }).data;
}
