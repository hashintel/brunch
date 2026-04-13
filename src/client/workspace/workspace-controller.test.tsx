// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '@/shared/api-types.js';
import type { BrunchUIMessage } from '@/shared/chat.js';

import { useWorkspaceController } from './workspace-controller.js';
import type { WorkspaceLoaderData } from './workspace-loader.js';

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
const chatTransportOptions: unknown[] = [];
let useChatImpl: (options: UseChatOptions) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text?: string; parts?: Array<Record<string, unknown>> }) => Promise<void> | void;
  setMessages: (messages: BrunchUIMessage[]) => void;
  status: 'ready' | 'submitted' | 'streaming';
};
let useChatHarness: UseChatHarness;

vi.mock('@tanstack/react-router', () => ({
  useLoaderData: () => currentLoaderData,
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
      constructor(options: unknown) {
        chatTransportOptions.push(options);
      }
    },
  };
});

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
      mode: 'greenfield',
      cwd: null,
      active_turn_id: 1,
      created_at: '2026-04-03 10:00:00',
      updated_at: '2026-04-03 10:00:00',
    },
    workflow: {
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

function createUseChatHarness(status: 'ready' | 'submitted' | 'streaming' = 'ready') {
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

function messageText(messages: readonly BrunchUIMessage[]) {
  return messages
    .flatMap(
      (message) => message.parts?.filter((part) => part.type === 'text').map((part) => part.text) ?? [],
    )
    .join('|');
}

function ControllerProbe() {
  const workspace = useWorkspaceController();

  return (
    <div>
      <div data-testid="project-name">{workspace.project.name}</div>
      <div data-testid="messages">{messageText(workspace.chat.messages)}</div>
      <div data-testid="decisions">
        {workspace.entityState.decisions.map((decision) => decision.content).join('|') || 'none'}
      </div>
      <div data-testid="turn-card-kind">{workspace.turnCard?.kind ?? 'none'}</div>
      <div data-testid="turn-card">
        {workspace.turnCard?.kind === 'persisted-turn'
          ? workspace.turnCard.turn.question
          : workspace.turnCard?.kind === 'pending-question'
            ? workspace.turnCard.pendingQuestion.question
            : 'none'}
      </div>
      <div data-testid="prompt-visible">{String(workspace.promptInput.visible)}</div>
    </div>
  );
}

function renderController() {
  const queryClient = createQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ControllerProbe />
    </QueryClientProvider>,
  );

  return { ...rendered, queryClient };
}

beforeEach(() => {
  currentLoaderData = createWorkspaceLoaderData();
  routerInvalidate.mockClear();
  fetchMock.mockReset();
  chatTransportOptions.length = 0;
  useChatImpl = createUseChatHarness();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('workspace controller', () => {
  it('projects a pending-question turn card from the streamed ask_question part before route invalidation', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderController();

    expect((await screen.findByTestId('turn-card')).textContent).toBe('none');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('true');

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingQuestionMessage(),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('turn-card-kind').textContent).toBe('pending-question');
      expect(screen.getByTestId('turn-card').textContent).toBe('Which platform should we target next?');
      expect(screen.getByTestId('prompt-visible').textContent).toBe('false');
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('seeds chat and entity state from loader data without a post-mount entity fetch', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
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

    renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );
    expect(screen.getByTestId('decisions').textContent).toBe('Start with the web app');
    expect(screen.getByTestId('turn-card').textContent).toBe('What should we build first?');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rehydrates the transcript on explicit project navigation', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );

    currentLoaderData = createWorkspaceLoaderData({
      projectId: 2,
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
            project_id: 2,
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
        <ControllerProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-name').textContent).toBe('Project 2');
      expect(screen.getByTestId('messages').textContent).toBe(
        'Ship the desktop app|Which platform should we target now?',
      );
      expect(screen.getByTestId('decisions').textContent).toBe('Prefer the desktop app');
    });
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('uses the loader-backed project id for chat transport and entity refreshes', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      projectId: 1,
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
          criteria: [],
          decisions: [
            {
              id: 9,
              project_id: 1,
              content: 'Start with the web app',
              rationale: 'Observer extracted a new decision',
            },
          ],
          assumptions: [],
          relationships: [],
        } satisfies EntitiesData),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    renderController();

    expect((await screen.findByTestId('decisions')).textContent).toBe('none');

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
            decisions: [9],
            assumptions: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(chatTransportOptions).toContainEqual({ api: '/api/projects/1/chat' });
      expect(fetchMock).toHaveBeenCalledWith('/api/projects/1/entities');
      expect(screen.getByTestId('decisions').textContent).toBe('Start with the web app');
    });
  });

  it('ignores stale entity refetches after a route transition seeds a new loader snapshot', async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    const rendered = renderController();
    expect((await screen.findByTestId('decisions')).textContent).toBe('none');

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
            decisions: [9],
            assumptions: [],
          },
        },
      });
    });

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
            rationale: 'Fresh loader snapshot',
          },
        ],
        assumptions: [],
        relationships: [],
      },
    });
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ControllerProbe />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('decisions').textContent).toBe('Prefer the desktop app');

    resolveFetch?.(
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
              id: 9,
              project_id: 1,
              content: 'Stale observer decision',
              rationale: 'Should not survive the route transition',
            },
          ],
          assumptions: [],
          relationships: [],
        } satisfies EntitiesData),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    await waitFor(() => {
      expect(screen.getByTestId('decisions').textContent).toBe('Prefer the desktop app');
    });
  });

  it('keeps the live transcript stable on same-project refresh while updating durable entities', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );

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
        <ControllerProbe />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('messages').textContent).toBe('Build the web app|What should we build first?');
    expect(screen.getByTestId('messages').textContent).not.toBe(
      'Ship the desktop app|Which platform should we target now?',
    );
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.getByTestId('decisions').textContent).toBe('Prefer the desktop app');
    });
  });
});
