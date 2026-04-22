import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { queryClient } from '@/client/query-client.js';
import type { EntitiesData } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

export const specificationQueryKeys = {
  bundle: (specificationId: string) => ['specification', specificationId, 'bundle'] as const,
  entities: (specificationId: string) => ['specification', specificationId, 'entities'] as const,
};

const inflightSpecificationStateRequests = new Map<string, Promise<SpecificationState>>();

function useSpecificationId() {
  return useParams({ from: '/specification/$id' }).id;
}

async function fetchSpecificationBundle(specificationId: string): Promise<SpecificationState> {
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

async function fetchSpecificationEntities(specificationId: string): Promise<EntitiesData> {
  const response = await fetch(`/api/specifications/${specificationId}/entities?mode=active-path`);
  if (!response.ok) {
    throw new Error('Failed to load project entities');
  }
  return (await response.json()) as EntitiesData;
}

export async function primeSpecificationBundle(specificationId: string) {
  queryClient.setQueryData(
    specificationQueryKeys.bundle(specificationId),
    await fetchSpecificationBundle(specificationId),
  );
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

  const invalidateSpecificationBundle = useCallback(
    async () => client.invalidateQueries({ queryKey: specificationQueryKeys.bundle(specificationId) }),
    [client, specificationId],
  );
  const invalidateEntities = useCallback(
    async () => client.invalidateQueries({ queryKey: specificationQueryKeys.entities(specificationId) }),
    [client, specificationId],
  );

  return {
    invalidateSpecificationBundle,
    invalidateEntities,
  };
}

export function useSpecificationBundleData(): SpecificationState {
  const specificationId = useSpecificationId();

  return useSuspenseQuery({
    queryKey: specificationQueryKeys.bundle(specificationId),
    queryFn: () => fetchSpecificationBundle(specificationId),
  }).data;
}

export function useSpecificationEntities(): EntitiesData {
  const specificationId = useSpecificationId();

  return useSuspenseQuery({
    queryKey: specificationQueryKeys.entities(specificationId),
    queryFn: () => fetchSpecificationEntities(specificationId),
  }).data;
}
