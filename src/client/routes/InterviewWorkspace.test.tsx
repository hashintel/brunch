// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
import type { BrunchUIMessage } from '../../shared/chat.js';
import type { WorkspaceLoaderData } from '../workspace/workspace-loader.js';
import { InterviewWorkspace } from './InterviewWorkspace.js';

type UseChatOptions = {
  messages: BrunchUIMessage[];
  onData?: (dataPart: { type: string; data?: unknown }) => void;
  onFinish?: () => void;
};

type UseChatHarness = {
  sendMessage: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
  onData?: UseChatOptions['onData'];
  onFinish?: UseChatOptions['onFinish'];
};

let currentLoaderData: WorkspaceLoaderData;
const routerInvalidate = vi.fn(async () => {});
const fetchMock = vi.fn<typeof fetch>();
let useChatImpl: (options: UseChatOptions) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text: string }) => Promise<void> | void;
  setMessages: (messages: BrunchUIMessage[]) => void;
  status: 'ready' | 'submitted' | 'streaming';
};
let useChatHarness: UseChatHarness;

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
  useLoaderData: () => currentLoaderData,
  useParams: () => ({ id: String(currentLoaderData.projectState.project.id) }),
  useRouter: () => ({ invalidate: routerInvalidate }),
}));

vi.mock('@ai-sdk/react', () => ({
  useChat: (options: UseChatOptions) => useChatImpl(options),
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

vi.mock('@/components/ai-elements/conversation', () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationScrollButton: () => null,
}));

vi.mock('@/components/ai-elements/message', () => ({
  Message: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ai-elements/prompt-input', () => ({
  PromptInput: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputSubmit: () => <button type="button">Send</button>,
  PromptInputTextarea: () => <textarea aria-label="Type a message..." />,
}));

vi.mock('@/components/ai-elements/reasoning', () => ({
  Reasoning: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReasoningContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReasoningTrigger: () => null,
}));

vi.mock('@/components/ai-elements/tool', () => ({
  Tool: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolHeader: () => null,
  ToolContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolInput: () => null,
  ToolOutput: () => null,
}));

function createProjectState({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  options = [],
}: {
  projectId?: number;
  assistantText?: string;
  answer?: string;
  options?: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
} = {}): ProjectState {
  return {
    project: {
      id: projectId,
      name: `Project ${projectId}`,
      active_turn_id: 1,
      created_at: '2026-04-03 10:00:00',
      updated_at: '2026-04-03 10:00:00',
    },
    turns: [
      {
        id: 1,
        project_id: projectId,
        parent_turn_id: null,
        phase: 'scope',
        question: assistantText,
        why: 'This frames the first iteration.',
        impact: 'high',
        answer,
        is_resolution: false,
        user_parts: JSON.stringify([{ type: 'text', text: answer }]),
        assistant_parts: JSON.stringify([{ type: 'text', text: assistantText }]),
        created_at: '2026-04-03 10:00:00',
        options,
      },
    ],
  };
}

function createWorkspaceLoaderData({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  options = [],
  entitySnapshot = { decisions: [], assumptions: [] } satisfies EntitiesData,
}: {
  projectId?: number;
  assistantText?: string;
  answer?: string;
  options?: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
  entitySnapshot?: EntitiesData;
} = {}): WorkspaceLoaderData {
  return {
    projectState: createProjectState({ projectId, assistantText, answer, options }),
    entitySnapshot,
  };
}

function createUseChatHarness(status: 'ready' | 'submitted' | 'streaming' = 'ready'): (
  options: UseChatOptions,
) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text: string }) => Promise<void> | void;
  setMessages: (messages: BrunchUIMessage[]) => void;
  status: 'ready' | 'submitted' | 'streaming';
} {
  const sendMessage = vi.fn(async () => {});
  const setMessagesSpy = vi.fn();

  useChatHarness = {
    sendMessage,
    setMessages: setMessagesSpy,
  };

  return function useChatHarnessImpl(options: UseChatOptions) {
    const [messages, setMessages] = useState(options.messages);
    const stableSetMessages = useCallback((nextMessages: BrunchUIMessage[]) => {
      setMessagesSpy(nextMessages);
      setMessages(nextMessages);
    }, []);

    useChatHarness.onData = options.onData;
    useChatHarness.onFinish = options.onFinish;

    return {
      messages,
      sendMessage,
      setMessages: stableSetMessages,
      status,
    };
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
      },
    },
  });
}

function renderWorkspace() {
  const queryClient = createQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <InterviewWorkspace />
    </QueryClientProvider>,
  );

  return {
    ...rendered,
    queryClient,
  };
}

beforeEach(() => {
  currentLoaderData = createWorkspaceLoaderData();
  routerInvalidate.mockClear();
  fetchMock.mockReset();
  useChatImpl = createUseChatHarness();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InterviewWorkspace', () => {
  it('hydrates transcript and sidebar state from the route loader without a post-mount entity fetch', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        decisions: [
          {
            id: 7,
            project_id: 1,
            content: 'Start with the web app',
            rationale: 'Fastest launch path',
          },
        ],
        assumptions: [],
      },
    });

    renderWorkspace();

    expect(await screen.findByText('Build the web app')).toBeTruthy();
    expect(screen.getByText('What should we build first?')).toBeTruthy();
    expect(screen.getByText('Start with the web app')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes durable loader-owned state for the same project without rewriting the live transcript', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        decisions: [],
        assumptions: [],
      },
    });

    const rendered = renderWorkspace();
    expect(await screen.findByText('What should we build first?')).toBeTruthy();
    expect(screen.getByText("No decisions yet. They'll appear as the interview progresses.")).toBeTruthy();

    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
      entitySnapshot: {
        decisions: [
          {
            id: 8,
            project_id: 1,
            content: 'Prefer the desktop app',
            rationale: 'Matches the updated brief',
          },
        ],
        assumptions: [],
      },
    });
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InterviewWorkspace />
      </QueryClientProvider>,
    );

    expect(screen.getByText('What should we build first?')).toBeTruthy();
    expect(screen.queryByText('Which platform should we target now?')).toBeNull();
    expect(screen.queryByText('Ship the desktop app')).toBeNull();

    await waitFor(() => {
      expect(screen.getByText('Prefer the desktop app')).toBeTruthy();
    });
  });

  it('refetches sidebar entities when the chat stream emits an observer result', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        decisions: [],
        assumptions: [],
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          decisions: [
            {
              id: 7,
              project_id: 1,
              content: 'Start with the web app',
              rationale: 'Fastest launch path',
            },
          ],
          assumptions: [],
        } satisfies EntitiesData),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderWorkspace();
    expect(
      await screen.findByText("No decisions yet. They'll appear as the interview progresses."),
    ).toBeTruthy();

    await act(async () => {
      useChatHarness.onData?.({
        type: 'data-observer-result',
        data: { entityIds: { decisions: [7], assumptions: [] } },
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Start with the web app')).toBeTruthy();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('posts option selections, refreshes project state, and forwards the selected text back into chat', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
      ],
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /desktop/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/turns/1/select',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ position: 1 }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'Desktop' });
    });
  });
});
