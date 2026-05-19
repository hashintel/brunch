// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Suspense, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod/v4';

import { specificationQueryKeys } from '@/client/routes/specification/$id/-specification-data.js';
import { secondaryChatStateSchema } from '@/shared/api-types.js';
import type { BrunchUIMessage } from '@/shared/chat.js';
import type { SpecificationState } from '@/shared/specification.js';

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ id: '1' }),
}));

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

// useChat is mocked at the @ai-sdk/react boundary. The harness records each
// call so tests can assert per-chat isolation (each SecondaryChatHost instance
// gets its own useChat mount) and can drive sendMessage + onFinish
// synchronously.
interface UseChatCallRecord {
  id: string | undefined;
  sendMessage: ReturnType<typeof vi.fn>;
  onFinish: ((arg: { messages: BrunchUIMessage[] }) => unknown) | undefined;
  onData: ((dataPart: { type: string; data?: unknown }) => unknown) | undefined;
}

const { useChatCalls } = vi.hoisted(() => ({
  useChatCalls: [] as UseChatCallRecord[],
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: (options: {
    id?: string;
    onFinish?: (arg: { messages: BrunchUIMessage[] }) => unknown;
    onData?: (dataPart: { type: string; data?: unknown }) => unknown;
  }) => {
    const record: UseChatCallRecord = {
      id: options.id,
      sendMessage: vi.fn(async () => {}),
      onFinish: options.onFinish,
      onData: options.onData,
    };
    useChatCalls.push(record);
    return {
      messages: [] as BrunchUIMessage[],
      sendMessage: record.sendMessage,
      status: 'ready' as const,
    };
  },
}));

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai');
  return {
    ...actual,
    DefaultChatTransport: class DefaultChatTransport {
      constructor(public options: { api: string }) {}
    },
  };
});

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
      <Suspense fallback={<div data-testid="suspense-fallback" />}>{children}</Suspense>
    </QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

beforeEach(() => {
  useChatCalls.length = 0;
});

afterEach(() => {
  cleanup();
});

describe('SecondaryChatHost — useChat refit', () => {
  it('mounts useChat with a chat-scoped id keyed to the secondary chat', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    expect(useChatCalls.length).toBeGreaterThanOrEqual(1);
    expect(useChatCalls[0]!.id).toBe('secondary-chat-7');
  });

  it('submits the composer message through useChat.sendMessage with the typed text payload', async () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    fireEvent.change(screen.getByTestId('secondary-chat-composer-input'), {
      target: { value: 'why?' },
    });
    fireEvent.click(screen.getByTestId('secondary-chat-composer-send'));

    const lastCall = useChatCalls.at(-1)!;
    await waitFor(() => {
      expect(lastCall.sendMessage).toHaveBeenCalled();
    });
    expect(lastCall.sendMessage).toHaveBeenCalledWith({ text: 'why?' });
  });

  it('invalidates the specification bundle when useChat onFinish fires', async () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const { queryClient, Wrapper } = createHarness();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    const lastCall = useChatCalls.at(-1)!;
    expect(lastCall.onFinish).toBeTypeOf('function');
    await lastCall.onFinish?.({ messages: [] });

    expect(
      invalidateSpy.mock.calls.some(
        ([args]) => Array.isArray(args?.queryKey) && args.queryKey[0] === 'specification',
      ),
    ).toBe(true);
  });

  it('renders the composer as a sibling of the collapsible — collapsible owns transcript only; composer lives one level up in the host', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    const collapsible = screen.getByTestId('secondary-chat-collapsible');
    const composer = screen.getByTestId('secondary-chat-composer-sticky');
    expect(collapsible.contains(composer)).toBe(false);
  });

  it('keeps the composer visible outside the expandable transcript — composer sits outside CollapsibleContent so collapsing the body does not hide it', () => {
    const chat: SecondaryChat = {
      chat: baseChat,
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chat} />
      </Wrapper>,
    );

    const collapsibleBody = screen.getByTestId('secondary-chat-collapsible-body');
    const composer = screen.getByTestId('secondary-chat-composer-sticky');
    expect(collapsibleBody.contains(composer)).toBe(false);

    expect(screen.getByTestId('secondary-chat-composer-input')).not.toBeNull();
  });

  it('isolates useChat mounts across two host instances so parallel chats do not cross-talk', () => {
    const chatA: SecondaryChat = {
      chat: { ...baseChat, id: 7 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const chatB: SecondaryChat = {
      chat: { ...baseChat, id: 8 },
      kickoffTurn: null,
      turns: [],
      pinnedItemKind: null,
      pinnedReconciliationNeed: null,
      anchoredItemIds: [],
    };
    const { Wrapper } = createHarness();

    render(
      <Wrapper>
        <SecondaryChatHost secondaryChat={chatA} />
        <SecondaryChatHost secondaryChat={chatB} />
      </Wrapper>,
    );

    const ids = useChatCalls.map((c) => c.id);
    expect(ids).toContain('secondary-chat-7');
    expect(ids).toContain('secondary-chat-8');
    const callA = useChatCalls.find((c) => c.id === 'secondary-chat-7')!;
    const callB = useChatCalls.find((c) => c.id === 'secondary-chat-8')!;
    expect(callA.sendMessage).not.toBe(callB.sendMessage);
  });
});
