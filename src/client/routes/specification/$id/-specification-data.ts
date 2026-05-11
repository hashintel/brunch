import { useQuery, useQueryClient, useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { queryClient } from '@/client/query-client.js';
import type { EntitiesData, WorkflowPhase } from '@/shared/api-types.js';
import type { PrefaceData, ReviewSetData, StructuredQuestion } from '@/shared/chat.js';
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

export interface StreamedFrontierQuestion {
  readonly toolCallId: string;
  readonly question: string;
  readonly why: string | null;
  readonly impact: StructuredQuestion['impact'] | null;
  readonly options: readonly {
    readonly position: number;
    readonly content: string;
    readonly is_recommended: boolean;
  }[];
  readonly reviewActions?: StructuredQuestion['reviewActions'];
  readonly reviewSet?: ReviewSetData;
  readonly preface?: PrefaceData;
}

export interface StreamedFrontierTurnPromotion {
  readonly turnId: number;
  readonly phase: WorkflowPhase;
  readonly question: StreamedFrontierQuestion;
}

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

function createPatchedAssistantParts(question: StreamedFrontierQuestion, turnId: number): string {
  const structuredQuestion: StructuredQuestion = {
    question: question.question,
    why: question.why ?? '',
    impact: question.impact ?? 'low',
    options: question.options.map((option) => ({
      content: option.content,
      is_recommended: option.is_recommended,
    })),
    ...(question.reviewActions ? { reviewActions: question.reviewActions } : {}),
    ...(question.reviewSet ? { reviewSet: question.reviewSet } : {}),
  };
  const parts: unknown[] = [
    ...(question.preface ? [{ type: 'data-preface', data: question.preface }] : []),
    {
      type: 'tool-ask_question',
      toolCallId: question.toolCallId,
      state: 'output-available',
      input: structuredQuestion,
      output: {
        ok: true,
        turnId,
        optionCount: question.options.length,
      },
    },
    ...(question.reviewSet ? [{ type: 'data-review-set', data: question.reviewSet }] : []),
  ];

  return JSON.stringify(parts);
}

const createClientOnlyTurnOptionId = (position: number) => -(position + 1);

export function promoteStreamedFrontierTurnToBundle(
  client: QueryClient,
  specificationId: string,
  promotion: StreamedFrontierTurnPromotion,
): void {
  client.setQueryData<SpecificationState>(specificationQueryKeys.bundle(specificationId), (current) => {
    if (!current) {
      return current;
    }

    const existingTurn = current.turns.find((turn) => turn.id === promotion.turnId);
    if (
      current.specification.active_turn_id === promotion.turnId &&
      current.landing?.kind === 'frontier-turn' &&
      current.landing.turnId === promotion.turnId &&
      current.landing.phase === promotion.phase &&
      existingTurn?.question === promotion.question.question
    ) {
      return current;
    }

    const promotedTurn: SpecificationState['turns'][number] = {
      id: promotion.turnId,
      specification_id: current.specification.id,
      parent_turn_id: existingTurn?.parent_turn_id ?? current.specification.active_turn_id,
      phase: promotion.phase,
      turn_kind: existingTurn?.turn_kind ?? 'question',
      question: existingTurn?.question?.trim() ? existingTurn.question : promotion.question.question,
      why: existingTurn?.why ?? promotion.question.why,
      impact: existingTurn?.impact ?? promotion.question.impact,
      answer: existingTurn?.answer ?? null,
      is_resolution: existingTurn?.is_resolution ?? false,
      user_parts: existingTurn?.user_parts ?? null,
      assistant_parts:
        existingTurn?.assistant_parts ?? createPatchedAssistantParts(promotion.question, promotion.turnId),
      created_at: existingTurn?.created_at ?? new Date().toISOString(),
      options:
        existingTurn?.options && existingTurn.options.length > 0
          ? existingTurn.options
          : promotion.question.options.map((option) => ({
              id: createClientOnlyTurnOptionId(option.position),
              position: option.position,
              content: option.content,
              is_recommended: option.is_recommended,
              is_selected: false,
            })),
      captured_items: existingTurn?.captured_items ?? [],
    };

    return {
      ...current,
      specification: {
        ...current.specification,
        active_turn_id: promotion.turnId,
      },
      workflow: {
        ...current.workflow,
        phases: {
          ...current.workflow.phases,
          [promotion.phase]: {
            ...current.workflow.phases[promotion.phase],
            status: 'in_progress',
            turnId: promotion.turnId,
          },
        },
      },
      landing: {
        kind: 'frontier-turn',
        phase: promotion.phase,
        turnId: promotion.turnId,
      },
      turns: existingTurn
        ? current.turns.map((turn) => (turn.id === promotion.turnId ? promotedTurn : turn))
        : [...current.turns, promotedTurn],
    };
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

export function usePromoteStreamedFrontierTurnToBundle() {
  const specificationId = useSpecificationId();
  const client = useQueryClient();

  return useCallback(
    (promotion: StreamedFrontierTurnPromotion) =>
      promoteStreamedFrontierTurnToBundle(client, specificationId, promotion),
    [client, specificationId],
  );
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
function anyNeedAwaitingClassifier(needs: ReconciliationNeedRecord[] | undefined): boolean {
  if (!needs) return false;
  return needs.some((need) => need.agent_status === 'queued' || need.agent_status === 'classifying');
}

export function useSpecificationOpenReconciliationNeeds(): ReconciliationNeedRecord[] {
  const specificationId = useSpecificationId();

  const { data } = useQuery({
    queryKey: specificationQueryKeys.reconciliationNeeds(specificationId),
    queryFn: () => fetchOpenReconciliationNeeds(specificationId),
    initialData: [],
    initialDataUpdatedAt: 0,
    refetchInterval: (query) =>
      anyNeedAwaitingClassifier(query.state.data as ReconciliationNeedRecord[] | undefined) ? 1000 : false,
  });
  return data;
}

export async function invalidateOpenReconciliationNeeds(specificationId: number): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: specificationQueryKeys.reconciliationNeeds(String(specificationId)),
  });
}
