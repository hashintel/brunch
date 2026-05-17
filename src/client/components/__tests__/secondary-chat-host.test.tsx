// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import { secondaryChatStateSchema } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: '1' }),
}));

const { mockStream } = vi.hoisted(() => ({
  mockStream: vi.fn(),
}));

vi.mock('@/client/lib/secondary-chat-stream.js', () => ({
  streamSecondaryChatMessage: mockStream,
}));

const { SecondaryChatHost } = await import('../secondary-chat-host.js');

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

const baseChat: SecondaryChat['chat'] = {
  id: 7,
  specification_id: 1,
  kind: 'side_chat',
  parent_chat_id: 1,
  invoked_in_turn_id: 3,
  pinned_item_id: 5,
  pinned_span_hint: null,
  pinned_reconciliation_need_id: null,
  mode: 'explore',
};

function buildSpec(): SpecificationState {
  return {
    specification: {
      id: 1,
      name: 'Test',
      mode: 'greenfield',
      active_turn_id: 42,
      primary_chat_id: 7,
      created_at: '2026-04-12 10:00:00',
      updated_at: '2026-04-12 10:00:00',
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

function createHarness(): {
  queryClient: QueryClient;
  Wrapper: ({ children }: { children: ReactNode }) => ReactElement;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(specificationQueryKeys.bundle('1'), buildSpec());
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-fallback" />}>{children}</Suspense>
    </QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

beforeEach(() => {
  mockStream.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('SecondaryChatHost — composer wiring (C5b)', () => {
  it('submits the composer message to streamSecondaryChatMessage with the right ids', async () => {
    mockStream.mockResolvedValue(undefined);
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    fireEvent.change(screen.getByTestId('secondary-chat-composer-input'), {
      target: { value: 'why?' },
    });
    fireEvent.click(screen.getByTestId('secondary-chat-composer-send'));

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalled();
    });
    const [request] = mockStream.mock.calls[0]!;
    expect(request).toMatchObject({ specificationId: 1, chatId: 7, message: 'why?' });
  });

  it('renders streaming assistant text deltas live and invalidates the bundle when the stream completes', async () => {
    mockStream.mockImplementation(
      async (
        _request: { specificationId: number; chatId: number; message: string },
        onChunk: (event: { type: string; delta?: string }) => void,
      ) => {
        onChunk({ type: 'text-delta', delta: 'Hello ' });
        onChunk({ type: 'text-delta', delta: 'world.' });
      },
    );
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
    };
    const { queryClient, Wrapper } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('secondary-chat-collapsible-trigger'));
    fireEvent.change(screen.getByTestId('secondary-chat-composer-input'), {
      target: { value: 'hi' },
    });
    fireEvent.click(screen.getByTestId('secondary-chat-composer-send'));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalled();
    });
    expect(
      invalidateSpy.mock.calls.some(
        ([args]) => Array.isArray(args?.queryKey) && args.queryKey[0] === 'specification',
      ),
    ).toBe(true);
  });

  it('isolates in-flight state across two host instances (no cross-talk)', async () => {
    let resolveOne = (): void => {};
    mockStream.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        resolveOne = resolve;
      });
    });
    mockStream.mockResolvedValueOnce(undefined);
    const chatA: SecondaryChat = {
      chat: { ...baseChat, id: 7 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
    };
    const chatB: SecondaryChat = {
      chat: { ...baseChat, id: 8 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chatA} />
        <SecondaryChatHost secondaryChat={chatB} />
      </Wrapper>,
    );

    const collapsibles = screen.getAllByTestId('secondary-chat-collapsible-trigger');
    fireEvent.click(collapsibles[0]);
    fireEvent.click(collapsibles[1]);

    const inputs = screen.getAllByTestId('secondary-chat-composer-input') as HTMLInputElement[];
    const sends = screen.getAllByTestId('secondary-chat-composer-send');
    fireEvent.change(inputs[0], { target: { value: 'a?' } });
    fireEvent.change(inputs[1], { target: { value: 'b?' } });
    fireEvent.click(sends[0]); // chat A streams, hangs
    fireEvent.click(sends[1]); // chat B streams, resolves immediately

    await waitFor(() => {
      expect(mockStream).toHaveBeenCalledTimes(2);
    });
    expect(mockStream.mock.calls[0]?.[0]).toMatchObject({ chatId: 7, message: 'a?' });
    expect(mockStream.mock.calls[1]?.[0]).toMatchObject({ chatId: 8, message: 'b?' });

    // Resolve A so Vitest doesn't leak the pending stream.
    resolveOne();
  });
});
