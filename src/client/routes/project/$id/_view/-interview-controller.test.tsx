// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '@/shared/api-types.js';
import type { BrunchUIMessage } from '@/shared/chat.js';

import { useInterviewController } from './-interview-controller.js';

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

let currentProjectState: ProjectState;
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
  useLoaderData: ({ from }: { from: string }) => {
    if (from === '/project/$id') return currentProjectState;
    throw new Error(`Unexpected useLoaderData from: ${from}`);
  },
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
          status: 'in_progress',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: 1,
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
        turn_kind: 'question',
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
  const workspace = useInterviewController('scope');

  return (
    <div>
      <div data-testid="project-name">{workspace.project.name}</div>
      <div data-testid="messages">{messageText(workspace.chat.messages)}</div>
      <div data-testid="turn-card-kind">{workspace.turnCard?.kind ?? 'none'}</div>
      <div data-testid="turn-card">
        {workspace.turnCard?.kind === 'persisted-turn'
          ? workspace.turnCard.turn.question
          : workspace.turnCard?.kind === 'pending-question'
            ? workspace.turnCard.pendingQuestion.question
            : workspace.turnCard?.kind === 'kickoff'
              ? `${workspace.turnCard.kickoff.mode}:${workspace.turnCard.kickoff.phase}`
              : workspace.turnCard?.kind === 'recovery'
                ? `recovery:${workspace.turnCard.recovery.phase}`
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
  currentProjectState = createProjectState();
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

describe('interview controller', () => {
  it('projects a kickoff turn card when an open phase has no active frontier turn yet', async () => {
    currentProjectState = createProjectState({ assistantText: '', answer: '' });
    currentProjectState.project.active_turn_id = null;
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.turns = [];

    renderController();

    expect((await screen.findByTestId('turn-card-kind')).textContent).toBe('kickoff');
    expect(screen.getByTestId('turn-card').textContent).toBe('start:scope');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('false');
  });

  it('projects a recovery turn card when an open phase has a completed turn but no successor frontier', async () => {
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.project.active_turn_id = null;

    renderController();

    expect((await screen.findByTestId('turn-card-kind')).textContent).toBe('recovery');
    expect(screen.getByTestId('turn-card').textContent).toBe('recovery:scope');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('false');
  });

  it('projects a pending-question turn card from the streamed ask_question part before route invalidation', async () => {
    currentProjectState = createProjectState({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderController();

    expect((await screen.findByTestId('turn-card')).textContent).toBe('none');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('false');

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

  it('seeds chat state from loader data without a post-mount entity fetch', async () => {
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });

    renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );
    expect(screen.getByTestId('turn-card').textContent).toBe('recovery:scope');
    expect(screen.getByTestId('turn-card-kind').textContent).toBe('recovery');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('false');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rehydrates the transcript on explicit project navigation', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );

    currentProjectState = createProjectState({
      projectId: 2,
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
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
    });
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('invalidates the router when the chat stream emits an observer result', async () => {
    renderController();

    await screen.findByTestId('messages');

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
      expect(routerInvalidate).toHaveBeenCalled();
    });
  });

  it('keeps the live transcript stable on same-project refresh', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );

    currentProjectState = createProjectState({
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
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
  });
});
