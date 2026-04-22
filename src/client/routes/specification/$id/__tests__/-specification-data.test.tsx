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

  it('uses one authoritative bundle key for workflow, landing, and turns', async () => {
    await primeSpecificationBundle('42');

    expect(Object.keys(specificationQueryKeys)).toEqual(['bundle', 'entities']);
    expect(queryClient.getQueryData(specificationQueryKeys.bundle('42'))).toEqual(minimalSpecificationState);
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
});
