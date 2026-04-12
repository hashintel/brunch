// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
import type { BrunchUIMessage } from '../../shared/chat.js';
import type { WorkspaceLoaderData } from '../workspace/workspace-loader.js';
import { InterviewWorkspace } from './InterviewWorkspace.js';

function createPendingQuestionMessage(): BrunchUIMessage {
  return {
    id: 'pending-question-assistant',
    role: 'assistant',
    parts: [
      {
        type: 'tool-ask_question',
        toolCallId: 'tool-1',
        state: 'output-available',
        input: {
          question: 'Which platform should we target next?',
          why: 'Platform shapes the first build.',
          impact: 'high',
          options: [
            { content: 'Web', is_recommended: true },
            { content: 'Desktop', is_recommended: false },
          ],
        },
        output: { ok: true, turnId: 2, optionCount: 2 },
      },
    ],
  };
}

type UseChatOptions = {
  id?: string;
  messages: BrunchUIMessage[];
  onData?: (dataPart: { type: string; data?: unknown }) => void;
  onFinish?: () => void;
};

type UseChatHarness = {
  sendMessage: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
  replaceMessages?: (messages: BrunchUIMessage[]) => void;
  onData?: UseChatOptions['onData'];
  onFinish?: UseChatOptions['onFinish'];
};

