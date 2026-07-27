// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';
import type { SpecificationState } from '@/shared/specification.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: '1' }),
}));

// Mock at the @ai-sdk/react boundary so happy-dom doesn't try to instantiate a
// real transport/streaming pipeline.
vi.mock('@ai-sdk/react', () => ({
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(async () => {}),
    status: 'ready' as const,
  }),
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    DefaultChatTransport: class DefaultChatTransport {
      constructor(_options: unknown) {}
    },
  };
});

vi.mock('@/client/components/ai-elements/conversation.js', () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/client/components/ai-elements/reasoning.js', () => ({
  Reasoning: ({ children, 'data-testid': testId }: { children: React.ReactNode; 'data-testid'?: string }) => (
    <div data-testid={testId}>{children}</div>
  ),
  ReasoningTrigger: () => null,
  ReasoningContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/client/components/ai-elements/message.js', () => ({
  Message: ({
    children,
    'data-testid': testId,
    from,
  }: {
    children: React.ReactNode;
    'data-testid'?: string;
    from?: string;
  }) => (
    <div data-testid={testId} data-from={from}>
      {children}
    </div>
  ),
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: string }) => <div>{children}</div>,
}));

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// FE-716 C30: <UnifiedChatShell> mounts <PendingReviewSection>, which calls
// useSpecificationOpenReconciliationNeeds(). The bundle invalidation that
// follows a successful trigger.create() also invalidates the reconciliation
// needs query (prefix match on ["specification", id, ...]), refetching it
// through the same fetchMock and consuming queued POST/bundle responses out
// of order. Stub the hook at the module boundary so the section stays inert.
vi.mock('@/client/routes/specification/$id/-specification-data.js', async (importOriginal) => {
  const mod =
    await importOriginal<typeof import('@/client/routes/specification/$id/-specification-data.js')>();
  return {
    ...mod,
    useSpecificationOpenReconciliationNeeds: () => [],
  };
});

const { ChatShellPresenceProvider } = await import('../chat-shell-presence.js');
const { SecondaryChatTriggerProvider, useSecondaryChatTrigger } =
  await import('../secondary-chat-trigger.js');
const { UnifiedChatShell } = await import('../unified-chat-shell.js');

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

function makeChat(id: number, invokedInTurnId: number | null = 9): SecondaryChat {
  return {
    chat: {
      id,
      specification_id: 1,
      kind: 'side_chat',
      parent_chat_id: 1,
      invoked_in_turn_id: invokedInTurnId,
      pinned_item_id: 5,
      pinned_span_hint: null,
      pinned_reconciliation_need_id: null,
      mode: 'explore',
    },
    kickoffTurn: null,
    turns: [],
    pinnedItemKind: 'context',
    pinnedReconciliationNeed: null,
    anchoredItemIds: [],
  };
}

// Pre-seeded so the shell's auto-create-master effect is a no-op and doesn't consume a queued fetchMock response.
function makeMasterChat(id: number = 100): SecondaryChat {
  return {
    chat: {
      id,
      specification_id: 1,
      kind: 'side_chat',
      parent_chat_id: 1,
      invoked_in_turn_id: null,
      pinned_item_id: null,
      pinned_span_hint: null,
      pinned_reconciliation_need_id: null,
      mode: 'explore',
    },
    kickoffTurn: null,
    turns: [],
    pinnedItemKind: null,
    pinnedReconciliationNeed: null,
    anchoredItemIds: [],
  };
}

