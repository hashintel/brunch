import { useQueryClient, useSuspenseQuery, type QueryClient } from '@tanstack/react-query';
import { useParams } from '@tanstack/react-router';
import { useCallback } from 'react';

import { queryClient } from '@/client/query-client.js';
import type { EntitiesData, WorkflowPhase } from '@/shared/api-types.js';
import type { PrefaceData, ReviewSetData, StructuredQuestion } from '@/shared/chat.js';
import type { SpecificationState } from '@/shared/specification.js';

export const specificationQueryKeys = {
  bundle: (specificationId: string) => ['specification', specificationId, 'bundle'] as const,
  entities: (specificationId: string) => ['specification', specificationId, 'entities'] as const,
  entitiesProjectWide: (specificationId: string) =>
    ['specification', specificationId, 'entities', 'project-wide'] as const,
};

const inflightSpecificationStateRequests = new Map<string, Promise<SpecificationState>>();

export interface StreamedFrontierQuestion {
  readonly id: string;
  readonly question: string;
  readonly why: string | null;
  readonly impact: StructuredQuestion['impact'] | null;
  readonly options: readonly {
    readonly position: number;
    readonly content: string;
    readonly is_recommended: boolean;
  }[];
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
    ...(question.reviewSet ? { reviewSet: question.reviewSet } : {}),
  };
  const parts: unknown[] = [
    ...(question.preface ? [{ type: 'data-preface', data: question.preface }] : []),
    {
      type: 'tool-ask_question',
      toolCallId: question.id,
      state: 'output-available',
      input: structuredQuestion,
      output: {
        ok: true,
        turnId,
        optionCount: question.options.length,
      },
    },
  ];

  return JSON.stringify(parts);
}

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
      question: existingTurn?.question.trim() ? existingTurn.question : promotion.question.question,
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
              id: option.position + 1,
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
      turns: [...current.turns.filter((turn) => turn.id !== promotion.turnId), promotedTurn],
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
