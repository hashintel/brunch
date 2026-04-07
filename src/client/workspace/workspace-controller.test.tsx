// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
import type { BrunchUIMessage } from '../../shared/chat.js';
import { useWorkspaceController } from './workspace-controller.js';
import type { WorkspaceLoaderData } from './workspace-loader.js';

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
  entitySnapshot = { framing: [], decisions: [], assumptions: [], relationships: [] } satisfies EntitiesData,
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

function messageText(messages: BrunchUIMessage[]) {
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
      <div data-testid="turn-card">{workspace.turnCard?.turn.question ?? 'none'}</div>
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
  useChatImpl = createUseChatHarness();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('workspace controller', () => {
  it('projects a live turn card from the streamed ask_question part before route invalidation', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderController();

    expect((await screen.findByTestId('turn-card')).textContent).toBe('none');
    expect(screen.getByTestId('prompt-visible').textContent).toBe('true');

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
      expect(screen.getByTestId('turn-card').textContent).toBe('Which platform should we target next?');
      expect(screen.getByTestId('prompt-visible').textContent).toBe('false');
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('seeds chat and entity state from loader data without a post-mount entity fetch', async () => {
    currentLoaderData = createWorkspaceLoaderData({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
      entitySnapshot: {
        framing: [],
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

    await waitFor(() => {
      expect(useChatHarness.setMessages).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps the live transcript stable on same-project refresh while updating durable entities', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );
    await waitFor(() => {
      expect(useChatHarness.setMessages).toHaveBeenCalledTimes(1);
    });
    useChatHarness.setMessages.mockClear();

    currentLoaderData = createWorkspaceLoaderData({
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
      entitySnapshot: {
        framing: [],
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