function buildSpec(secondaryChats: SecondaryChat[]): SpecificationState {
  return {
    specification: {
      id: 1,
      name: 'Test spec',
      mode: 'greenfield',
      active_turn_id: 9,
      primary_chat_id: 1,
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
    secondaryChats,
  };
}

function makeHarness(secondaryChats: SecondaryChat[]): {
  queryClient: QueryClient;
  Wrapper: ({ children }: { children: ReactNode }) => ReactElement;
} {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(specificationQueryKeys.bundle('1'), buildSpec(secondaryChats));
  queryClient.setQueryData(specificationQueryKeys.entities('1'), {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback={<div data-testid="suspense-fallback" />}>
        <ChatShellPresenceProvider specificationId={1}>
          <SecondaryChatTriggerProvider>{children}</SecondaryChatTriggerProvider>
        </ChatShellPresenceProvider>
      </Suspense>
    </QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

beforeEach(() => {
  fetchMock.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

function TriggerButton({ chatId = 0 }: { chatId?: number }) {
  const ctx = useSecondaryChatTrigger();
  return (
    <button
      data-testid="trigger"
      onClick={() => {
        void ctx?.create({ kind: 'context', id: 99 });
      }}
      data-can-create={String(ctx?.canCreate ?? false)}
    >
      {chatId}
    </button>
  );
}

describe('chat shell presence + trigger integration', () => {
  it('starts collapsed on mount — the shell does not auto-open', () => {
    const master = makeMasterChat();
    const { Wrapper } = makeHarness([master]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell-minimized')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell')).toBeNull();
  });

  it('expands when the Ask brunch pill is clicked', () => {
    const master = makeMasterChat();
    const { Wrapper } = makeHarness([master]);

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-minimized'));

    expect(screen.queryByTestId('unified-chat-shell-minimized')).toBeNull();
    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
  });

  it('stays open across a remount once opened — refreshing keeps an open chat open', () => {
    const master = makeMasterChat();
    const { Wrapper } = makeHarness([master]);

    const first = render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId('unified-chat-shell-minimized'));
    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    first.unmount();

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );
    expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell-minimized')).toBeNull();
  });

  it('stays collapsed across a remount after it is closed — refreshing keeps a closed chat closed', () => {
    const master = makeMasterChat();
    const { Wrapper } = makeHarness([master]);

    const first = render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );
    fireEvent.click(screen.getByTestId('unified-chat-shell-minimized'));
    fireEvent.click(screen.getByTestId('unified-chat-shell-close'));
    expect(screen.getByTestId('unified-chat-shell-minimized')).not.toBeNull();
    first.unmount();

    render(
      <Wrapper>
        <UnifiedChatShell />
      </Wrapper>,
    );
    expect(screen.getByTestId('unified-chat-shell-minimized')).not.toBeNull();
    expect(screen.queryByTestId('unified-chat-shell')).toBeNull();
  });

  it('expands the shell and focuses the new chat after a successful create', async () => {
    // Seed a master so `UnifiedChatShell`'s auto-create-master effect stays
    // dormant; otherwise its POST would steal the first `fetchMock`
    // response that the trigger create expects.
    const master = makeMasterChat();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ chatId: 42, kickoffTurnId: 100 }), { status: 200 }),
    );

    const { Wrapper, queryClient } = makeHarness([master]);

    // Bundle reload after create includes both the seeded master and the
    // new item chat so `hasMaster` stays true and the auto-create effect
    // cannot fire again.
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(buildSpec([master, makeChat(42)])), { status: 200 }),
    );

    render(
      <Wrapper>
        <UnifiedChatShell />
        <TriggerButton />
      </Wrapper>,
    );

    expect(screen.getByTestId('unified-chat-shell-minimized')).not.toBeNull();

    fireEvent.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      expect(queryClient.getQueryData(specificationQueryKeys.bundle('1'))).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('unified-chat-shell-minimized')).toBeNull();
      expect(screen.getByTestId('unified-chat-shell')).not.toBeNull();
    });
  });

  it('switches the active chat to the focused chat once focus matches — transcript is always inline', async () => {
    const master = makeMasterChat();
    const chat = makeChat(7);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ chatId: 7, kickoffTurnId: 99 }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(buildSpec([master, chat])), { status: 200 }));

    const { Wrapper } = makeHarness([master, chat]);

    render(
      <Wrapper>
        <UnifiedChatShell />
        <TriggerButton />
      </Wrapper>,
    );

    fireEvent.click(screen.getByTestId('unified-chat-shell-minimized'));

    const before = await screen.findByTestId('secondary-chat-collapsible');
    expect(before.getAttribute('data-secondary-chat-id')).toBe(String(master.chat.id));

    fireEvent.click(screen.getByTestId('trigger'));

    await waitFor(() => {
      const after = screen.getByTestId('secondary-chat-collapsible');
      expect(after.getAttribute('data-secondary-chat-id')).toBe('7');
    });
  });
});
