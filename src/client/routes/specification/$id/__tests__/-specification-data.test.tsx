// @vitest-environment happy-dom

import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryClient } from '@/client/query-client.js';
import type { EntitiesData } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router');
  return {
    ...actual,
    useParams: () => ({ id: '42' }),
  };
});

import {
  primeSpecificationBundle,
  promoteStreamedFrontierTurnToBundle,
  specificationQueryKeys,
  useInvalidateSpecificationQueryDomains,
} from '../-specification-data.js';

const fetchMock = vi.fn<typeof fetch>();

const minimalSpecificationState: SpecificationState = {
  specification: {
    id: 42,
    name: 'Test specification',
    mode: 'greenfield',
    active_turn_id: null,
    created_at: '',
    updated_at: '',
  },
  workflow: {
    phases: {
      grounding: {
        status: 'in_progress',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      design: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      requirements: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
      criteria: {
        status: 'unstarted',
        closeability: false,
        readiness: 'low',
        closureBasis: null,
        proposalPending: false,
        turnId: null,
        summary: null,
      },
    },
  },
  landing: {
    phase: 'grounding',
    kind: 'kickoff',
    mode: 'start',
  },
  turns: [],
};

const minimalEntitiesData: EntitiesData = {
  goals: [],
  terms: [],
  contexts: [],
  constraints: [],
  requirements: [],
  criteria: [],
  decisions: [],
  assumptions: [],
  relationships: [],
};

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function jsonResponse(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('specification data ownership', () => {
  beforeEach(() => {
    queryClient.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url === '/api/specifications/42') {
        return jsonResponse(minimalSpecificationState);
      }
      if (url === '/api/specifications/42/entities?mode=active-path') {
        return jsonResponse(minimalEntitiesData);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses one authoritative bundle key for workflow, landing, and turns and reuses that cache for priming', async () => {
    const firstPrime = await primeSpecificationBundle('42');
    const secondPrime = await primeSpecificationBundle('42');

    expect(Object.keys(specificationQueryKeys)).toEqual(['bundle', 'entities', 'entitiesProjectWide']);
    expect(firstPrime).toEqual(minimalSpecificationState);
    expect(secondPrime).toEqual(minimalSpecificationState);
    expect(queryClient.getQueryData(specificationQueryKeys.bundle('42'))).toEqual(minimalSpecificationState);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/specifications/42');
  });

  it('invalidates only the bundle and entities ownership domains', async () => {
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined as Awaited<ReturnType<typeof queryClient.invalidateQueries>>);
    const { result } = renderHook(() => useInvalidateSpecificationQueryDomains(), { wrapper });

    await act(async () => {
      await result.current.invalidateSpecificationBundle();
      await result.current.invalidateEntities();
    });

    expect(invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: specificationQueryKeys.bundle('42'),
    });
    expect(invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: specificationQueryKeys.entities('42'),
    });
  });

  it('promotes an acknowledged streamed question into only the bundle query cache', () => {
    queryClient.setQueryData(specificationQueryKeys.bundle('42'), minimalSpecificationState);
    queryClient.setQueryData(specificationQueryKeys.entities('42'), minimalEntitiesData);

    promoteStreamedFrontierTurnToBundle(queryClient, '42', {
      turnId: 7,
      phase: 'grounding',
      question: {
        toolCallId: 'tool-1',
        question: 'Which platform should we target next?',
        why: 'Platform shapes the first build.',
        impact: 'high',
        options: [
          { position: 0, content: 'Web', is_recommended: true },
          { position: 1, content: 'Desktop', is_recommended: false },
        ],
      },
    });

    const patchedBundle = queryClient.getQueryData<SpecificationState>(specificationQueryKeys.bundle('42'));

    expect(queryClient.getQueryData(specificationQueryKeys.entities('42'))).toEqual(minimalEntitiesData);
    expect(patchedBundle?.specification.active_turn_id).toBe(7);
    expect(patchedBundle?.landing).toEqual({ kind: 'frontier-turn', phase: 'grounding', turnId: 7 });
    expect(patchedBundle?.workflow.phases.grounding.turnId).toBe(7);
    expect(patchedBundle?.turns[0]?.assistant_parts).toContain('"toolCallId":"tool-1"');
    expect(patchedBundle?.turns[0]?.assistant_parts).not.toContain('persisted-turn-7');
    expect(patchedBundle?.turns).toContainEqual(
      expect.objectContaining({
        id: 7,
        parent_turn_id: null,
        phase: 'grounding',
        question: 'Which platform should we target next?',
        why: 'Platform shapes the first build.',
        impact: 'high',
        answer: null,
        options: [
          { id: -1, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: -2, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );
  });

  it('patches an existing promoted turn in place without reordering the transcript', () => {
    const existingState: SpecificationState = {
      ...minimalSpecificationState,
      specification: {
        ...minimalSpecificationState.specification,
        active_turn_id: 5,
      },
      turns: [
        {
          id: 3,
          specification_id: 42,
          parent_turn_id: null,
          phase: 'grounding',
          turn_kind: 'question',
          question: 'Earlier question?',
          why: null,
          impact: 'low',
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-30 09:00:00',
          options: [],
          captured_items: [],
        },
        {
          id: 7,
          specification_id: 42,
          parent_turn_id: 5,
          phase: 'grounding',
          turn_kind: 'question',
          question: '',
          why: null,
          impact: null,
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-30 10:00:00',
          options: [],
          captured_items: [],
        },
        {
          id: 9,
          specification_id: 42,
          parent_turn_id: 7,
          phase: 'grounding',
          turn_kind: 'question',
          question: 'Later question?',
          why: null,
          impact: 'medium',
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-30 11:00:00',
          options: [],
          captured_items: [],
        },
      ],
    };
    queryClient.setQueryData(specificationQueryKeys.bundle('42'), existingState);

    promoteStreamedFrontierTurnToBundle(queryClient, '42', {
      turnId: 7,
      phase: 'grounding',
      question: {
        toolCallId: 'tool-1',
        question: 'Which platform should we target next?',
        why: 'Platform shapes the first build.',
        impact: 'high',
        options: [{ position: 0, content: 'Web', is_recommended: true }],
      },
    });

    const patchedBundle = queryClient.getQueryData<SpecificationState>(specificationQueryKeys.bundle('42'));

    expect(patchedBundle?.turns.map((turn) => turn.id)).toEqual([3, 7, 9]);
    expect(patchedBundle?.turns[1]).toEqual(
      expect.objectContaining({
        id: 7,
        parent_turn_id: 5,
        question: 'Which platform should we target next?',
      }),
    );
  });

  it('uses streamed question text when an existing cached turn has a null question', () => {
    const stateWithNullQuestion = {
      ...minimalSpecificationState,
      turns: [
        {
          id: 7,
          specification_id: 42,
          parent_turn_id: null,
          phase: 'grounding',
          turn_kind: 'question',
          question: null,
          why: null,
          impact: null,
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-30 10:00:00',
          options: [],
          captured_items: [],
        },
      ],
    } as unknown as SpecificationState;
    queryClient.setQueryData(specificationQueryKeys.bundle('42'), stateWithNullQuestion);

    promoteStreamedFrontierTurnToBundle(queryClient, '42', {
      turnId: 7,
      phase: 'grounding',
      question: {
        toolCallId: 'tool-1',
        question: 'Which platform should we target next?',
        why: null,
        impact: null,
        options: [],
      },
    });

    const patchedBundle = queryClient.getQueryData<SpecificationState>(specificationQueryKeys.bundle('42'));

    expect(patchedBundle?.turns[0]?.question).toBe('Which platform should we target next?');
  });

  it('lets the normal bundle fetch reconcile a streamed question cache patch', () => {
    const authoritativeState: SpecificationState = {
      ...minimalSpecificationState,
      specification: {
        ...minimalSpecificationState.specification,
        active_turn_id: 7,
      },
      landing: { kind: 'frontier-turn', phase: 'grounding', turnId: 7 },
      turns: [
        {
          id: 7,
          specification_id: 42,
          parent_turn_id: null,
          phase: 'grounding',
          turn_kind: 'question',
          question: 'Which platform should we target next?',
          why: 'Server projection wins.',
          impact: 'medium',
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-30 10:00:00',
          options: [{ id: 22, position: 0, content: 'Web', is_recommended: false, is_selected: false }],
          captured_items: [],
        },
      ],
    };

    queryClient.setQueryData(specificationQueryKeys.bundle('42'), minimalSpecificationState);
    promoteStreamedFrontierTurnToBundle(queryClient, '42', {
      turnId: 7,
      phase: 'grounding',
      question: {
        toolCallId: 'tool-1',
        question: 'Which platform should we target next?',
        why: 'Client projection.',
        impact: 'high',
        options: [{ position: 0, content: 'Web', is_recommended: true }],
      },
    });

    queryClient.setQueryData(specificationQueryKeys.bundle('42'), authoritativeState);

    expect(queryClient.getQueryData(specificationQueryKeys.bundle('42'))).toEqual(authoritativeState);
  });
});
