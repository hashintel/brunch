// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SecondaryChatTriggerProvider,
  useSecondaryChatTrigger,
} from '@/client/components/secondary-chat-trigger.js';
import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { SpecificationState } from '@/shared/specification.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: '1' }),
}));

const mockFetch = vi.fn<typeof fetch>();

function buildSpecificationState(
  overrides: Partial<SpecificationState['specification']> = {},
): SpecificationState {
  return {
    specification: {
      id: 1,
      name: 'Test',
      mode: 'greenfield',
      active_turn_id: 42,
      primary_chat_id: 7,
      created_at: '2026-04-12 10:00:00',
      updated_at: '2026-04-12 10:00:00',
      ...overrides,
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
    turns: [],
  };
}

function createHarness(state: SpecificationState): {
  queryClient: QueryClient;
  Wrapper: ({ children }: { children: ReactNode }) => ReactElement;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(specificationQueryKeys.bundle('1'), state);
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-fallback" />}>
        <SecondaryChatTriggerProvider>{children}</SecondaryChatTriggerProvider>
      </Suspense>
    </QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

function TriggerProbe() {
  const trigger = useSecondaryChatTrigger();
  return (
    <div>
      <div data-testid="can-create">{trigger?.canCreate ? 'yes' : 'no'}</div>
      <button
        type="button"
        onClick={() => {
          void trigger?.create({ kind: 'goal', id: 99 });
        }}
      >
        Create
      </button>
    </div>
  );
}

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('SecondaryChatTriggerProvider', () => {
  it('reports canCreate=true when primary_chat_id and active_turn_id are present', () => {
    const { Wrapper } = createHarness(buildSpecificationState());
    render(
      <Wrapper>
        <TriggerProbe />
      </Wrapper>,
    );
    expect(screen.getByTestId('can-create').textContent).toBe('yes');
  });

  it('reports canCreate=false when primary_chat_id is missing', () => {
    const { Wrapper } = createHarness(buildSpecificationState({ primary_chat_id: null }));
    render(
      <Wrapper>
        <TriggerProbe />
      </Wrapper>,
    );
    expect(screen.getByTestId('can-create').textContent).toBe('no');
  });

  it('reports canCreate=false when active_turn_id is null', () => {
    const { Wrapper } = createHarness(buildSpecificationState({ active_turn_id: null }));
    render(
      <Wrapper>
        <TriggerProbe />
      </Wrapper>,
    );
    expect(screen.getByTestId('can-create').textContent).toBe('no');
  });

  it('POSTs to /api/specifications/:id/secondary-chats with the resolved parent chat id, anchor turn id, and item ref, then invalidates the bundle', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ chatId: 100, kickoffTurnId: 200 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const { queryClient, Wrapper } = createHarness(buildSpecificationState());
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <Wrapper>
        <TriggerProbe />
      </Wrapper>,
    );
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('/api/specifications/1/secondary-chats');
    expect(init?.method).toBe('POST');
    const rawBody = init?.body;
    expect(typeof rawBody).toBe('string');
    const body = JSON.parse(rawBody as string);
    expect(body).toEqual({
      parentChatId: 7,
      invokedInTurnId: 42,
      itemKind: 'goal',
      itemId: 99,
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
    });
    expect(
      invalidateSpy.mock.calls.some(
        ([args]) => Array.isArray(args?.queryKey) && args.queryKey[0] === 'specification',
      ),
    ).toBe(true);
  });

  it('does not POST when canCreate is false', () => {
    const { Wrapper } = createHarness(buildSpecificationState({ active_turn_id: null }));
    render(
      <Wrapper>
        <TriggerProbe />
      </Wrapper>,
    );
    fireEvent.click(screen.getByText('Create'));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
