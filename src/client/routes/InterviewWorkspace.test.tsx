// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
import type { BrunchUIMessage } from '../../shared/chat.js';
import type { WorkspaceLoaderData } from '../workspace/workspace-loader.js';
import { InterviewWorkspace } from './InterviewWorkspace.js';

function createLiveQuestionMessage(): BrunchUIMessage {
  return {
    id: 'live-turn-assistant',
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
  entitySnapshot = {
    framing: [],
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
    useChatHarness.replaceMessages = stableSetMessages;

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
  it('renders the turn card from a live streamed tool part before route invalidation', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace();

    expect(await screen.findByText('Earlier question?')).toBeTruthy();
    expect(screen.queryByText('Which platform should we target next?')).toBeNull();
    expect(screen.getByLabelText('Type a message...')).toBeTruthy();

    await waitFor(() => {
      expect(useChatHarness.setMessages).toHaveBeenCalledTimes(1);
    });
    useChatHarness.setMessages.mockClear();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createLiveQuestionMessage(),
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
        framing: [],
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
        framing: [],
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

    await waitFor(() => {
      expect(useChatHarness.setMessages).toHaveBeenCalledTimes(1);
    });
    useChatHarness.setMessages.mockClear();

    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
      entitySnapshot: {
        framing: [],
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

    await waitFor(() => {
      expect(useChatHarness.setMessages).toHaveBeenCalledTimes(1);
    });
    useChatHarness.setMessages.mockClear();

    currentLoaderData = createWorkspaceLoaderData({
      projectId: 2,
      assistantText: 'How should project two start?',
      answer: 'Begin with the API',
      entitySnapshot: {
        framing: [],
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
      expect(useChatHarness.setMessages).toHaveBeenCalledWith([
        {
          id: 'turn-1-answer',
          role: 'user',
          parts: [{ type: 'text', text: 'Begin with the API' }],
        },
        {
          id: 'turn-1-assistant',
          role: 'assistant',
          parts: [{ type: 'text', text: 'How should project two start?' }],
        },
      ]);
    });

    expect(screen.getByText('How should project two start?')).toBeTruthy();
    expect(screen.getByText('Begin with the API')).toBeTruthy();
  });

  it('renders remaining generic knowledge kinds in the sidebar without regressing existing tabs', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        framing: [
          {
            id: 9,
            project_id: 1,
            kind: 'framing',
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

    fireEvent.click(screen.getByRole('button', { name: /framing/i }));
    expect(await screen.findByText('The tool starts from an ambiguous brief')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /decisions/i }));
    expect(await screen.findByText('Start with the web app')).toBeTruthy();
  });

  it('refetches sidebar entities when the chat stream emits observer-created constraints', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        framing: [],
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
          framing: [
            {
              id: 7,
              project_id: 1,
              kind: 'framing',
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
        data: { entityIds: { framing: [7], constraints: [8], decisions: [], assumptions: [] } },
      });
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /constraints/i }));
    expect(await screen.findByText('Keep setup instant')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /framing/i }));
    expect(await screen.findByText('The project starts from a fuzzy brief')).toBeTruthy();
  });

  it('refetches sidebar entities when the chat stream emits mixed observer-created design entities', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      entitySnapshot: {
        framing: [],
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
          framing: [
            {
              id: 7,
              project_id: 1,
              kind: 'framing',
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
        data: { entityIds: { framing: [7], constraints: [8], decisions: [9], assumptions: [10] } },
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
    fireEvent.click(screen.getByRole('button', { name: /framing/i }));
    expect(await screen.findByText('The first release still targets solo builders')).toBeTruthy();
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
        '/api/projects/1/turns/1/select',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: [1], freeText: 'Best fit for our launch' }),
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
        '/api/projects/1/turns/1/select',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: [0, 1], freeText: 'Covers both launch paths' }),
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
        '/api/projects/1/turns/1/select',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ freeText: 'None of these fit our use case' }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'None of these fit our use case' });
    });
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