let currentLoaderData: WorkspaceLoaderData;
const routerInvalidate = vi.fn(async () => {});
const fetchMock = vi.fn<typeof fetch>();
let useChatImpl: (options: UseChatOptions) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text?: string; parts?: Array<Record<string, unknown>> }) => Promise<void> | void;
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
  userParts = [{ type: 'text', text: answer }] as Array<Record<string, unknown>>,
  options = [],
  workflow,
  assistantParts,
}: {
  projectId?: number;
  assistantText?: string;
  answer?: string;
  userParts?: Array<Record<string, unknown>>;
  options?: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
  workflow?: ProjectState['workflow'];
  assistantParts?: Array<Record<string, unknown>>;
} = {}): ProjectState {
  return {
    project: {
      id: projectId,
      name: `Project ${projectId}`,
      mode: 'greenfield',
      cwd: null,
      active_turn_id: 1,
      created_at: '2026-04-03 10:00:00',
      updated_at: '2026-04-03 10:00:00',
    },
    workflow: workflow ?? {
      phases: {
        scope: {
          status: 'unstarted',
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
        user_parts: JSON.stringify(userParts),
        assistant_parts: JSON.stringify(
          assistantParts ?? (assistantText ? [{ type: 'text', text: assistantText }] : []),
        ),
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
  userParts,
  options = [],
  workflow,
  assistantParts,
  entitySnapshot = {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
  } satisfies EntitiesData,
}: {
  projectId?: number;
  assistantText?: string;
  answer?: string;
  userParts?: Array<Record<string, unknown>>;
  options?: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
  workflow?: ProjectState['workflow'];
  assistantParts?: Array<Record<string, unknown>>;
  entitySnapshot?: EntitiesData;
} = {}): WorkspaceLoaderData {
  return {
    projectState: createProjectState({
      projectId,
      assistantText,
      answer,
      userParts,
      options,
      workflow,
      assistantParts,
    }),
    entitySnapshot,
  };
}

function createUseChatHarness(status: 'ready' | 'submitted' | 'streaming' = 'ready'): (
  options: UseChatOptions,
) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text?: string; parts?: Array<Record<string, unknown>> }) => Promise<void> | void;
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
    const [, forceRender] = useState(0);
    const chatStates = useState(() => new Map<string, BrunchUIMessage[]>())[0];
    const chatId = options.id ?? 'default';

    if (!chatStates.has(chatId)) {
      chatStates.set(chatId, options.messages);
    }

    const stableSetMessages = useCallback(
      (nextMessages: BrunchUIMessage[]) => {
        setMessagesSpy(nextMessages);
        chatStates.set(chatId, nextMessages);
        forceRender((count) => count + 1);
      },
      [chatId, chatStates],
    );

    useChatHarness.onData = options.onData;
    useChatHarness.onFinish = options.onFinish;
    useChatHarness.replaceMessages = stableSetMessages;

    return {
      messages: chatStates.get(chatId) ?? options.messages,
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
  it('renders the turn card from a pending-question tool part before route invalidation', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace();

    expect(await screen.findByText('Earlier question?')).toBeTruthy();
    expect(screen.queryByText('Which platform should we target next?')).toBeNull();
    expect(screen.getByLabelText('Type a message...')).toBeTruthy();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingQuestionMessage(),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByText('Which platform should we target next?')).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /web/i })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /desktop/i })).toBeTruthy();
      expect(screen.queryByLabelText('Type a message...')).toBeNull();
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('hydrates transcript and sidebar state from the route loader without a post-mount entity fetch', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [
          {
            id: 7,
            project_id: 1,
            content: 'Start with the web app',
            rationale: 'Fastest launch path',
          },
        ],
        assumptions: [],
        relationships: [],
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
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
        relationships: [],
      },
    });

    const rendered = renderWorkspace();
    expect(await screen.findByText('What should we build first?')).toBeTruthy();
    expect(screen.getByText("No decisions yet. They'll appear as the interview progresses.")).toBeTruthy();

    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [
          {
            id: 8,
            project_id: 1,
            content: 'Prefer the desktop app',
            rationale: 'Matches the updated brief',
          },
        ],
        assumptions: [],
        relationships: [],
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
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByText('Prefer the desktop app')).toBeTruthy();
    });
  });

  it('hydrates persisted transcript state when navigating to a different project', async () => {
    const rendered = renderWorkspace();
    expect(await screen.findByText('What should we build first?')).toBeTruthy();

    currentLoaderData = createWorkspaceLoaderData({
      projectId: 2,
      assistantText: 'How should project two start?',
      answer: 'Begin with the API',
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
        relationships: [],
      },
    });
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InterviewWorkspace />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('How should project two start?')).toBeTruthy();
      expect(screen.getByText('Begin with the API')).toBeTruthy();
    });

    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('renders remaining generic knowledge kinds in the sidebar without regressing existing tabs', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [
          {
            id: 9,
            project_id: 1,
            kind: 'context',
            subtype: null,
            content: 'The tool starts from an ambiguous brief',
            rationale: null,
          },
        ],
        constraints: [
          {
            id: 10,
            project_id: 1,
            kind: 'constraint',
            subtype: 'non-goal',
            content: 'Keep setup instant',
            rationale: 'Avoid a heavyweight launcher',
          },
        ],
        requirements: [
          {
            id: 11,
            project_id: 1,
            kind: 'requirement',
            subtype: null,
            content: 'Resume interviews after browser restart',
            rationale: 'People leave mid-session',
          },
        ],
        criteria: [
          {
            id: 12,
            project_id: 1,
            kind: 'criterion',
            subtype: 'acceptance',
            content: 'Restoring the project shows the active path',
            rationale: 'Protects the persistence seam',
          },
        ],
        decisions: [
          {
            id: 7,
            project_id: 1,
            content: 'Start with the web app',
            rationale: 'Fastest launch path',
          },
        ],
        assumptions: [{ id: 5, project_id: 1, content: 'Users arrive with a concrete goal' }],
        relationships: [
          {
            type: 'depends_on',
            source: { collection: 'decision', kind: 'decision', id: 7 },
            target: { collection: 'assumption', kind: 'assumption', id: 5 },
          },
        ],
      } as EntitiesData,
    });

    renderWorkspace();

    expect(await screen.findByText('Start with the web app')).toBeTruthy();
    expect(screen.getByText(/depends on/i)).toBeTruthy();
    expect(screen.getByText('Users arrive with a concrete goal')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /constraints/i }));
    expect(await screen.findByText('Keep setup instant')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /requirements/i }));
    expect(await screen.findByText('Resume interviews after browser restart')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /criteria/i }));
    expect(await screen.findByText('Restoring the project shows the active path')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /context/i }));
    expect(await screen.findByText('The tool starts from an ambiguous brief')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /decisions/i }));
    expect(await screen.findByText('Start with the web app')).toBeTruthy();
  });

  it('refetches sidebar entities when the chat stream emits observer-created constraints', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
        relationships: [],
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [],
          terms: [],
          contexts: [
            {
              id: 7,
              project_id: 1,
              kind: 'context',
              subtype: null,
              content: 'The project starts from a fuzzy brief',
              rationale: 'The user is still establishing the problem context',
            },
          ],
          constraints: [
            {
              id: 8,
              project_id: 1,
              kind: 'constraint',
              subtype: 'non-goal',
              content: 'Keep setup instant',
              rationale: 'The launcher should stay lightweight',
            },
          ],
          requirements: [],
          criteria: [],
          decisions: [],
          assumptions: [],
          relationships: [],
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
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [7],
            constraints: [8],
            requirements: [],
            criteria: [],
            decisions: [],
            assumptions: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /constraints/i }));
    expect(await screen.findByText('Keep setup instant')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /context/i }));
    expect(await screen.findByText('The project starts from a fuzzy brief')).toBeTruthy();
  });

  it('ignores invalid entity refresh payloads and keeps the loader snapshot visible', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [
          {
            id: 9,
            project_id: 1,
            content: 'Loader decision',
            rationale: 'Still authoritative when refresh parsing fails',
          },
        ],
        assumptions: [],
        relationships: [],
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [],
          decisions: [
            {
              content: 'Broken decision',
              rationale: null,
            },
          ],
          assumptions: [],
          relationships: [],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderWorkspace();
    expect(await screen.findByText('Loader decision')).toBeTruthy();

    await act(async () => {
      useChatHarness.onData?.({
        type: 'data-observer-result',
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [],
            constraints: [],
            requirements: [],
            criteria: [],
            decisions: [99],
            assumptions: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText('Loader decision')).toBeTruthy();
    expect(screen.queryByText('Broken decision')).toBeNull();
  });

  it('refetches sidebar entities when the chat stream emits mixed observer-created design entities', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
        relationships: [],
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [],
          terms: [],
          contexts: [
            {
              id: 7,
              project_id: 1,
              kind: 'context',
              subtype: null,
              content: 'The first release still targets solo builders',
              rationale: 'The turn clarified the audience',
            },
          ],
          constraints: [
            {
              id: 8,
              project_id: 1,
              kind: 'constraint',
              subtype: 'non-goal',
              content: 'Do not add a plugin system yet',
              rationale: 'The first release should stay narrow',
            },
          ],
          requirements: [],
          criteria: [],
          decisions: [
            {
              id: 9,
              project_id: 1,
              content: 'Start with the web app',
              rationale: 'It is the fastest path to feedback',
            },
          ],
          assumptions: [
            {
              id: 10,
              project_id: 1,
              content: 'Users can work in a browser',
            },
          ],
          relationships: [
            {
              type: 'depends_on',
              source: { collection: 'decision', kind: 'decision', id: 9 },
              target: { collection: 'assumption', kind: 'assumption', id: 10 },
            },
          ],
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
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [7],
            constraints: [8],
            requirements: [],
            criteria: [],
            decisions: [9],
            assumptions: [10],
          },
        },
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    expect(await screen.findByText('Start with the web app')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /assumptions/i }));
    expect(await screen.findByText('Users can work in a browser')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /constraints/i }));
    expect(await screen.findByText('Do not add a plugin system yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /context/i }));
    expect(await screen.findByText('The first release still targets solo builders')).toBeTruthy();
  });

  it('refetches sidebar entities when the chat stream emits observer-created requirements', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
        relationships: [],
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [
            {
              id: 11,
              project_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Resume the interview from SQLite after restart',
              rationale: 'Users will come back to finish the workflow',
            },
          ],
          criteria: [],
          decisions: [],
          assumptions: [],
          relationships: [],
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
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [],
            constraints: [],
            requirements: [11],
            criteria: [],
            decisions: [],
            assumptions: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /requirements/i }));
    expect(await screen.findByText('Resume the interview from SQLite after restart')).toBeTruthy();
  });

  it('refetches sidebar entities when the chat stream emits observer-created criteria', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [],
        assumptions: [],
        relationships: [],
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          goals: [],
          terms: [],
          contexts: [],
          constraints: [],
          requirements: [],
          criteria: [
            {
              id: 12,
              project_id: 1,
              kind: 'criterion',
              subtype: null,
              content: 'Resuming restores the active path without data loss',
              rationale: 'This proves persistence worked for the branch the user was on',
            },
          ],
          decisions: [],
          assumptions: [],
          relationships: [],
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
        data: {
          entityIds: {
            goals: [],
            terms: [],
            contexts: [],
            constraints: [],
            requirements: [],
            criteria: [12],
            decisions: [],
            assumptions: [],
          },
        },
      } as never);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /criteria/i }));
    expect(await screen.findByText('Resuming restores the active path without data loss')).toBeTruthy();
  });

  it('posts single-option turn responses with optional free-text and forwards a combined summary into chat', async () => {
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

    fireEvent.change(await screen.findByLabelText('Additional response context'), {
      target: { value: 'Best fit for our launch' },
    });

    fireEvent.click(await screen.findByRole('checkbox', { name: /desktop/i }));
    fireEvent.click(await screen.findByRole('button', { name: /submit selected response/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'select-options',
            positions: [1],
            freeText: 'Best fit for our launch',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'Desktop — Best fit for our launch' });
    });
  });

  it('posts many-selection turn responses and forwards a grouped summary into chat', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        { id: 13, position: 2, content: 'Mobile', is_recommended: false, is_selected: false },
      ],
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace();

    fireEvent.click(await screen.findByRole('checkbox', { name: /web/i }));
    fireEvent.click(await screen.findByRole('checkbox', { name: /desktop/i }));
    fireEvent.change(await screen.findByLabelText('Additional response context'), {
      target: { value: 'Covers both launch paths' },
    });
    fireEvent.click(await screen.findByRole('button', { name: /submit selected response/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'select-options',
            positions: [0, 1],
            freeText: 'Covers both launch paths',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        text: 'Web, Desktop — Covers both launch paths',
      });
    });
  });

  it('submits scope-closure confirmations through chat with typed confirmation parts', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      assistantText: '',
      answer: 'We have enough scope context',
      workflow: {
        phases: {
          scope: {
            status: 'in_progress',
            closeability: true,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: true,
            turnId: 1,
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
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
      } as any,
      assistantParts: [
        {
          type: 'data-phase-summary',
          data: {
            turnId: 1,
            phase: 'scope',
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
        },
      ],
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /confirm scope closure/i }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Confirm scope closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'scope' },
          },
        ],
      });
    });
  });

  it('submits a force-close action for design through chat with typed confirmation parts', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      workflow: {
        phases: {
          scope: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 1,
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
          design: {
            status: 'in_progress',
            closeability: true,
            readiness: 'medium',
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
      } as any,
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /force design closure/i }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Force design closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'force-close-active-phase', phase: 'design' },
          },
        ],
      });
    });
  });

  it('hides the force-close action when design already has a pending closure proposal', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      workflow: {
        phases: {
          scope: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 1,
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
          design: {
            status: 'in_progress',
            closeability: true,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: true,
            turnId: 3,
            summary: 'The main architectural commitments are captured well enough to review requirements.',
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
      } as any,
    });

    renderWorkspace();

    expect(screen.queryByRole('button', { name: /force design closure/i })).toBeNull();
  });

  it('renders shared workflow state for closed scope and active design mode', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      workflow: {
        phases: {
          scope: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 1,
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
          design: {
            status: 'in_progress',
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
      } as any,
    });

    renderWorkspace();

    expect(await screen.findByText(/scope closed/i)).toBeTruthy();
    expect(screen.getByText(/recommended close/i)).toBeTruthy();
    expect(screen.getByText(/design in progress/i)).toBeTruthy();
    expect(screen.getAllByText(/low readiness/i).length).toBeGreaterThan(0);
  });

  it('renders forced-close workflow state for closed design and active requirements mode', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      workflow: {
        phases: {
          scope: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 1,
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
          design: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'user_forced',
            proposalPending: false,
            turnId: 4,
            summary: 'Design closed by user without an interviewer recommendation.',
          },
          requirements: {
            status: 'in_progress',
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
      } as any,
    });

    renderWorkspace();

    expect(await screen.findByText(/design closed/i)).toBeTruthy();
    expect(screen.getByText(/forced close/i)).toBeTruthy();
    expect(screen.getByText(/requirements in progress/i)).toBeTruthy();
  });

  it('does not show "Not yet closeable" for phases whose status is closed', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      workflow: {
        phases: {
          scope: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 1,
            summary: 'Goals, terms, context, and constraints are sufficiently captured.',
          },
          design: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'user_forced',
            proposalPending: false,
            turnId: 4,
            summary: 'Design closed by user without an interviewer recommendation.',
          },
          requirements: {
            status: 'in_progress',
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
      } as any,
    });

    renderWorkspace();

    await screen.findByText(/scope closed/i);

    const scopeMetaLabels = screen.getAllByText(/high readiness/i);
    for (const label of scopeMetaLabels) {
      expect(label.textContent).not.toContain('Not yet closeable');
    }
  });

  it('posts free-text-only turn responses and forwards the text into chat', async () => {
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

    fireEvent.change(await screen.findByLabelText('Additional response context'), {
      target: { value: 'None of these fit our use case' },
    });

    fireEvent.click(await screen.findByRole('button', { name: /submit free-text response/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'free-text',
            freeText: 'None of these fit our use case',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'None of these fit our use case' });
    });
  });

  it('rehydrates persisted selected options from turn-response data even when option flags are false', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      answer: 'Desktop — Best fit for launch',
      userParts: [
        { type: 'text', text: 'Desktop — Best fit for launch' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for launch' },
        },
      ],
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
      ],
    });

    renderWorkspace();

    const web = (await screen.findByRole('checkbox', { name: /web/i })) as HTMLInputElement;
    const desktop = screen.getByRole('checkbox', { name: /desktop/i }) as HTMLInputElement;

    expect(web.checked).toBe(false);
    expect(desktop.checked).toBe(true);
    expect(web.disabled).toBe(true);
    expect(desktop.disabled).toBe(true);
    expect(screen.getByLabelText('Type a message...')).toBeTruthy();
  });

  it('locks a persisted free-text-only turn response after it has been saved', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      answer: 'None of these fit our use case',
      userParts: [
        { type: 'text', text: 'None of these fit our use case' },
        {
          type: 'data-turn-response',
          data: { turnId: 1, selectedOptionIds: [], freeText: 'None of these fit our use case' },
        },
      ],
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
      ],
    });

    renderWorkspace();

    expect(await screen.findByText('None of these fit our use case')).toBeTruthy();
    expect((screen.getByLabelText('Additional response context') as HTMLTextAreaElement).disabled).toBe(true);
    expect(
      (screen.getByRole('button', { name: /submit selected response/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: /submit free-text response/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('checkbox', { name: /web/i }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('checkbox', { name: /desktop/i }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByLabelText('Type a message...')).toBeTruthy();
  });

  it('does not emit duplicate React keys when dependency labels repeat', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        goals: [],
        terms: [],
        contexts: [],
        constraints: [],
        requirements: [],
        criteria: [],
        decisions: [
          {
            id: 7,
            project_id: 1,
            content: 'Start with the web app',
            rationale: 'Fastest launch path',
          },
        ],
        assumptions: [
          { id: 5, project_id: 1, content: 'Users can work in a browser' },
          { id: 6, project_id: 1, content: 'Users can work in a browser' },
        ],
        relationships: [
          {
            type: 'depends_on',
            source: { collection: 'decision', kind: 'decision', id: 7 },
            target: { collection: 'assumption', kind: 'assumption', id: 5 },
          },
          {
            type: 'depends_on',
            source: { collection: 'decision', kind: 'decision', id: 7 },
            target: { collection: 'assumption', kind: 'assumption', id: 6 },
          },
        ],
      } satisfies EntitiesData,
    });

    renderWorkspace();

    expect(await screen.findByText('Start with the web app')).toBeTruthy();
    expect(screen.getAllByText('Users can work in a browser')).toHaveLength(2);
    expect(consoleError.mock.calls.flat().join('\n')).not.toContain(
      'Encountered two children with the same key',
    );
    consoleError.mockRestore();
  });

  it('shows a visible error when saving an option selection fails', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
      ],
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Selection could not be saved' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace();

    fireEvent.click(await screen.findByRole('checkbox', { name: /desktop/i }));
    fireEvent.click(await screen.findByRole('button', { name: /submit selected response/i }));

    expect((await screen.findByRole('alert')).textContent).toContain('Selection could not be saved');
    expect(routerInvalidate).not.toHaveBeenCalled();
    expect(useChatHarness.sendMessage).not.toHaveBeenCalled();
  });
});
