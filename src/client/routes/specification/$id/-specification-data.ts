import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { queryClient } from '@/client/query-client.js';
import type { EntitiesData } from '@/shared/api-types.js';
import type { ReconciliationNeedRecord } from '@/shared/reconciliation-need.js';
import type { SpecificationState } from '@/shared/specification.js';

export const specificationQueryKeys = {
  bundle: (specificationId: string) => ['specification', specificationId, 'bundle'] as const,
  entities: (specificationId: string) => ['specification', specificationId, 'entities'] as const,
  entitiesProjectWide: (specificationId: string) =>
    ['specification', specificationId, 'entities', 'project-wide'] as const,
  reconciliationNeeds: (specificationId: string) =>
    ['specification', specificationId, 'reconciliation-needs'] as const,
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

async function fetchSpecificationEntitiesProjectWide(specificationId: string): Promise<EntitiesData> {
  const response = await fetch(`/api/specifications/${specificationId}/entities?mode=project-wide`);
  if (!response.ok) {
    throw new Error('Failed to load project-wide entities');
  }
  return (await response.json()) as EntitiesData;
}

export async function primeSpecificationBundle(specificationId: string): Promise<SpecificationState> {
  return await queryClient.ensureQueryData({
    queryKey: specificationQueryKeys.bundle(specificationId),
    queryFn: () => fetchSpecificationBundle(specificationId),
  });
}

export async function primeSpecificationEntities(specificationId: string): Promise<EntitiesData> {
  return await queryClient.ensureQueryData({
    queryKey: specificationQueryKeys.entities(specificationId),
    queryFn: () => fetchSpecificationEntities(specificationId),
  });
}

export async function primeSpecificationEntitiesProjectWide(specificationId: string): Promise<EntitiesData> {
  return await queryClient.ensureQueryData({
    queryKey: specificationQueryKeys.entitiesProjectWide(specificationId),
    queryFn: () => fetchSpecificationEntitiesProjectWide(specificationId),
  });
}

export function useInvalidateSpecificationQueryDomains() {
  const specificationId = useSpecificationId();
  const client = useQueryClient();

  const invalidateSpecificationBundle = useCallback(
    async () => client.invalidateQueries({ queryKey: specificationQueryKeys.bundle(specificationId) }),
    [client, specificationId],
  );
  const invalidateEntities = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: specificationQueryKeys.entities(specificationId) }),
      client.invalidateQueries({
        queryKey: specificationQueryKeys.entitiesProjectWide(specificationId),
      }),
    ]);
  }, [client, specificationId]);

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

export function useSpecificationEntitiesProjectWide(): EntitiesData {
  const specificationId = useSpecificationId();

  return useSuspenseQuery({
    queryKey: specificationQueryKeys.entitiesProjectWide(specificationId),
    queryFn: () => fetchSpecificationEntitiesProjectWide(specificationId),
  }).data;
}

async function fetchOpenReconciliationNeeds(specificationId: string): Promise<ReconciliationNeedRecord[]> {
  const response = await fetch(`/api/specifications/${specificationId}/reconciliation-needs`);
  if (!response.ok) {
    throw new Error('Failed to load reconciliation needs');
  }
  const body = (await response.json()) as { openNeeds: ReconciliationNeedRecord[] };
  return body.openNeeds;
}

/**
 * Open reconciliation_need rows for the current specification (V3.0 card 2).
 * Returns [] until the producer (card 1) opens any. Non-suspending — the
 * patch-list overlay renders without blocking on this fetch.
 */
export function useSpecificationOpenReconciliationNeeds(): ReconciliationNeedRecord[] {
  const specificationId = useSpecificationId();

  const { data } = useQuery({
    queryKey: specificationQueryKeys.reconciliationNeeds(specificationId),
    queryFn: () => fetchOpenReconciliationNeeds(specificationId),
    initialData: [],
  });
  return data;
}

export async function invalidateOpenReconciliationNeeds(specificationId: number): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: specificationQueryKeys.reconciliationNeeds(String(specificationId)),
  });
}
