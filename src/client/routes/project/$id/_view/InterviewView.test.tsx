// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProjectState } from '@/shared/api-types.js';
import type { BrunchUIMessage } from '@/shared/chat.js';

import { InterviewView } from './-interview-view.js';

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
  setStatus?: (status: 'ready' | 'submitted' | 'streaming') => void;
  onData?: UseChatOptions['onData'];
  onFinish?: UseChatOptions['onFinish'];
};

let currentProjectState: ProjectState;
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
  Link: ({
    children,
    to,
    params,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string; params?: { id: string } }) => (
    <a href={to?.replace('$id', params?.id ?? '')} {...props}>
      {children}
    </a>
  ),
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
      constructor(_options: unknown) {}
    },
  };
});

vi.mock('@/client/components/ai-elements/conversation', () => ({
  Conversation: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ConversationScrollButton: () => null,
}));

vi.mock('@/client/components/ai-elements/message', () => ({
  Message: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MessageResponse: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/client/components/ai-elements/prompt-input', () => ({
  PromptInput: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PromptInputSubmit: () => <button type="button">Send</button>,
  PromptInputTextarea: () => <textarea aria-label="Type a message..." />,
}));

vi.mock('@/client/components/ai-elements/reasoning', () => ({
  Reasoning: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReasoningContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ReasoningTrigger: () => null,
}));

vi.mock('@/client/components/ai-elements/tool', () => ({
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
  turns,
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
  turns?: ProjectState['turns'];
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
    turns: turns ?? [
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

function createWorkflowState(
  overrides?: Partial<
    Record<keyof ProjectState['workflow']['phases'], Partial<ProjectState['workflow']['phases']['scope']>>
  >,
): ProjectState['workflow'] {
  const defaultPhase = {
    status: 'unstarted' as const,
    closeability: false,
    readiness: 'low' as const,
    closureBasis: null,
    proposalPending: false,
    turnId: null,
    summary: null,
  };

  return {
    phases: {
      scope: { ...defaultPhase, ...overrides?.scope },
      design: { ...defaultPhase, ...overrides?.design },
      requirements: { ...defaultPhase, ...overrides?.requirements },
      criteria: { ...defaultPhase, ...overrides?.criteria },
    },
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
  turns,
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
  turns?: ProjectState['turns'];
} = {}): { projectState: ProjectState } {
  return {
    projectState: createProjectState({
      projectId,
      assistantText,
      answer,
      userParts,
      options,
      workflow,
      assistantParts,
      turns,
    }),
  };
}

function setLoaderData(data: { projectState: ProjectState }) {
  currentProjectState = data.projectState;
}

function createUseChatHarness(initialStatus: 'ready' | 'submitted' | 'streaming' = 'ready'): (
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
    const statusStates = useState(() => new Map<string, 'ready' | 'submitted' | 'streaming'>())[0];
    const chatId = options.id ?? 'default';

    if (!chatStates.has(chatId)) {
      chatStates.set(chatId, options.messages);
    }
    if (!statusStates.has(chatId)) {
      statusStates.set(chatId, initialStatus);
    }

    const stableSetMessages = useCallback(
      (nextMessages: BrunchUIMessage[]) => {
        setMessagesSpy(nextMessages);
        chatStates.set(chatId, nextMessages);
        forceRender((count) => count + 1);
      },
      [chatId, chatStates],
    );
    const stableSetStatus = useCallback(
      (nextStatus: 'ready' | 'submitted' | 'streaming') => {
        statusStates.set(chatId, nextStatus);
        forceRender((count) => count + 1);
      },
      [chatId, statusStates],
    );

    useChatHarness.onData = options.onData;
    useChatHarness.onFinish = options.onFinish;
    useChatHarness.replaceMessages = stableSetMessages;
    useChatHarness.setStatus = stableSetStatus;

    return {
      messages: chatStates.get(chatId) ?? options.messages,
      sendMessage,
      setMessages: stableSetMessages,
      status: statusStates.get(chatId) ?? initialStatus,
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

function renderWorkspace(phase: 'scope' | 'design' | 'requirements' | 'criteria' = 'scope') {
  const queryClient = createQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <InterviewView phase={phase} />
    </QueryClientProvider>,
  );

  return {
    ...rendered,
    queryClient,
  };
}

beforeEach(() => {
  setLoaderData(createWorkspaceLoaderData());
  routerInvalidate.mockClear();
  fetchMock.mockReset();
  useChatImpl = createUseChatHarness();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InterviewView', () => {
  // TODO: re-enable when auto-present is restored after phase-closure rework
  it.skip('auto-presents the first turn for the current open phase instead of showing a begin button', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
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
      }),
    );

    renderWorkspace();

    expect(await screen.findByTestId('workspace-state-card')).toBeTruthy();
    expect(screen.getByText('Preparing the next interview turn')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Begin Framing' })).toBeNull();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'Begin the grounding phase.' });
    });
  });

  // TODO: re-enable when auto-present is restored after phase-closure rework
  it.skip('auto-continues an open phase instead of showing a continue card when the last turn is already answered', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
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
      }),
    );

    renderWorkspace();

    expect(await screen.findByText('Preparing the next interview turn')).toBeTruthy();
    expect(screen.queryByText('Continue Framing')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ask for the next step' })).toBeNull();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'Continue the grounding phase.' });
    });
  });

  it('hides the header phase action for an unstarted reachable phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
        workflow: createWorkflowState(),
      }),
    );

    renderWorkspace();

    expect(screen.getByText('Phase 1/4 – Grounding')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
    expect(screen.queryByRole('link', { name: /advance to/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open export preview' })).toBeNull();
  });

  it('hides the header phase action when a phase is in progress but not closeable', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          scope: { status: 'in_progress', turnId: 1 },
        }),
      }),
    );

    renderWorkspace();

    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
    expect(screen.queryByRole('link', { name: /advance to/i })).toBeNull();
  });

  it('shows the header close action only when the phase is closeable', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          scope: { status: 'in_progress', closeability: true, readiness: 'medium', turnId: 1 },
        }),
      }),
    );

    renderWorkspace();

    expect(screen.getByRole('button', { name: 'Close Phase' })).toBeTruthy();
  });

  it('shows an advance CTA in the header for a closed phase with a next phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          scope: { status: 'closed', readiness: 'high', summary: 'Grounding complete.' },
          design: { status: 'unstarted' },
        }),
      }),
    );

    renderWorkspace();

    const advanceLink = screen.getByRole('link', { name: 'Advance to Elicitation' });
    expect(advanceLink.getAttribute('href')).toBe('/project/1/elicitation');
    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
  });

  it('shows an export CTA in the header for the closed final phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          scope: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: { status: 'closed', readiness: 'high' },
          criteria: {
            status: 'closed',
            readiness: 'high',
            summary: 'Acceptance criteria review is complete.',
          },
        }),
      }),
    );

    renderWorkspace('criteria');

    const exportLinks = screen.getAllByRole('link', { name: 'Open export preview' });
    expect(exportLinks[0]?.getAttribute('href')).toBe('/project/1/export');
    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
  });

  it('renders historical completed turns as compact answered cards instead of replay placeholders', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            project_id: 1,
            parent_turn_id: null,
            phase: 'scope',
            question: 'What should we build first?',
            why: 'This frames the first iteration.',
            impact: 'high',
            answer: 'Build the web app',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Build the web app' }]),
            assistant_parts: JSON.stringify([
              {
                type: 'tool-ask_question',
                toolCallId: 'tool-1',
                state: 'output-available',
                input: {
                  question: 'What should we build first?',
                  why: 'This frames the first iteration.',
                  impact: 'high',
                  options: [
                    { content: 'Web', is_recommended: true },
                    { content: 'Desktop', is_recommended: false },
                  ],
                },
                output: { ok: true, turnId: 1, optionCount: 2 },
              },
              {
                type: 'data-observer-result',
                data: {
                  entityIds: {
                    goals: [1],
                    terms: [],
                    contexts: [],
                    constraints: [],
                    requirements: [],
                    criteria: [],
                    decisions: [],
                    assumptions: [],
                  },
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
            ],
            captured_items: [
              {
                collection: 'knowledge_item',
                kind: 'goal',
                id: 1,
                content: 'Ship the web app first',
                referenceCode: 'GOAL1',
              },
            ],
          },
          {
            id: 2,
            project_id: 1,
            parent_turn_id: 1,
            phase: 'scope',
            question: 'Which platform should we target now?',
            why: 'Platform shapes the next build.',
            impact: 'medium',
            answer: 'Ship the desktop app',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Ship the desktop app' }]),
            assistant_parts: JSON.stringify([{ type: 'text', text: 'Which platform should we target now?' }]),
            created_at: '2026-04-03 10:05:00',
            options: [],
          },
        ],
        workflow: {
          phases: {
            scope: {
              status: 'in_progress',
              closeability: false,
              readiness: 'low',
              closureBasis: null,
              proposalPending: false,
              turnId: 2,
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
      }),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByTestId('answered-turn-card')).toHaveLength(2);
    });
    const answeredCards = screen.getAllByTestId('answered-turn-card');
    expect(answeredCards[0].textContent).toContain('What should we build first?');
    expect(answeredCards[0].textContent).toContain('Build the web app');
    expect(answeredCards[0].textContent).toContain('GOAL1');
    expect(answeredCards[0].textContent).toContain('Ship the web app first');
  });

  it('renders continue/start control actions as control markers instead of user chat bubbles', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
        workflow: {
          phases: {
            scope: {
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
      }),
    );

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'u-control', role: 'user', parts: [{ type: 'text', text: 'Continue the grounding phase.' }] },
      ]);
    });

    expect(await screen.findByText('Interview resumed')).toBeTruthy();
    expect(screen.queryByText('Continue the grounding phase.')).toBeNull();
  });

  it('filters closure control turns out of answered-turn replay', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            project_id: 1,
            parent_turn_id: null,
            phase: 'scope',
            question: 'What should we build first?',
            why: 'This frames the first iteration.',
            impact: 'high',
            answer: 'Build the web app',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Build the web app' }]),
            assistant_parts: JSON.stringify([{ type: 'text', text: 'What should we build first?' }]),
            created_at: '2026-04-03 10:00:00',
            options: [],
          },
          {
            id: 2,
            project_id: 1,
            parent_turn_id: 1,
            phase: 'scope',
            question: 'Closure proposal',
            why: null,
            impact: null,
            answer: 'Confirm grounding closure',
            is_resolution: true,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 2, phase: 'scope' },
              },
            ]),
            assistant_parts: JSON.stringify([
              {
                type: 'data-phase-summary',
                data: {
                  turnId: 2,
                  phase: 'scope',
                  summary: 'Goals, terms, context, and constraints are sufficiently captured.',
                },
              },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [],
          },
        ],
        workflow: {
          phases: {
            scope: {
              status: 'closed',
              closeability: false,
              readiness: 'high',
              closureBasis: 'interviewer_recommended',
              proposalPending: false,
              turnId: 2,
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
      }),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(screen.getAllByTestId('answered-turn-card')).toHaveLength(1);
    });
    expect(screen.getByTestId('answered-turn-card').textContent).toContain('What should we build first?');
    expect(screen.getByTestId('answered-turn-card').textContent).not.toContain('Closure proposal');
    expect(screen.getByTestId('answered-turn-card').textContent).not.toContain('Confirm grounding closure');
  });

  it('keeps later-phase active turns out of a closed phase and stages the handoff card at the bottom', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            project_id: 1,
            parent_turn_id: null,
            phase: 'scope',
            question: 'What should we build first?',
            why: 'This frames the first iteration.',
            impact: 'high',
            answer: 'Build the web app',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Build the web app' }]),
            assistant_parts: JSON.stringify([{ type: 'text', text: 'What should we build first?' }]),
            created_at: '2026-04-03 10:00:00',
            options: [],
          },
          {
            id: 2,
            project_id: 1,
            parent_turn_id: 1,
            phase: 'design',
            question: 'Which architecture should we choose next?',
            why: 'This shapes implementation commitments.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Which architecture should we choose next?' },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [{ id: 21, position: 0, content: 'Monolith', is_recommended: true, is_selected: false }],
          },
        ],
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
              readiness: 'medium',
              closureBasis: null,
              proposalPending: false,
              turnId: 2,
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
      }),
    );

    renderWorkspace();

    const answeredCard = await screen.findByTestId('answered-turn-card');
    const handoffCard = await screen.findByTestId('workspace-state-card');

    expect(answeredCard.textContent).toContain('What should we build first?');
    expect(screen.queryByText('Which architecture should we choose next?')).toBeNull();
    expect(handoffCard.textContent).toContain('Grounding phase is complete');
    expect(answeredCard.compareDocumentPosition(handoffCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the turn card from a pending-question tool part before route invalidation', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Earlier question?',
        answer: 'Earlier answer',
      }),
    );
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace();

    expect((await screen.findByTestId('answered-turn-card')).textContent).toContain('Earlier question?');
    expect(screen.queryByText('Which platform should we target next?')).toBeNull();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();
    expect(screen.getByText('Preparing the next interview turn')).toBeTruthy();

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

  it('refreshes durable loader-owned state for the same project without rewriting the live transcript', async () => {
    setLoaderData(createWorkspaceLoaderData());

    const rendered = renderWorkspace();
    expect((await screen.findByTestId('answered-turn-card')).textContent).toContain(
      'What should we build first?',
    );

    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Which platform should we target now?',
        answer: 'Ship the desktop app',
      }),
    );
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InterviewView phase="scope" />
      </QueryClientProvider>,
    );

    expect(screen.getByTestId('answered-turn-card').textContent).toContain('What should we build first?');
    expect(screen.queryByText('Which platform should we target now?')).toBeNull();
    expect(screen.queryByText('Ship the desktop app')).toBeNull();
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('hydrates persisted transcript state when navigating to a different project', async () => {
    const rendered = renderWorkspace();
    expect((await screen.findByTestId('answered-turn-card')).textContent).toContain(
      'What should we build first?',
    );

    setLoaderData(
      createWorkspaceLoaderData({
        projectId: 2,
        assistantText: 'How should project two start?',
        answer: 'Begin with the API',
      }),
    );
    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InterviewView phase="scope" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('How should project two start?');
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('Begin with the API');
    });

    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('posts single-option turn responses with optional free-text and forwards a combined summary into chat', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );

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
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
          { id: 13, position: 2, content: 'Mobile', is_recommended: false, is_selected: false },
        ],
      }),
    );

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
    setLoaderData(
      createWorkspaceLoaderData({
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
      }),
    );

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /confirm grounding closure/i }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Confirm grounding closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'scope' },
          },
        ],
      });
    });
  });

  it('submits a force-close action for design through chat with typed confirmation parts', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
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
      }),
    );

    renderWorkspace('design');

    fireEvent.click(await screen.findByRole('button', { name: /force elicitation closure/i }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Force elicitation closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'force-close-active-phase', phase: 'design' },
          },
        ],
      });
    });
  });

  it('hides the force-close action when design already has a pending closure proposal', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
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
      }),
    );

    renderWorkspace('design');

    expect(screen.queryByRole('button', { name: /force elicitation closure/i })).toBeNull();
  });

  it('posts free-text-only turn responses and forwards the text into chat', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );

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

  it('keeps the submitted turn card mounted and locked while interviewer processing', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );

    routerInvalidate.mockImplementationOnce(async () => {
      setLoaderData(
        createWorkspaceLoaderData({
          answer: 'Desktop — Best fit for our launch',
          userParts: [
            { type: 'text', text: 'Desktop — Best fit for our launch' },
            {
              type: 'data-turn-response',
              data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for our launch' },
            },
          ],
          options: [
            { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
            { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
          ],
        }),
      );
    });
    useChatHarness.sendMessage.mockImplementation(async () => {
      useChatHarness.setStatus?.('submitted');
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
      expect(screen.getByTestId('turn-processing-state').textContent).toContain(
        'Interviewer is processing this response.',
      );
    });

    const responseContext = screen.getByLabelText('Additional response context') as HTMLTextAreaElement;
    const desktopOption = screen.getByRole('checkbox', { name: /desktop/i }) as HTMLInputElement;

    expect(screen.getByText('What should we build first?')).toBeTruthy();
    expect(screen.queryByText('Preparing the next interview turn')).toBeNull();
    expect(responseContext.value).toBe('Best fit for our launch');
    expect(responseContext.disabled).toBe(true);
    expect(desktopOption.checked).toBe(true);
    expect(desktopOption.disabled).toBe(true);
  });

  it('collapses a submitted turn into an answered card only when interviewer completion reveals the next step', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );

    routerInvalidate.mockImplementationOnce(async () => {
      setLoaderData(
        createWorkspaceLoaderData({
          answer: 'Desktop — Best fit for our launch',
          userParts: [
            { type: 'text', text: 'Desktop — Best fit for our launch' },
            {
              type: 'data-turn-response',
              data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for our launch' },
            },
          ],
          options: [
            { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
            { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
          ],
        }),
      );
    });
    useChatHarness.sendMessage.mockImplementation(async () => {
      useChatHarness.setStatus?.('submitted');
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
      expect(screen.getByTestId('turn-processing-state')).toBeTruthy();
    });

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'turn-1-answer',
          role: 'user',
          parts: [{ type: 'text', text: 'Desktop — Best fit for our launch' }],
        },
        {
          id: 'turn-1-assistant',
          role: 'assistant',
          parts: [{ type: 'text', text: 'What should we build first?' }],
        },
        createPendingQuestionMessage(),
      ]);
      useChatHarness.setStatus?.('ready');
    });

    await waitFor(() => {
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('What should we build first?');
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('Desktop');
      expect(screen.getByRole('checkbox', { name: /web/i })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /desktop/i })).toBeTruthy();
    });

    expect(screen.queryByTestId('turn-processing-state')).toBeNull();
    expect(screen.queryByText('Preparing the next interview turn')).toBeNull();
  });

  it('keeps trailing observer status attached to the collapsed answered turn and upgrades in place when capture arrives', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );

    routerInvalidate.mockImplementationOnce(async () => {
      setLoaderData(
        createWorkspaceLoaderData({
          answer: 'Desktop — Best fit for our launch',
          userParts: [
            { type: 'text', text: 'Desktop — Best fit for our launch' },
            {
              type: 'data-turn-response',
              data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for our launch' },
            },
          ],
          options: [
            { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
            { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
          ],
        }),
      );
    });
    routerInvalidate.mockImplementationOnce(async () => {
      setLoaderData(
        createWorkspaceLoaderData({
          turns: [
            {
              id: 1,
              project_id: 1,
              parent_turn_id: null,
              phase: 'scope',
              question: 'What should we build first?',
              why: 'This frames the first iteration.',
              impact: 'high',
              answer: 'Desktop — Best fit for our launch',
              is_resolution: false,
              user_parts: JSON.stringify([
                { type: 'text', text: 'Desktop — Best fit for our launch' },
                {
                  type: 'data-turn-response',
                  data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for our launch' },
                },
              ]),
              assistant_parts: JSON.stringify([
                { type: 'text', text: 'What should we build first?' },
                {
                  type: 'data-observer-result',
                  data: {
                    turnId: 1,
                    entityIds: {
                      goals: [],
                      terms: [],
                      contexts: [1],
                      constraints: [],
                      requirements: [],
                      criteria: [],
                      decisions: [],
                      assumptions: [],
                    },
                  },
                },
              ]),
              created_at: '2026-04-03 10:00:00',
              options: [
                { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
                { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
              ],
              captured_items: [
                {
                  collection: 'knowledge_item',
                  kind: 'context',
                  id: 1,
                  content: 'The launch still targets desktop first',
                  referenceCode: 'CTX1',
                },
              ],
            },
          ],
        }),
      );
    });
    useChatHarness.sendMessage.mockImplementation(async () => {
      useChatHarness.setStatus?.('submitted');
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
      expect(screen.getByTestId('turn-processing-state')).toBeTruthy();
    });

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'turn-1-answer',
          role: 'user',
          parts: [{ type: 'text', text: 'Desktop — Best fit for our launch' }],
        },
        {
          id: 'turn-1-assistant',
          role: 'assistant',
          parts: [{ type: 'text', text: 'What should we build first?' }],
        },
        createPendingQuestionMessage(),
      ]);
      useChatHarness.setStatus?.('ready');
    });

    await waitFor(() => {
      expect(screen.getByTestId('answered-turn-card').textContent).toContain(
        'Capturing knowledge from this answer…',
      );
      expect(screen.getByRole('checkbox', { name: /web/i })).toBeTruthy();
    });
    expect(screen.queryByTestId('observer-result-placeholder')).toBeNull();

    await act(async () => {
      useChatHarness.onData?.({
        type: 'data-observer-result',
        data: {
          turnId: 1,
          entityIds: {
            goals: [],
            terms: [],
            contexts: [1],
            constraints: [],
            requirements: [],
            criteria: [],
            decisions: [],
            assumptions: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('CTX1');
      expect(screen.getByTestId('answered-turn-card').textContent).toContain(
        'The launch still targets desktop first',
      );
      expect(screen.queryByText('Applying captured knowledge to this answer…')).toBeNull();
    });
  });

  it('renders persisted selected options inside the compact answered card even when option flags are false', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
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
      }),
    );

    renderWorkspace();

    const answeredCard = await screen.findByTestId('answered-turn-card');

    expect(answeredCard.textContent).toContain('Desktop');
    expect(answeredCard.textContent).toContain('Best fit for launch');
  });

  it('renders a compact answered card for a persisted free-text-only response', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
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
      }),
    );

    renderWorkspace();

    const answeredCard = await screen.findByTestId('answered-turn-card');

    expect(answeredCard.textContent).toContain('None of the above');
    expect(answeredCard.textContent).toContain('None of these fit our use case');
    expect(screen.queryByLabelText('Additional response context')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /web/i })).toBeNull();
  });

  it('shows a visible error when saving an option selection fails', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
      }),
    );

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
