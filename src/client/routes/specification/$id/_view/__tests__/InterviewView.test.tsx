// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';
import type { BrunchUIMessage, ReviewSetData, StructuredQuestion } from '@/shared/chat.js';
import { createKnowledgeReferenceCode } from '@/shared/knowledge.js';
import { deriveSpecificationLanding } from '@/shared/specification-state.js';
import type { SpecificationState, SpecificationTurn } from '@/shared/specification.js';

import { InterviewView } from '../-interview-view.js';
import { resetSpecificationLifecycleRegistryForTesting } from '../-specification-lifecycle.js';

const pendingPreface = {
  observation: 'The repo already uses SQLite-backed local persistence.',
  elaboration: 'This is provisional context for the next move.',
};

function createPendingPrefaceMessage(): BrunchUIMessage {
  return {
    id: 'pending-preface-assistant',
    role: 'assistant',
    parts: [
      {
        type: 'tool-present_preface',
        toolCallId: 'tool-preface',
        state: 'output-available',
        input: pendingPreface,
        output: { ok: true, turnId: 2 },
      },
    ],
  };
}

function createPendingQuestionMessage(overrides?: { parts?: BrunchUIMessage['parts'] }): BrunchUIMessage {
  return {
    id: 'pending-question-assistant',
    role: 'assistant',
    parts: overrides?.parts ?? [
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

function createUnacknowledgedQuestionMessage(): BrunchUIMessage {
  return createPendingQuestionMessage({
    parts: [
      {
        type: 'tool-ask_question',
        toolCallId: 'tool-1',
        state: 'input-available',
        input: {
          question: 'Which platform should we target next?',
          why: 'Platform shapes the first build.',
          impact: 'high',
          options: [
            { content: 'Web', is_recommended: true },
            { content: 'Desktop', is_recommended: false },
          ],
        },
      },
    ],
  });
}

function createPendingReviewMessage(): BrunchUIMessage {
  return {
    id: 'pending-review-assistant',
    role: 'assistant',
    parts: [
      {
        type: 'tool-ask_question',
        toolCallId: 'tool-review',
        state: 'output-available',
        input: {
          question: 'Please review the current requirement set.',
          why: 'Review the whole requirement set before moving forward.',
          impact: 'high',
          options: [
            { content: 'Accept review', is_recommended: true },
            { content: 'Request changes', is_recommended: false },
          ],
          reviewActions: [
            { action: 'accept', optionPosition: 0 },
            { action: 'request-changes', optionPosition: 1 },
          ],
          reviewSet: {
            phase: 'requirements',
            title: 'Requirements',
            items: [
              {
                reviewItemId: 'requirements:1',
                content: 'Export the reviewed specification as markdown',
                referenceCode: createKnowledgeReferenceCode('requirement', 1),
              },
            ],
          },
        },
        output: { ok: true, turnId: 2, optionCount: 2 },
      },
    ],
  };
}

function createPendingCriteriaRevisionMessage(): BrunchUIMessage {
  return {
    id: 'pending-criteria-review-assistant',
    role: 'assistant',
    parts: [
      {
        type: 'tool-ask_question',
        toolCallId: 'tool-criteria-review',
        state: 'output-available',
        input: {
          question: 'Please review the revised criterion set.',
          why: 'Review the revised criterion set before moving forward.',
          impact: 'high',
          options: [
            { content: 'Accept review', is_recommended: true },
            { content: 'Request changes', is_recommended: false },
          ],
          reviewActions: [
            { action: 'accept', optionPosition: 0 },
            { action: 'request-changes', optionPosition: 1 },
          ],
          reviewSet: {
            phase: 'criteria',
            title: 'Acceptance Criteria',
            items: [
              {
                reviewItemId: 'criteria:1',
                content: 'Restarting restores the active path after a full reload',
              },
              {
                reviewItemId: 'criteria:3',
                referenceCode: createKnowledgeReferenceCode('criterion', 3),
                content:
                  'Accepted regenerated review cards preserve carried rationale and grounding metadata',
                rationale: 'Keeps the criteria transcript legible while the review is still pending.',
                grounding: [{ code: createKnowledgeReferenceCode('requirement', 3) }],
              },
            ],
          },
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
  onError?: (error: Error) => void;
};

type UseChatHarness = {
  sendMessage: ReturnType<typeof vi.fn>;
  setMessages: ReturnType<typeof vi.fn>;
  replaceMessages?: (messages: BrunchUIMessage[]) => void;
  setStatus?: (status: 'ready' | 'submitted' | 'streaming' | 'error') => void;
  setError?: (error: Error | undefined) => void;
  onData?: UseChatOptions['onData'];
  onFinish?: UseChatOptions['onFinish'];
  onError?: UseChatOptions['onError'];
};

const useSpecificationEntitiesSpy = vi.hoisted(() => vi.fn());

let currentSpecificationState: SpecificationState;
let currentEntityState: EntitiesData;
const routerInvalidate = vi.fn(async () => {});
const entityInvalidate = vi.fn(async () => {});
const promoteStreamedFrontierTurnToBundle = vi.fn(
  (promotion: {
    turnId: number;
    phase: SpecificationTurn['phase'];
    question: {
      question: string;
      why: string | null;
      impact: SpecificationTurn['impact'];
      options: readonly {
        position: number;
        content: string;
        is_recommended: boolean;
      }[];
      reviewActions?: StructuredQuestion['reviewActions'];
      reviewSet?: ReviewSetData;
    };
  }) => {
    const existingTurn = currentSpecificationState.turns.find((turn) => turn.id === promotion.turnId);
    const promotedTurn: SpecificationTurn = {
      id: promotion.turnId,
      specification_id: currentSpecificationState.specification.id,
      parent_turn_id: existingTurn?.parent_turn_id ?? currentSpecificationState.specification.active_turn_id,
      phase: promotion.phase,
      turn_kind: 'question',
      question: promotion.question.question,
      why: promotion.question.why,
      impact: promotion.question.impact,
      answer: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: JSON.stringify([
        {
          type: 'tool-ask_question',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: {
            question: promotion.question.question,
            why: promotion.question.why,
            impact: promotion.question.impact,
            options: promotion.question.options.map((option) => ({
              content: option.content,
              is_recommended: option.is_recommended,
            })),
            ...(promotion.question.reviewActions ? { reviewActions: promotion.question.reviewActions } : {}),
            ...(promotion.question.reviewSet ? { reviewSet: promotion.question.reviewSet } : {}),
          },
          output: { ok: true, turnId: promotion.turnId, optionCount: promotion.question.options.length },
        },
        ...(promotion.question.reviewSet
          ? [{ type: 'data-review-set', data: promotion.question.reviewSet }]
          : []),
      ]),
      created_at: existingTurn?.created_at ?? '2026-04-30 10:00:00',
      options: promotion.question.options.map((option) => ({
        id: option.position + 1,
        position: option.position,
        content: option.content,
        is_recommended: option.is_recommended,
        is_selected: false,
      })),
      captured_items: [],
    };

    currentSpecificationState = {
      ...currentSpecificationState,
      specification: {
        ...currentSpecificationState.specification,
        active_turn_id: promotion.turnId,
      },
      workflow: {
        ...currentSpecificationState.workflow,
        phases: {
          ...currentSpecificationState.workflow.phases,
          [promotion.phase]: {
            ...currentSpecificationState.workflow.phases[promotion.phase],
            status: 'in_progress',
            turnId: promotion.turnId,
          },
        },
      },
      landing: { kind: 'frontier-turn', phase: promotion.phase, turnId: promotion.turnId },
      turns: [
        ...currentSpecificationState.turns.filter((turn) => turn.id !== promotion.turnId),
        promotedTurn,
      ],
    };
  },
);
const routerNavigate = vi.fn(async () => {});
const fetchMock = vi.fn<typeof fetch>();
let useChatImpl: (options: UseChatOptions) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text?: string; parts?: Array<Record<string, unknown>> }) => Promise<void> | void;
  setMessages: (messages: BrunchUIMessage[]) => void;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  error?: Error;
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
  useParams: () => ({ id: String(currentSpecificationState.specification!.id) }),
  useRouter: () => ({ navigate: routerNavigate }),
}));

vi.mock('../../-specification-data.js', () => ({
  useSpecificationBundleData: () => currentSpecificationState,
  useSpecificationEntities: useSpecificationEntitiesSpy,
  useInvalidateSpecificationQueryDomains: () => ({
    invalidateSpecificationBundle: routerInvalidate,
    invalidateEntities: entityInvalidate,
  }),
  usePromoteStreamedFrontierTurnToBundle: () => promoteStreamedFrontierTurnToBundle,
  primeSpecificationBundle: vi.fn(),
  primeSpecificationEntities: vi.fn(),
  specificationQueryKeys: {
    bundle: vi.fn(),
    entities: vi.fn(),
  },
}));

vi.mock('@/client/routes/specification/$id/-specification-data.js', () => ({
  useSpecificationBundleData: () => currentSpecificationState,
  useSpecificationEntities: useSpecificationEntitiesSpy,
  useInvalidateSpecificationQueryDomains: () => ({
    invalidateSpecificationBundle: routerInvalidate,
    invalidateEntities: entityInvalidate,
  }),
  usePromoteStreamedFrontierTurnToBundle: () => promoteStreamedFrontierTurnToBundle,
  primeSpecificationBundle: vi.fn(),
  primeSpecificationEntities: vi.fn(),
  specificationQueryKeys: {
    bundle: vi.fn(),
    entities: vi.fn(),
  },
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
  ReasoningTrigger: ({
    children,
    getThinkingMessage,
  }: {
    children?: React.ReactNode;
    getThinkingMessage?: (isStreaming: boolean, duration?: number) => React.ReactNode;
  }) => <div>{children ?? getThinkingMessage?.(false, undefined) ?? null}</div>,
  useReasoning: () => ({
    duration: undefined,
    isOpen: false,
    isStreaming: false,
    setIsOpen: vi.fn(),
  }),
}));

vi.mock('@/client/components/ai-elements/tool', () => ({
  Tool: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolHeader: () => null,
  ToolContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ToolInput: () => null,
  ToolOutput: () => null,
}));

function createSpecificationState({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  userParts = [{ type: 'text', text: answer }] as Array<Record<string, unknown>>,
  options = [],
  phase = 'grounding' as SpecificationTurn['phase'],
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
  phase?: SpecificationTurn['phase'];
  workflow?: SpecificationState['workflow'];
  assistantParts?: Array<Record<string, unknown>>;
  turns?: SpecificationState['turns'];
} = {}): SpecificationState {
  const resolvedTurns = turns ?? [
    {
      id: 1,
      specification_id: projectId,
      parent_turn_id: null,
      phase,
      turn_kind: 'question',
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
  ];

  const projectState: SpecificationState = {
    specification: {
      id: projectId,
      name: `Project ${projectId}`,
      mode: 'greenfield',
      active_turn_id: resolvedTurns.at(-1)?.id ?? null,
      created_at: '2026-04-03 10:00:00',
      updated_at: '2026-04-03 10:00:00',
    },
    workflow: workflow ?? {
      phases: {
        grounding: {
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
    turns: resolvedTurns,
  };

  return {
    ...projectState,
    landing: deriveSpecificationLanding(projectState),
  };
}

function createWorkflowState(
  overrides?: Partial<
    Record<
      keyof SpecificationState['workflow']['phases'],
      Partial<SpecificationState['workflow']['phases']['grounding']>
    >
  >,
): SpecificationState['workflow'] {
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
      grounding: { ...defaultPhase, ...overrides?.grounding },
      design: { ...defaultPhase, ...overrides?.design },
      requirements: { ...defaultPhase, ...overrides?.requirements },
      criteria: { ...defaultPhase, ...overrides?.criteria },
    },
  };
}

function createFillerTurns(
  phase: SpecificationTurn['phase'],
  count: number,
  startId = 100,
): SpecificationTurn[] {
  return Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    specification_id: 1,
    parent_turn_id: null,
    phase,
    turn_kind: 'question' as const,
    question: `Filler question ${i + 1}`,
    why: null,
    impact: 'low' as const,
    answer: `Answer ${i + 1}`,
    is_resolution: false,
    user_parts: JSON.stringify([{ type: 'text', text: `Answer ${i + 1}` }]),
    assistant_parts: JSON.stringify([{ type: 'text', text: `Filler question ${i + 1}` }]),
    created_at: '2026-04-03 10:00:00',
    options: [],
  }));
}

function createEntityState(overrides: Partial<EntitiesData> = {}): EntitiesData {
  return {
    goals: [],
    terms: [],
    contexts: [],
    constraints: [],
    requirements: [],
    criteria: [],
    decisions: [],
    assumptions: [],
    relationships: [],
    ...overrides,
  };
}

function createWorkspaceLoaderData({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  userParts,
  options = [],
  phase,
  workflow,
  assistantParts,
  turns,
  entityState,
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
  phase?: SpecificationTurn['phase'];
  workflow?: SpecificationState['workflow'];
  assistantParts?: Array<Record<string, unknown>>;
  turns?: SpecificationState['turns'];
  entityState?: EntitiesData;
} = {}): { projectState: SpecificationState; entityState: EntitiesData } {
  return {
    projectState: createSpecificationState({
      projectId,
      assistantText,
      answer,
      userParts,
      options,
      phase,
      workflow,
      assistantParts,
      turns,
    }),
    entityState: entityState ?? createEntityState(),
  };
}

function setLoaderData(data: { projectState: SpecificationState; entityState: EntitiesData }) {
  currentSpecificationState = data.projectState;
  currentEntityState = data.entityState;
}

function createUseChatHarness(initialStatus: 'ready' | 'submitted' | 'streaming' = 'ready'): (
  options: UseChatOptions,
) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text?: string; parts?: Array<Record<string, unknown>> }) => Promise<void> | void;
  setMessages: (messages: BrunchUIMessage[]) => void;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  error?: Error;
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
    const statusStates = useState(() => new Map<string, 'ready' | 'submitted' | 'streaming' | 'error'>())[0];
    const errorStates = useState(() => new Map<string, Error | undefined>())[0];
    const chatId = options.id ?? 'default';

    if (!chatStates.has(chatId)) {
      chatStates.set(chatId, options.messages);
    }
    if (!statusStates.has(chatId)) {
      statusStates.set(chatId, initialStatus);
    }
    if (!errorStates.has(chatId)) {
      errorStates.set(chatId, undefined);
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
      (nextStatus: 'ready' | 'submitted' | 'streaming' | 'error') => {
        statusStates.set(chatId, nextStatus);
        forceRender((count) => count + 1);
      },
      [chatId, statusStates],
    );
    const stableSetError = useCallback(
      (nextError: Error | undefined) => {
        errorStates.set(chatId, nextError);
        forceRender((count) => count + 1);
      },
      [chatId, errorStates],
    );

    useChatHarness.onData = options.onData;
    useChatHarness.onFinish = options.onFinish;
    useChatHarness.onError = options.onError;
    useChatHarness.replaceMessages = stableSetMessages;
    useChatHarness.setStatus = stableSetStatus;
    useChatHarness.setError = stableSetError;

    return {
      messages: chatStates.get(chatId) ?? options.messages,
      sendMessage,
      setMessages: stableSetMessages,
      status: statusStates.get(chatId) ?? initialStatus,
      error: errorStates.get(chatId),
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

function renderWorkspace(phase: 'grounding' | 'design' | 'requirements' | 'criteria' = 'grounding') {
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
  useSpecificationEntitiesSpy.mockReset();
  useSpecificationEntitiesSpy.mockImplementation(() => currentEntityState);
  routerInvalidate.mockClear();
  entityInvalidate.mockClear();
  promoteStreamedFrontierTurnToBundle.mockClear();
  routerNavigate.mockClear();
  fetchMock.mockReset();
  useChatImpl = createUseChatHarness();
  resetSpecificationLifecycleRegistryForTesting();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('InterviewView', () => {
  it('keeps entity-query subscription out of the transcript-owning interview view', async () => {
    const rendered = renderWorkspace();

    await screen.findByText('What should we build first?');

    expect(useSpecificationEntitiesSpy).not.toHaveBeenCalled();
  });

  it('auto-presents the current reachable kickoff phase through a typed phase-entry intent', async () => {
    const loaderData = createWorkspaceLoaderData({
      turns: [],
      workflow: createWorkflowState({
        grounding: {
          status: 'closed',
          closeability: false,
          readiness: 'high',
          closureBasis: 'interviewer_recommended',
          proposalPending: false,
          turnId: 11,
          summary: 'Grounding complete.',
        },
        design: {
          status: 'closed',
          closeability: false,
          readiness: 'high',
          closureBasis: 'interviewer_recommended',
          proposalPending: false,
          turnId: 12,
          summary: 'Elicitation complete.',
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
      }),
    });
    expect(loaderData.projectState.landing).toEqual({
      kind: 'kickoff',
      phase: 'requirements',
      mode: 'start',
    });
    setLoaderData(loaderData);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('requirements');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-entry', phase: 'requirements' }),
        }),
      );
    });

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-entry', phase: 'requirements' },
          },
        ],
      });
    });

    expect(await screen.findByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('kickoff-control-card')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Proceed' })).toBeNull();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();
  });

  it('auto-continues the current reachable recovery phase through a typed phase-intent', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 11,
            summary: 'Grounding complete.',
          },
          design: {
            status: 'in_progress',
            closeability: false,
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
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'design',
            turn_kind: 'question',
            question: 'Which platform should we target first?',
            why: 'This chooses the first delivery surface.',
            impact: 'high',
            answer: 'Desktop — Best fit for launch',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Desktop — Best fit for launch' },
              {
                type: 'data-turn-response',
                data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for launch' },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Which platform should we target first?' },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
            ],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-continue', phase: 'design' }),
        }),
      );
    });

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-continue', phase: 'design' },
          },
        ],
      });
    });

    expect(await screen.findByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('recovery-control-card')).toBeNull();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();
  });

  it('falls back to the projected recovery card when auto phase-continue submit rejects', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 11,
            summary: 'Grounding complete.',
          },
          design: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'design',
            turn_kind: 'question',
            question: 'Which platform should we target first?',
            why: 'This chooses the first delivery surface.',
            impact: 'high',
            answer: 'Desktop — Best fit for launch',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Desktop — Best fit for launch' },
              {
                type: 'data-turn-response',
                data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for launch' },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Which platform should we target first?' },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
            ],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    useChatHarness.sendMessage.mockRejectedValueOnce(new Error('chat down'));

    const rendered = renderWorkspace('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });

    const recoveryCard = await screen.findByTestId('recovery-control-card');
    expect(recoveryCard.textContent).toContain('Continue');
    expect(screen.queryByTestId('generating-turn-placeholder')).toBeNull();

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InterviewView phase="design" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('recovery-control-card')).toBeTruthy();
    });
  });

  it('falls back to the projected recovery card when auto phase-continue generation errors after submit', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 11,
            summary: 'Grounding complete.',
          },
          design: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'design',
            turn_kind: 'question',
            question: 'Which platform should we target first?',
            why: 'This chooses the first delivery surface.',
            impact: 'high',
            answer: 'Desktop — Best fit for launch',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Desktop — Best fit for launch' },
              {
                type: 'data-turn-response',
                data: { turnId: 1, selectedOptionIds: [12], freeText: 'Best fit for launch' },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Which platform should we target first?' },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: true },
            ],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    useChatHarness.sendMessage.mockImplementation(async () => {
      useChatHarness.setStatus?.('submitted');
    });

    renderWorkspace('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('generating-turn-placeholder')).toBeTruthy();
    });

    act(() => {
      useChatHarness.setError?.(new Error('x-api-key header is required'));
      useChatHarness.setStatus?.('error');
    });

    const recoveryCard = await screen.findByTestId('recovery-control-card');
    expect(recoveryCard.textContent).toContain('Continue');
    expect(screen.getByRole('alert').textContent).toContain('x-api-key header is required');
    expect(screen.queryByTestId('generating-turn-placeholder')).toBeNull();
  });

  it('hides the header phase action for an unstarted reachable phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
        workflow: createWorkflowState(),
      }),
    );

    const rendered = renderWorkspace();

    expect(screen.getByText('Phase 1/4 – Grounding')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
    expect(screen.queryByRole('link', { name: /advance to/i })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open export preview' })).toBeNull();
  });

  it('hides the header phase action when a phase is in progress but not closeable', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: { status: 'in_progress', turnId: 1 },
        }),
      }),
    );

    const rendered = renderWorkspace();

    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
    expect(screen.queryByRole('link', { name: /advance to/i })).toBeNull();
  });

  it('shows the footer close action when grounding is the active closeable phase with enough turns', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: createFillerTurns('grounding', 3),
        workflow: createWorkflowState({
          grounding: { status: 'in_progress', closeability: true, readiness: 'medium', turnId: 100 },
        }),
      }),
    );

    const rendered = renderWorkspace();

    expect(screen.getByRole('button', { name: 'Close Phase' })).toBeTruthy();
  });

  it('shows the footer close action when design is the active closeable phase with enough turns', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: createFillerTurns('design', 3),
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'in_progress', closeability: true, readiness: 'medium', turnId: 100 },
        }),
      }),
    );

    renderWorkspace('design');

    expect(screen.getByRole('button', { name: 'Close Phase' })).toBeTruthy();
  });

  it('opens a close-phase confirmation modal with readiness and turn context and allows cancelling', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: createFillerTurns('grounding', 3),
        workflow: createWorkflowState({
          grounding: { status: 'in_progress', closeability: true, readiness: 'medium', turnId: 100 },
        }),
      }),
    );

    const rendered = renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Close Phase' }));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Close Grounding phase?')).toBeTruthy();
    expect(within(dialog).getByText('Readiness')).toBeTruthy();
    expect(within(dialog).getByText('Medium')).toBeTruthy();
    expect(within(dialog).getByText('Turn count')).toBeTruthy();
    expect(within(dialog).getByText('3 turns')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep phase open' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
    expect(useChatHarness.sendMessage).not.toHaveBeenCalled();
  });

  it('submits a force-close action for grounding through chat with typed confirmation parts', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: createFillerTurns('grounding', 3),
        workflow: createWorkflowState({
          grounding: { status: 'in_progress', closeability: true, readiness: 'medium', turnId: 100 },
        }),
      }),
    );

    renderWorkspace();

    fireEvent.click(screen.getByRole('button', { name: 'Close Phase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm grounding closure' }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Force grounding closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'force-close-active-phase', phase: 'grounding' },
          },
        ],
      });
    });
  });

  it('hides the header close action for a review proposal state even when the phase is closeable', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: '',
        answer: 'The reviewed requirement set is ready.',
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            turn_kind: 'question',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              {
                type: 'data-phase-summary',
                data: {
                  turnId: 1,
                  phase: 'requirements',
                  summary:
                    'The requirement set has explicit review coverage and is ready to move into criteria.',
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [],
          },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: {
            status: 'in_progress',
            closeability: true,
            readiness: 'high',
            closureBasis: null,
            proposalPending: true,
            turnId: 1,
            summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
          },
        }),
      }),
    );

    renderWorkspace('requirements');

    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
    expect(await screen.findByRole('button', { name: 'Accept reviewed requirements' })).toBeTruthy();
  });

  it('shows an advance CTA in the header for a closed phase with a next phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high', summary: 'Grounding complete.' },
          design: { status: 'unstarted' },
        }),
      }),
    );

    renderWorkspace();

    const advanceLink = screen.getByRole('link', { name: 'Advance to Elicitation' });
    expect(advanceLink.getAttribute('href')).toBe('/specification/1/elicitation');
    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
  });

  it('shows an export CTA in the header for the closed final phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
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
    expect(exportLinks[0]?.getAttribute('href')).toBe('/specification/1/export');
    expect(screen.queryByRole('button', { name: 'Close Phase' })).toBeNull();
  });

  it('renders historical completed turns as compact answered cards instead of replay placeholders', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'grounding',
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
                  turnId: 1,
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
                referenceCode: createKnowledgeReferenceCode('goal', 1),
              },
            ],
          },
          {
            id: 2,
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'grounding',
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
            grounding: {
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
    expect(answeredCards[0].textContent).toContain(createKnowledgeReferenceCode('goal', 1));
  });

  it('renders continue/start control actions as control markers instead of user chat bubbles', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
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
      }),
    );

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'u-control',
          role: 'user',
          parts: [{ type: 'data-phase-intent', data: { kind: 'phase-continue', phase: 'grounding' } }],
        },
      ]);
    });

    expect(await screen.findByText('Interview resumed')).toBeTruthy();
    expect(screen.queryByText('Continue the grounding phase.')).toBeNull();
  });

  it('does not render a control marker for phase-entry intents', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
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
      }),
    );

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'u-control',
          role: 'user',
          parts: [{ type: 'data-phase-intent', data: { kind: 'phase-entry', phase: 'grounding' } }],
        },
      ]);
    });

    expect(screen.queryByText('Interview started')).toBeNull();
    expect(screen.queryByText('Begin the grounding phase.')).toBeNull();
  });

  it('collapses repeated typed control intents into the latest projected marker', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
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
      }),
    );

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'u-control-1',
          role: 'user',
          parts: [{ type: 'data-phase-intent', data: { kind: 'phase-continue', phase: 'grounding' } }],
        },
        {
          id: 'u-control-2',
          role: 'user',
          parts: [{ type: 'data-phase-intent', data: { kind: 'phase-continue', phase: 'grounding' } }],
        },
      ]);
    });

    expect(screen.getAllByText('Interview resumed')).toHaveLength(1);
  });

  it('does not infer control markers from plain text once typed phase intents own the seam', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
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
      }),
    );

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'u-control', role: 'user', parts: [{ type: 'text', text: 'Continue the grounding phase.' }] },
      ]);
    });

    expect(screen.queryByText('Interview resumed')).toBeNull();
    expect(screen.queryByText('Continue the grounding phase.')).toBeNull();
  });

  it('does not render fallback assistant chat bubbles once the projected workspace stream owns the pane body', async () => {
    setLoaderData(createWorkspaceLoaderData({ turns: [] }));

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'assistant-text-only',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Unexpected fallback assistant text' }],
        },
      ]);
    });

    expect(screen.queryByText('Unexpected fallback assistant text')).toBeNull();
  });

  it('replays accepted closure from the same durable turn as a resolved closure card', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'grounding',
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
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'grounding',
            question: 'Closure proposal',
            why: null,
            impact: null,
            answer: 'Confirm grounding closure',
            is_resolution: true,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Confirm grounding closure' },
              {
                type: 'data-confirmation',
                data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 2, phase: 'grounding' },
              },
            ]),
            assistant_parts: JSON.stringify([
              {
                type: 'data-phase-summary',
                data: {
                  turnId: 2,
                  phase: 'grounding',
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
            grounding: {
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
      expect(screen.getByTestId('accepted-closure-card')).toBeTruthy();
    });
    expect(screen.getByTestId('answered-turn-card').textContent).toContain('What should we build first?');
    expect(screen.getByTestId('accepted-closure-card').textContent).toContain('Phase closure confirmed');
    expect(screen.getByTestId('accepted-closure-card').textContent).toContain('Grounding closure confirmed');
    expect(screen.getByTestId('accepted-closure-card').textContent).toContain(
      'Goals, terms, context, and constraints are sufficiently captured.',
    );
    expect(
      within(screen.getByTestId('accepted-closure-card')).queryByTestId('workspace-state-card'),
    ).toBeNull();
    expect(screen.getByTestId('accepted-closure-card').textContent).not.toContain(
      'Confirm grounding closure',
    );
  });

  it('keeps later-phase active turns out of a closed phase and stages the handoff card at the bottom', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'grounding',
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
            specification_id: 1,
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
            grounding: {
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
    const handoffCard = await screen.findByTestId('phase-handoff-card');

    expect(answeredCard.textContent).toContain('What should we build first?');
    expect(screen.queryByText('Which architecture should we choose next?')).toBeNull();
    expect(screen.queryByTestId('workspace-state-card')).toBeNull();
    expect(handoffCard.textContent).toContain('Phase handoff');
    expect(handoffCard.textContent).toContain('Grounding complete — next: Elicitation');
    expect(handoffCard.textContent).toContain(
      'Goals, terms, context, and constraints are sufficiently captured.',
    );
    expect(
      within(handoffCard).getByRole('link', { name: 'Continue to Elicitation' }).getAttribute('href'),
    ).toBe('/specification/1/elicitation');
    expect(answeredCard.compareDocumentPosition(handoffCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders a review-specific handoff card for a closed requirements phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: 'Looks good to me.',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Looks good to me.' }]),
            assistant_parts: JSON.stringify([
              {
                type: 'tool-ask_question',
                toolCallId: 'tool-review',
                state: 'output-available',
                input: {
                  question: 'Please review the current requirement set.',
                  why: 'Review the whole requirement set before moving forward.',
                  impact: 'high',
                  options: [
                    { content: 'Accept review', is_recommended: true },
                    { content: 'Request changes', is_recommended: false },
                  ],
                  reviewActions: [
                    { action: 'accept', optionPosition: 0 },
                    { action: 'request-changes', optionPosition: 1 },
                  ],
                },
                output: { ok: true, turnId: 1, optionCount: 2 },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: true },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 1,
            summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
          },
          criteria: { status: 'unstarted', readiness: 'low' },
        }),
        entityState: createEntityState({
          requirements: [
            {
              id: 31,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export the reviewed specification as markdown',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 1),
            },
          ],
        }),
      }),
    );

    renderWorkspace('requirements');

    const answeredCard = await screen.findByTestId('answered-turn-card');
    const handoffCard = await screen.findByTestId('review-phase-completion-card');

    expect(handoffCard.textContent).toContain('Requirements review is complete');
    expect(handoffCard.textContent).toContain(
      'The reviewed requirement set is accepted and ready for acceptance criteria.',
    );
    expect(screen.queryByTestId('workspace-state-card')).toBeNull();
    expect(
      within(handoffCard).getByRole('link', { name: 'Continue to Acceptance Criteria' }).getAttribute('href'),
    ).toBe('/specification/1/acceptance-review');
    expect(answeredCard.compareDocumentPosition(handoffCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders a review-specific completion card for a closed criteria phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: 'Accepted.',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Accepted.' }]),
            assistant_parts: JSON.stringify([
              {
                type: 'tool-ask_question',
                toolCallId: 'tool-review',
                state: 'output-available',
                input: {
                  question: 'Please review the current criterion set.',
                  why: 'Review the whole criterion set before moving forward.',
                  impact: 'high',
                  options: [
                    { content: 'Accept review', is_recommended: true },
                    { content: 'Request changes', is_recommended: false },
                  ],
                  reviewActions: [
                    { action: 'accept', optionPosition: 0 },
                    { action: 'request-changes', optionPosition: 1 },
                  ],
                },
                output: { ok: true, turnId: 1, optionCount: 2 },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: true },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: { status: 'closed', readiness: 'high' },
          criteria: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 1,
            summary: 'The accepted criteria set is ready for export.',
          },
        }),
        entityState: createEntityState({
          criteria: [
            {
              id: 41,
              specification_id: 1,
              kind: 'criterion',
              subtype: null,
              content: 'Restarting restores the active path',
              rationale: null,
              referenceCode: 'C1',
            },
          ],
        }),
      }),
    );

    renderWorkspace('criteria');

    const answeredCard = await screen.findByTestId('answered-turn-card');
    const completionCard = await screen.findByTestId('review-phase-completion-card');

    expect(completionCard.textContent).toContain('Acceptance Criteria review is complete');
    expect(completionCard.textContent).toContain('The accepted criteria set is ready for export.');
    expect(screen.queryByTestId('workspace-state-card')).toBeNull();
    expect(
      within(completionCard).getByRole('link', { name: 'Open export preview' }).getAttribute('href'),
    ).toBe('/specification/1/export');
    expect(
      answeredCard.compareDocumentPosition(completionCard) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('renders grounding strategy choices from the projected grounding kickoff landing and submits the selected strategy', async () => {
    const loaderData = createWorkspaceLoaderData({
      assistantText: '',
      answer: '',
      turns: [],
      workflow: createWorkflowState({
        grounding: {
          status: 'in_progress',
          closeability: false,
          readiness: 'low',
          closureBasis: null,
          proposalPending: false,
          turnId: null,
          summary: null,
        },
      }),
    });
    expect(loaderData.projectState.landing).toEqual({ kind: 'kickoff', phase: 'grounding', mode: 'start' });
    setLoaderData(loaderData);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace();

    expect((await screen.findByTestId('kickoff-control-card')).textContent).toContain(
      'How should this specification start?',
    );
    expect(screen.getByText('New concept from scratch')).toBeTruthy();
    expect(screen.getByText('Feature within existing codebase')).toBeTruthy();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();

    fireEvent.click(screen.getByTestId('kickoff-strategy-option-brownfield'));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' }),
        }),
      );
    });

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-entry', phase: 'grounding', mode: 'brownfield' },
          },
        ],
      });
    });
  });

  it('auto-continues grounding recovery when an open phase has a completed turn but no successor frontier', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-continue', phase: 'grounding' }),
        }),
      );
    });

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-continue', phase: 'grounding' },
          },
        ],
      });
    });

    expect(await screen.findByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('recovery-control-card')).toBeNull();
    expect(screen.queryByLabelText('Type a message...')).toBeNull();
  });

  it('keeps the grounding strategy kickoff card when grounding still requires an explicit strategy choice', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
        workflow: createWorkflowState({
          grounding: {
            status: 'in_progress',
            closeability: false,
            readiness: 'low',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
      }),
    );

    renderWorkspace('grounding');

    const kickoffCard = await screen.findByTestId('kickoff-control-card');
    expect(kickoffCard.textContent).toContain('How should this specification start?');
    expect(kickoffCard.textContent).toContain('New concept from scratch');
    expect(kickoffCard.textContent).toContain('Feature within existing codebase');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useChatHarness.sendMessage).not.toHaveBeenCalled();
  });

  it('auto-continues criteria recovery through the typed phase-intent seam', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: { status: 'closed', readiness: 'high' },
          criteria: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'grounding',
            turn_kind: 'question',
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
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'criteria',
            turn_kind: 'question',
            question: 'Which acceptance criterion matters most?',
            why: 'This anchors the first review pass.',
            impact: 'high',
            answer: 'Reloading preserves the accepted requirement set.',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Reloading preserves the accepted requirement set.' },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Which acceptance criterion matters most?' },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('criteria');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-continue', phase: 'criteria' }),
        }),
      );
    });

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-continue', phase: 'criteria' },
          },
        ],
      });
    });

    expect(await screen.findByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.queryByTestId('workspace-state-card')).toBeNull();
  });

  it('renders requirement reference codes and review actions on the requirements full-set review turn', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Please review the current requirement set.',
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 1,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      content: 'Export the reviewed specification as markdown',
                      rationale: 'Keeps the accepted review output portable for sharing.',
                      grounding: [
                        { code: createKnowledgeReferenceCode('goal', 1) },
                        { code: createKnowledgeReferenceCode('context', 1) },
                      ],
                    },
                    {
                      reviewItemId: 'requirements:2',
                      referenceCode: createKnowledgeReferenceCode('requirement', 2),
                      content: 'Resume the interview from persisted local state',
                      rationale: 'Maintains the local-first continuity promise after reload.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 2) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
        entityState: createEntityState({
          requirements: [
            {
              id: 31,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export the reviewed specification as markdown',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 1),
            },
            {
              id: 32,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Resume the interview from persisted local state',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('requirement', 2),
            },
          ],
        }),
      }),
    );

    renderWorkspace('requirements');

    expect(await screen.findByTestId('active-review-set-card')).toBeTruthy();
    expect(screen.queryByTestId('active-question-card')).toBeNull();
    expect(await screen.findByText('Requirements')).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
    expect(screen.getByText('Export the reviewed specification as markdown')).toBeTruthy();
    expect(screen.getByText('Keeps the accepted review output portable for sharing.')).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('goal', 1))).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('requirement', 2))).toBeTruthy();
    expect(screen.getByText('Resume the interview from persisted local state')).toBeTruthy();
    expect(screen.getByText('Items')).toBeTruthy();
    expect(screen.getByText('Grounding')).toBeTruthy();
    expect(
      screen.queryByLabelText(`Comment on ${createKnowledgeReferenceCode('requirement', 1)}`),
    ).toBeTruthy();
    expect(screen.queryByText('Commented')).toBeTruthy();
    expect(screen.getByLabelText('Review note')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept Review' })).toBeTruthy();
  });

  it('renders review-ready grounding refs on an active requirements review turn', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Please review the current requirement set.',
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 1,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      content:
                        'Create, edit, and close tickets with required fields: title, description, priority, and assignee',
                      rationale: 'Captures the core ticket lifecycle the tool must support from day one.',
                      grounding: [
                        { code: createKnowledgeReferenceCode('goal', 1) },
                        { code: createKnowledgeReferenceCode('context', 1) },
                        { code: createKnowledgeReferenceCode('decision', 1) },
                      ],
                    },
                    {
                      reviewItemId: 'requirements:2',
                      referenceCode: createKnowledgeReferenceCode('requirement', 2),
                      content:
                        'Every status change records the actor identity and ISO 8601 timestamp in the audit log',
                      rationale: 'Protects accountability and traceability for regulated workflows.',
                      grounding: [
                        { code: createKnowledgeReferenceCode('context', 2) },
                        { code: createKnowledgeReferenceCode('constraint', 1) },
                      ],
                    },
                    {
                      reviewItemId: 'requirements:3',
                      referenceCode: createKnowledgeReferenceCode('requirement', 3),
                      content:
                        'Role-based visibility: admins see all tickets and settings, developers see assigned and unassigned tickets, viewers have read-only access',
                      rationale:
                        'Ensures each role sees only the operations appropriate to its responsibility.',
                      grounding: [
                        { code: createKnowledgeReferenceCode('goal', 2) },
                        { code: createKnowledgeReferenceCode('constraint', 2) },
                      ],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
        entityState: createEntityState({
          goals: [
            {
              id: 1,
              specification_id: 1,
              kind: 'goal',
              subtype: null,
              content:
                'Launch a lightweight issue tracker that covers the core ticket lifecycle for day-one teams',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('goal', 1),
            },
            {
              id: 2,
              specification_id: 1,
              kind: 'goal',
              subtype: null,
              content:
                'Keep ticket visibility and role-specific actions clear for admins, developers, and viewers',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('goal', 2),
            },
          ],
          contexts: [
            {
              id: 3,
              specification_id: 1,
              kind: 'context',
              subtype: null,
              content:
                'Tickets move through a workflow that always includes title, description, priority, and assignee',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('context', 1),
            },
            {
              id: 4,
              specification_id: 1,
              kind: 'context',
              subtype: null,
              content: 'The team needs a trustworthy audit trail whenever ticket status changes',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('context', 2),
            },
          ],
          constraints: [
            {
              id: 5,
              specification_id: 1,
              kind: 'constraint',
              subtype: null,
              content: 'Audit history must be retained as immutable actor-and-timestamp records',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('constraint', 1),
            },
            {
              id: 6,
              specification_id: 1,
              kind: 'constraint',
              subtype: null,
              content: 'Viewer access must stay read-only and must not mutate ticket data or settings',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('constraint', 2),
            },
          ],
          decisions: [
            {
              id: 7,
              specification_id: 1,
              content: 'Model the first release around one shared ticket record with role-aware actions',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('decision', 1),
            },
          ],
        }),
      }),
    );

    renderWorkspace('requirements');

    const activeReviewSet = await screen.findByTestId('active-review-set-card');
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('goal', 1))).toBeTruthy();
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('context', 1))).toBeTruthy();
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('decision', 1))).toBeTruthy();
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('context', 2))).toBeTruthy();
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('constraint', 1))).toBeTruthy();
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('goal', 2))).toBeTruthy();
    expect(within(activeReviewSet).getByText(createKnowledgeReferenceCode('constraint', 2))).toBeTruthy();

    expect(within(activeReviewSet).getByText('Items')).toBeTruthy();
    expect(within(activeReviewSet).getByText('Grounding')).toBeTruthy();
    expect(within(activeReviewSet).getByText('Commented')).toBeTruthy();
  });

  it('renders criterion reference codes and review actions on the criteria full-set review turn', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Please review the current criterion set.',
        answer: '',
        userParts: [],
        options: [
          { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
          { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 97,
          },
          criteria: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 1,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      referenceCode: createKnowledgeReferenceCode('criterion', 1),
                      content: 'Restarting restores the active path',
                      rationale: 'Shows the local persistence seam survives reloads.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 1) }],
                    },
                    {
                      reviewItemId: 'criteria:2',
                      referenceCode: createKnowledgeReferenceCode('criterion', 2),
                      content: 'Markdown export includes accepted requirements only',
                      rationale: 'Prevents draft review content from leaking into export.',
                      grounding: [
                        { code: createKnowledgeReferenceCode('requirement', 2) },
                        { code: createKnowledgeReferenceCode('decision', 1) },
                      ],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
        entityState: createEntityState({
          criteria: [
            {
              id: 41,
              specification_id: 1,
              kind: 'criterion',
              subtype: null,
              content: 'Restarting restores the active path',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('criterion', 1),
            },
            {
              id: 42,
              specification_id: 1,
              kind: 'criterion',
              subtype: null,
              content: 'Markdown export includes accepted requirements only',
              rationale: null,
              referenceCode: createKnowledgeReferenceCode('criterion', 2),
            },
          ],
        }),
      }),
    );

    renderWorkspace('criteria');

    expect(await screen.findByTestId('active-review-set-card')).toBeTruthy();
    expect(screen.queryByTestId('active-question-card')).toBeNull();
    expect(await screen.findByText('Acceptance Criteria')).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('criterion', 1))).toBeTruthy();
    expect(screen.getByText('Restarting restores the active path')).toBeTruthy();
    expect(screen.getByText('Shows the local persistence seam survives reloads.')).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('criterion', 2))).toBeTruthy();
    expect(screen.getByText('Markdown export includes accepted requirements only')).toBeTruthy();
    expect(screen.getByText('Items')).toBeTruthy();
    expect(screen.getByText('Grounding')).toBeTruthy();
    expect(
      screen.queryByLabelText(`Comment on ${createKnowledgeReferenceCode('criterion', 1)}`),
    ).toBeTruthy();
    expect(screen.queryByText('Commented')).toBeTruthy();
    expect(screen.getByLabelText('Review note')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept Review' })).toBeTruthy();
  });

  it('carries predecessor review metadata and explicit revision badges onto an active regenerated review turn', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 2,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: 'Please revise this set',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Please revise this set' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 1,
                  selectedOptionIds: [12],
                  reviewAction: 'request-changes',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      content: 'Resume the interview from persisted local state',
                      rationale: 'Maintains the local-first continuity promise after reload.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 2) }],
                    },
                    {
                      reviewItemId: 'requirements:2',
                      referenceCode: createKnowledgeReferenceCode('requirement', 2),
                      content: 'Export the reviewed specification as markdown',
                      rationale: 'Keeps the accepted review output portable for sharing.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 1) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: true },
            ],
          },
          {
            id: 2,
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'requirements',
            question: 'Please review the revised requirement set.',
            why: 'Review the revised set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the revised requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      referenceCode: 'requirements:1',
                      content: 'R1: Resume the interview from persisted local state after reload',
                    },
                    {
                      reviewItemId: 'requirements:2',
                      content: 'Export the reviewed specification as markdown',
                    },
                    {
                      reviewItemId: 'requirements:3',
                      referenceCode: createKnowledgeReferenceCode('requirement', 3),
                      content: 'Include rationale notes in the exported handoff',
                      rationale: 'Lets operators see why the reviewed set was accepted.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 3) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
      }),
    );

    renderWorkspace('requirements');

    const activeReviewCard = await screen.findByTestId('active-review-set-card');
    expect(activeReviewCard).toBeTruthy();
    expect(within(activeReviewCard).getByText('v2')).toBeTruthy();
    expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
    expect(
      within(activeReviewCard).getByText('Resume the interview from persisted local state after reload'),
    ).toBeTruthy();
    expect(within(activeReviewCard).queryByText('requirements:1')).toBeNull();
    expect(
      within(activeReviewCard).queryByText(
        'R1: Resume the interview from persisted local state after reload',
      ),
    ).toBeNull();
    expect(
      within(activeReviewCard).getByText('Maintains the local-first continuity promise after reload.'),
    ).toBeTruthy();
    expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('goal', 2))).toBeTruthy();
    expect(within(activeReviewCard).getByText('Revised')).toBeTruthy();
    expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('requirement', 3))).toBeTruthy();
    expect(
      within(activeReviewCard).getByText('Include rationale notes in the exported handoff'),
    ).toBeTruthy();
    expect(within(activeReviewCard).getByText('Added in revision')).toBeTruthy();
    expect(screen.queryByText('Added by you')).toBeNull();
  });

  it('carries predecessor review metadata and explicit revision badges onto an active regenerated criteria review turn', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 97,
            summary: 'Requirements accepted.',
          },
          criteria: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 2,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: 'Please revise this set',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Please revise this set' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 1,
                  selectedOptionIds: [12],
                  reviewAction: 'request-changes',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      referenceCode: createKnowledgeReferenceCode('criterion', 1),
                      content: 'Restarting restores the active path',
                      rationale: 'Shows the local persistence seam survives reloads.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 1) }],
                    },
                    {
                      reviewItemId: 'criteria:2',
                      referenceCode: createKnowledgeReferenceCode('criterion', 2),
                      content: 'Markdown export includes accepted requirements only',
                      rationale: 'Prevents draft review content from leaking into export.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 2) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: true },
            ],
          },
          {
            id: 2,
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'criteria',
            question: 'Please review the revised criterion set.',
            why: 'Review the revised criterion set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the revised criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      content: 'Restarting restores the active path after a full reload',
                    },
                    {
                      reviewItemId: 'criteria:3',
                      referenceCode: createKnowledgeReferenceCode('criterion', 3),
                      content:
                        'Accepted regenerated review cards preserve carried rationale and grounding metadata',
                      rationale:
                        'Keeps the criteria transcript legible while the review is still in progress.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 3) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
      }),
    );

    renderWorkspace('criteria');

    const activeReviewCard = await screen.findByTestId('active-review-set-card');
    expect(activeReviewCard).toBeTruthy();
    expect(within(activeReviewCard).getByText('v2')).toBeTruthy();
    expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('criterion', 1))).toBeTruthy();
    expect(
      within(activeReviewCard).getByText('Restarting restores the active path after a full reload'),
    ).toBeTruthy();
    expect(
      within(activeReviewCard).getByText('Shows the local persistence seam survives reloads.'),
    ).toBeTruthy();
    expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
    expect(within(activeReviewCard).getByText('Revised')).toBeTruthy();
    expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('criterion', 3))).toBeTruthy();
    expect(
      within(activeReviewCard).getByText(
        'Accepted regenerated review cards preserve carried rationale and grounding metadata',
      ),
    ).toBeTruthy();
    expect(within(activeReviewCard).getByText('Added in revision')).toBeTruthy();
    expect(screen.queryByText('Added by you')).toBeNull();
  });

  it('replays regenerated review turns with the same carried metadata and revision badge semantics', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 99,
            summary: 'Grounding closed.',
          },
          design: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 98,
            summary: 'Design closed.',
          },
          requirements: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 2,
            summary: 'Requirements accepted.',
          },
          criteria: {
            status: 'unstarted',
            closeability: false,
            readiness: 'low',
            turnId: null,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: 'Please revise this set',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Please revise this set' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 1,
                  selectedOptionIds: [12],
                  reviewAction: 'request-changes',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      content: 'Resume the interview from persisted local state',
                      rationale: 'Maintains the local-first continuity promise after reload.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 2) }],
                    },
                    {
                      reviewItemId: 'requirements:2',
                      referenceCode: createKnowledgeReferenceCode('requirement', 2),
                      content: 'Export the reviewed specification as markdown',
                      rationale: 'Keeps the accepted review output portable for sharing.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 1) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: true },
            ],
          },
          {
            id: 2,
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'requirements',
            question: 'Please review the revised requirement set.',
            why: 'Review the revised set before moving forward.',
            impact: 'high',
            answer: 'Accept review',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Accept review' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 2,
                  selectedOptionIds: [21],
                  reviewAction: 'accept',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the revised requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      content: 'Resume the interview from persisted local state after reload',
                    },
                    {
                      reviewItemId: 'requirements:2',
                      content: 'Export the reviewed specification as markdown',
                    },
                    {
                      reviewItemId: 'requirements:3',
                      referenceCode: createKnowledgeReferenceCode('requirement', 3),
                      content: 'Include rationale notes in the exported handoff',
                      rationale: 'Lets operators see why the reviewed set was accepted.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 3) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: true },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
      }),
    );

    renderWorkspace('requirements');

    const revisionCard = await screen.findByTestId('revision-card');
    expect(revisionCard.textContent).toContain('v2');

    const answeredReviewCards = await screen.findAllByTestId('answered-review-set-card');
    const answeredReviewCard = answeredReviewCards.at(-1);
    expect(answeredReviewCard).toBeTruthy();
    expect(
      within(answeredReviewCard!).getByText(createKnowledgeReferenceCode('requirement', 1)),
    ).toBeTruthy();
    expect(
      within(answeredReviewCard!).getByText('Resume the interview from persisted local state after reload'),
    ).toBeTruthy();
    expect(
      within(answeredReviewCard!).getByText('Maintains the local-first continuity promise after reload.'),
    ).toBeTruthy();
    expect(within(answeredReviewCard!).getByText(createKnowledgeReferenceCode('goal', 2))).toBeTruthy();
    expect(within(answeredReviewCard!).getByText('Revised')).toBeTruthy();
    expect(within(answeredReviewCard!).getByText('Added in revision')).toBeTruthy();
    expect(within(answeredReviewCard!).getByText('Review accepted.')).toBeTruthy();
    expect(screen.queryByText('Added by you')).toBeNull();
  });

  it('replays regenerated criteria review turns with the same carried metadata and revision badge semantics', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 99,
            summary: 'Grounding closed.',
          },
          design: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 98,
            summary: 'Design closed.',
          },
          requirements: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 97,
            summary: 'Requirements accepted.',
          },
          criteria: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 2,
            summary: 'Criteria accepted.',
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: 'Please revise this set',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Please revise this set' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 1,
                  selectedOptionIds: [12],
                  reviewAction: 'request-changes',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      referenceCode: createKnowledgeReferenceCode('criterion', 1),
                      content: 'Restarting restores the active path',
                      rationale: 'Shows the local persistence seam survives reloads.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 1) }],
                    },
                    {
                      reviewItemId: 'criteria:2',
                      referenceCode: createKnowledgeReferenceCode('criterion', 2),
                      content: 'Markdown export includes accepted requirements only',
                      rationale: 'Prevents draft review content from leaking into export.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 2) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: true },
            ],
          },
          {
            id: 2,
            specification_id: 1,
            parent_turn_id: 1,
            phase: 'criteria',
            question: 'Please review the revised criterion set.',
            why: 'Review the revised criterion set before moving forward.',
            impact: 'high',
            answer: 'Accept review',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Accept review' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 2,
                  selectedOptionIds: [21],
                  reviewAction: 'accept',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the revised criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      content: 'Restarting restores the active path after a full reload',
                    },
                    {
                      reviewItemId: 'criteria:3',
                      referenceCode: createKnowledgeReferenceCode('criterion', 3),
                      content:
                        'Accepted regenerated review cards preserve carried rationale and grounding metadata',
                      rationale: 'Keeps the criteria transcript legible after acceptance.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 3) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:05:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: true },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
      }),
    );

    renderWorkspace('criteria');

    const revisionCard = await screen.findByTestId('revision-card');
    expect(revisionCard.textContent).toContain('v2');

    const answeredReviewCards = await screen.findAllByTestId('answered-review-set-card');
    const answeredReviewCard = answeredReviewCards.at(-1);
    expect(answeredReviewCard).toBeTruthy();
    expect(within(answeredReviewCard!).getByText(createKnowledgeReferenceCode('criterion', 1))).toBeTruthy();
    expect(
      within(answeredReviewCard!).getByText('Restarting restores the active path after a full reload'),
    ).toBeTruthy();
    expect(
      within(answeredReviewCard!).getByText('Shows the local persistence seam survives reloads.'),
    ).toBeTruthy();
    expect(
      within(answeredReviewCard!).getByText(createKnowledgeReferenceCode('requirement', 1)),
    ).toBeTruthy();
    expect(within(answeredReviewCard!).getByText('Revised')).toBeTruthy();
    expect(within(answeredReviewCard!).getByText('Added in revision')).toBeTruthy();
    expect(within(answeredReviewCard!).getByText('Review accepted.')).toBeTruthy();
    expect(screen.queryByText('Added by you')).toBeNull();
  });

  it('renders a pending review turn through the same lightweight review card family before route invalidation', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Earlier question?',
        answer: 'Earlier answer',
        workflow: createWorkflowState({
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 2,
            summary: null,
          },
        }),
        entityState: createEntityState({
          requirements: [
            {
              id: 31,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Export the reviewed specification as markdown',
              rationale: 'Keeps the accepted review output portable for sharing.',
              referenceCode: createKnowledgeReferenceCode('requirement', 1),
            },
          ],
        }),
      }),
    );
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace('requirements');

    expect(await screen.findByTestId('review-phase-banner')).toBeTruthy();
    expect(screen.getByTestId('generating-turn-placeholder')).toBeTruthy();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingReviewMessage(),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-review-set-card')).toBeTruthy();
      expect(screen.queryByTestId('active-question-card')).toBeNull();
      expect(screen.getByTestId('review-set-card')).toBeTruthy();
      expect(screen.getByText('Requirements')).toBeTruthy();
      expect(screen.getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Accept Review' })).toBeTruthy();
      expect(screen.getByText('Items')).toBeTruthy();
      expect(
        screen.queryByLabelText(`Comment on ${createKnowledgeReferenceCode('requirement', 1)}`),
      ).toBeTruthy();
      expect(screen.queryByText('Commented')).toBeTruthy();
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('renders pending review from streamed reviewSet metadata, not from mismatched entity snapshots', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Earlier question?',
        answer: 'Earlier answer',
        workflow: createWorkflowState({
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 2,
            summary: null,
          },
        }),
        entityState: createEntityState({
          requirements: [
            {
              id: 99,
              specification_id: 1,
              kind: 'requirement',
              subtype: null,
              content: 'Stale snapshot requirement that should NOT appear',
              rationale: 'This is a stale entity snapshot.',
              referenceCode: createKnowledgeReferenceCode('requirement', 99),
            },
          ],
        }),
      }),
    );
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace('requirements');

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingReviewMessage(),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('active-review-set-card')).toBeTruthy();
      expect(screen.getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
      expect(screen.queryByText('Stale snapshot requirement that should NOT appear')).toBeNull();
      expect(screen.queryByText(createKnowledgeReferenceCode('requirement', 99))).toBeNull();
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('renders a pending regenerated criteria review turn with carried metadata and canonical badges before route invalidation', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: createWorkflowState({
          requirements: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 97,
            summary: 'Requirements accepted.',
          },
          criteria: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 2,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: 'Please revise this set',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Please revise this set' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 1,
                  selectedOptionIds: [12],
                  reviewAction: 'request-changes',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      referenceCode: createKnowledgeReferenceCode('criterion', 1),
                      content: 'Restarting restores the active path',
                      rationale: 'Shows the local persistence seam survives reloads.',
                      grounding: [{ code: createKnowledgeReferenceCode('requirement', 1) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: true },
            ],
          },
        ],
      }),
    );
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace('criteria');

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Please revise this set' }] },
        {
          id: 'turn-1-assistant',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Please review the current criterion set.' }],
        },
        createPendingCriteriaRevisionMessage(),
      ]);
    });

    await waitFor(() => {
      const activeReviewCard = screen.getByTestId('active-review-set-card');
      expect(activeReviewCard).toBeTruthy();
      expect(within(activeReviewCard).getByText('v2')).toBeTruthy();
      expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('criterion', 1))).toBeTruthy();
      expect(
        within(activeReviewCard).getByText('Restarting restores the active path after a full reload'),
      ).toBeTruthy();
      expect(
        within(activeReviewCard).getByText('Shows the local persistence seam survives reloads.'),
      ).toBeTruthy();
      expect(within(activeReviewCard).getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
      expect(within(activeReviewCard).getByText('Revised')).toBeTruthy();
      expect(within(activeReviewCard).getByText('Added in revision')).toBeTruthy();
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('replays a closed review turn with the dedicated review-set card instead of the generic answered card', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: 'Accept review',
            is_resolution: false,
            user_parts: JSON.stringify([
              { type: 'text', text: 'Accept review' },
              {
                type: 'data-turn-response',
                data: {
                  turnId: 1,
                  selectedOptionIds: [11],
                  reviewAction: 'accept',
                },
              },
            ]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      content: 'Export the reviewed specification as markdown',
                      rationale: 'Keeps the accepted review output portable for sharing.',
                      grounding: [
                        { code: createKnowledgeReferenceCode('goal', 1) },
                        { code: createKnowledgeReferenceCode('context', 1) },
                      ],
                    },
                    {
                      reviewItemId: 'requirements:2',
                      referenceCode: createKnowledgeReferenceCode('requirement', 2),
                      content: 'Resume the interview from persisted local state',
                      rationale: 'Maintains the local-first continuity promise after reload.',
                      grounding: [{ code: createKnowledgeReferenceCode('goal', 2) }],
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: true },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 99,
            summary: 'Grounding closed.',
          },
          design: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            proposalPending: false,
            turnId: 98,
            summary: 'Design closed.',
          },
          requirements: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'user_forced',
            proposalPending: false,
            turnId: 1,
            summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
          },
          criteria: {
            status: 'closed',
            closeability: false,
            readiness: 'high',
            closureBasis: 'user_forced',
            proposalPending: false,
            turnId: 97,
            summary: 'Criteria closed.',
          },
        }),
      }),
    );

    renderWorkspace('requirements');

    expect(await screen.findByTestId('answered-review-set-card')).toBeTruthy();
    expect(screen.queryByTestId('answered-turn-card')).toBeNull();
    expect(screen.getByText('Requirements')).toBeTruthy();
    expect(screen.getByText(createKnowledgeReferenceCode('requirement', 1))).toBeTruthy();
    expect(screen.getByText('Review accepted.')).toBeTruthy();
  });

  it('does not forward the accepted requirements review text into chat when the server already advanced to criteria', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Please review the current requirement set.',
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 1,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              {
                type: 'tool-ask_question',
                toolCallId: 'tool-review',
                state: 'output-available',
                input: {
                  question: 'Please review the current requirement set.',
                  why: 'Review the whole requirement set before moving forward.',
                  impact: 'high',
                  options: [
                    { content: 'Accept review', is_recommended: true },
                    { content: 'Request changes', is_recommended: false },
                  ],
                  reviewActions: [
                    { action: 'accept', optionPosition: 0 },
                    { action: 'request-changes', optionPosition: 1 },
                  ],
                  reviewSet: {
                    phase: 'requirements',
                    title: 'Requirements',
                    items: [
                      {
                        reviewItemId: 'requirements:1',
                        content: 'Export the reviewed specification as markdown',
                        referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      },
                    ],
                  },
                },
                output: { ok: true, turnId: 1, optionCount: 2 },
              },
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      content: 'Export the reviewed specification as markdown',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 12, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, advancedToPhase: 'criteria' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('requirements');

    fireEvent.click(await screen.findByRole('button', { name: 'Accept Review' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'select-options',
            positions: [0],
            reviewAction: 'accept',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).not.toHaveBeenCalled();
    });
  });

  it('submits review buttons by explicit review action metadata instead of assumed option order', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Please review the current requirement set.',
        answer: '',
        userParts: [],
        options: [
          { id: 11, position: 0, content: 'Request changes', is_recommended: false, is_selected: false },
          { id: 12, position: 1, content: 'Accept review', is_recommended: true, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 1,
            summary: null,
          },
          criteria: {
            status: 'unstarted',
            closeability: false,
            readiness: 'low',
            turnId: null,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              {
                type: 'tool-ask_question',
                toolCallId: 'tool-review',
                state: 'output-available',
                input: {
                  question: 'Please review the current requirement set.',
                  why: 'Review the whole requirement set before moving forward.',
                  impact: 'high',
                  options: [
                    { content: 'Request changes', is_recommended: false },
                    { content: 'Accept review', is_recommended: true },
                  ],
                  reviewActions: [
                    { action: 'request-changes', optionPosition: 0 },
                    { action: 'accept', optionPosition: 1 },
                  ],
                  reviewSet: {
                    phase: 'requirements',
                    title: 'Requirements',
                    items: [
                      {
                        reviewItemId: 'requirements:1',
                        content: 'Export the reviewed specification as markdown',
                        referenceCode: createKnowledgeReferenceCode('requirement', 1),
                      },
                    ],
                  },
                },
                output: { ok: true, turnId: 1, optionCount: 2 },
              },
              { type: 'text', text: 'Please review the current requirement set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'requirements',
                  title: 'Requirements',
                  items: [
                    {
                      reviewItemId: 'requirements:1',
                      content: 'Export the reviewed specification as markdown',
                      referenceCode: createKnowledgeReferenceCode('requirement', 1),
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 11, position: 0, content: 'Request changes', is_recommended: false, is_selected: false },
              { id: 12, position: 1, content: 'Accept review', is_recommended: true, is_selected: false },
            ],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, advancedToPhase: 'criteria' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('requirements');

    fireEvent.click(await screen.findByRole('button', { name: 'Accept Review' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'select-options',
            positions: [1],
            reviewAction: 'accept',
          }),
        }),
      );
    });
  });

  it('does not forward the accepted criteria review text into chat when the server already completed the workflow', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Please review the current criterion set.',
        answer: '',
        userParts: [],
        options: [
          { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
          { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 99,
          },
          design: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 98,
          },
          requirements: {
            status: 'closed',
            readiness: 'high',
            closureBasis: 'interviewer_recommended',
            turnId: 97,
          },
          criteria: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
            closureBasis: null,
            proposalPending: false,
            turnId: 1,
            summary: null,
          },
        }),
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              {
                type: 'tool-ask_question',
                toolCallId: 'tool-review',
                state: 'output-available',
                input: {
                  question: 'Please review the current criterion set.',
                  why: 'Review the whole criterion set before moving forward.',
                  impact: 'high',
                  options: [
                    { content: 'Accept review', is_recommended: true },
                    { content: 'Request changes', is_recommended: false },
                  ],
                  reviewActions: [
                    { action: 'accept', optionPosition: 0 },
                    { action: 'request-changes', optionPosition: 1 },
                  ],
                  reviewSet: {
                    phase: 'criteria',
                    title: 'Acceptance Criteria',
                    items: [
                      {
                        reviewItemId: 'criteria:1',
                        content: 'Restarting restores the active path',
                        referenceCode: createKnowledgeReferenceCode('criterion', 1),
                      },
                    ],
                  },
                },
                output: { ok: true, turnId: 1, optionCount: 2 },
              },
              { type: 'text', text: 'Please review the current criterion set.' },
              {
                type: 'data-review-set',
                data: {
                  phase: 'criteria',
                  title: 'Acceptance Criteria',
                  items: [
                    {
                      reviewItemId: 'criteria:1',
                      content: 'Restarting restores the active path',
                      referenceCode: createKnowledgeReferenceCode('criterion', 1),
                    },
                  ],
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [
              { id: 21, position: 0, content: 'Accept review', is_recommended: true, is_selected: false },
              { id: 22, position: 1, content: 'Request changes', is_recommended: false, is_selected: false },
            ],
          },
        ],
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, workflowCompleted: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('criteria');

    fireEvent.click(await screen.findByRole('button', { name: 'Accept Review' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'select-options',
            positions: [0],
            reviewAction: 'accept',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).not.toHaveBeenCalled();
    });
  });

  it('renders a single generating activity row while streaming live reasoning and tools', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
        workflow: createWorkflowState({
          grounding: {
            status: 'in_progress',
            closeability: false,
            readiness: 'low',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
      }),
    );
    useChatImpl = createUseChatHarness('streaming');

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'assistant-generating',
          role: 'assistant',
          parts: [
            { type: 'reasoning', text: 'Thinking through the next move' },
            {
              type: 'dynamic-tool',
              toolName: 'lookup_workspace_context',
              toolCallId: 'tool-lookup',
              state: 'output-available',
              input: {},
              output: { ok: true },
            },
          ],
        },
      ]);
    });

    expect(await screen.findByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.getAllByText('Thinking…')).toHaveLength(1);
    expect(screen.getAllByText('Tools: lookup workspace context')).toHaveLength(1);
  });

  it('renders live workspace-tool activity during the submitted pre-stream generating window', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [],
        workflow: createWorkflowState({
          grounding: {
            status: 'in_progress',
            closeability: false,
            readiness: 'low',
            closureBasis: null,
            proposalPending: false,
            turnId: null,
            summary: null,
          },
        }),
      }),
    );
    useChatImpl = createUseChatHarness('submitted');

    renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'assistant-generating',
          role: 'assistant',
          parts: [
            {
              type: 'tool-read_file',
              toolCallId: 'tool-lookup',
              state: 'input-available',
              input: { path: 'src/server/app.ts' },
            } as never,
          ],
        },
      ]);
    });

    expect(await screen.findByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.getAllByText('Thinking…')).toHaveLength(1);
    expect(screen.getAllByText('Tools: read file')).toHaveLength(1);
    expect(screen.getByText('src/server/app.ts')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tools: read file' }).hasAttribute('disabled')).toBe(false);
  });

  it('stages a preface skeleton during generation and swaps to the full prefaced question before route invalidation', async () => {
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
    expect(screen.getByTestId('generating-turn-placeholder')).toBeTruthy();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingPrefaceMessage(),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('preface-card-skeleton')).toBeTruthy();
      expect(screen.queryByTestId('preface-card')).toBeNull();
    });

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingQuestionMessage({
          parts: [...createPendingPrefaceMessage().parts, ...createPendingQuestionMessage().parts],
        }),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('preface-card')).toBeTruthy();
      expect(screen.getByText(pendingPreface.observation)).toBeTruthy();
      expect(screen.getByText('Which platform should we target next?')).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /web/i })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /desktop/i })).toBeTruthy();
      expect(screen.queryByTestId('preface-card-skeleton')).toBeNull();
      expect(screen.queryByLabelText('Type a message...')).toBeNull();
      expect(routerInvalidate).not.toHaveBeenCalled();
      expect(entityInvalidate).not.toHaveBeenCalled();
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
    await act(async () => {
      rendered.rerender(
        <QueryClientProvider client={rendered.queryClient}>
          <InterviewView phase="grounding" />
        </QueryClientProvider>,
      );
    });

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
        <InterviewView phase="grounding" />
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
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
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

  it('posts grounding option selections without requiring free-text', async () => {
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

    renderWorkspace('grounding');

    expect(((await screen.findByRole('button', { name: 'Submit' })) as HTMLButtonElement).disabled).toBe(
      true,
    );

    fireEvent.click(await screen.findByRole('checkbox', { name: /desktop/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'select-options',
            positions: [1],
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'Desktop' });
    });
  });

  it('posts grounding free-text responses when options are present', async () => {
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

    renderWorkspace('grounding');

    fireEvent.change(await screen.findByLabelText('Additional response context'), {
      target: { value: 'Something more bespoke' },
    });
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'free-text',
            freeText: 'Something more bespoke',
          }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({ text: 'Something more bespoke' });
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
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
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

  it('submits grounding-closure confirmations through chat with typed confirmation parts', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: '',
        answer: 'We have enough grounding context',
        workflow: {
          phases: {
            grounding: {
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
              phase: 'grounding',
              summary: 'Goals, terms, context, and constraints are sufficiently captured.',
            },
          },
        ],
      }),
    );

    renderWorkspace();

    expect(screen.getByText('Grounding closure proposal')).toBeTruthy();
    expect(screen.queryByTestId('phase-summary-placeholder')).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: /confirm grounding closure/i }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Confirm grounding closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'grounding' },
          },
        ],
      });
    });
  });

  it('shows a closure confirmation control marker while proposal confirmation is submitting', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: '',
        answer: 'We have enough grounding context',
        workflow: {
          phases: {
            grounding: {
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
              phase: 'grounding',
              summary: 'Goals, terms, context, and constraints are sufficiently captured.',
            },
          },
        ],
      }),
    );
    useChatHarness.sendMessage.mockImplementation(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'u-close',
          role: 'user',
          parts: [
            {
              type: 'data-confirmation',
              data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'grounding' },
            },
          ],
        },
      ]);
      useChatHarness.setStatus?.('submitted');
    });

    renderWorkspace();

    fireEvent.click(await screen.findByRole('button', { name: /confirm grounding closure/i }));

    expect(await screen.findByText('Confirm grounding closure')).toBeTruthy();
    expect(screen.getByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.queryByText('Grounding closure proposal')).toBeNull();
    expect(screen.queryByRole('button', { name: /confirm grounding closure/i })).toBeNull();
  });

  it('renders a review-specific proposal card for requirements and keeps the same confirmation payload', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: '',
        answer: 'The reviewed requirement set is ready.',
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'requirements',
            turn_kind: 'question',
            question: 'Please review the current requirement set.',
            why: 'Review the whole requirement set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              {
                type: 'data-phase-summary',
                data: {
                  turnId: 1,
                  phase: 'requirements',
                  summary:
                    'The requirement set has explicit review coverage and is ready to move into criteria.',
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [],
          },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: {
            status: 'in_progress',
            closeability: true,
            readiness: 'high',
            closureBasis: null,
            proposalPending: true,
            turnId: 1,
            summary: 'The requirement set has explicit review coverage and is ready to move into criteria.',
          },
        }),
      }),
    );

    renderWorkspace('requirements');

    expect(await screen.findByText('Requirements review ready to accept')).toBeTruthy();
    expect(
      screen.getByText(
        'The requirement set has explicit review coverage and is ready to move into criteria.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('Requirements closure proposal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Accept reviewed requirements' }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Confirm requirements closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'requirements' },
          },
        ],
      });
    });
  });

  it('renders a review-specific proposal card for criteria and keeps the same confirmation payload', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: '',
        answer: 'The reviewed criteria set is ready.',
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'criteria',
            turn_kind: 'question',
            question: 'Please review the current criterion set.',
            why: 'Review the whole criterion set before moving forward.',
            impact: 'high',
            answer: null,
            is_resolution: false,
            user_parts: null,
            assistant_parts: JSON.stringify([
              {
                type: 'data-phase-summary',
                data: {
                  turnId: 1,
                  phase: 'criteria',
                  summary:
                    'All criteria have been explicitly reviewed and the criteria set is ready to close.',
                },
              },
            ]),
            created_at: '2026-04-03 10:00:00',
            options: [],
          },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed', readiness: 'high' },
          design: { status: 'closed', readiness: 'high' },
          requirements: { status: 'closed', readiness: 'high' },
          criteria: {
            status: 'in_progress',
            closeability: true,
            readiness: 'high',
            closureBasis: null,
            proposalPending: true,
            turnId: 1,
            summary: 'All criteria have been explicitly reviewed and the criteria set is ready to close.',
          },
        }),
      }),
    );

    renderWorkspace('criteria');

    expect(await screen.findByText('Acceptance Criteria review ready to accept')).toBeTruthy();
    expect(
      screen.getByText('All criteria have been explicitly reviewed and the criteria set is ready to close.'),
    ).toBeTruthy();
    expect(screen.queryByText('Acceptance Criteria closure proposal')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Accept reviewed criteria' }));

    await waitFor(() => {
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          { type: 'text', text: 'Confirm acceptance criteria closure' },
          {
            type: 'data-confirmation',
            data: { kind: 'confirm-proposed-phase-closure', proposalTurnId: 1, phase: 'criteria' },
          },
        ],
      });
    });
  });

  it('submits a force-close action for design through chat with typed confirmation parts', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: createFillerTurns('design', 3),
        workflow: {
          phases: {
            grounding: {
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

    fireEvent.click(await screen.findByRole('button', { name: 'Close Phase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm elicitation closure' }));

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

  it('shows a force-close control marker while design force-close is submitting', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          ...createFillerTurns('design', 2, 200),
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
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
            grounding: {
              status: 'closed',
              closeability: false,
              readiness: 'high',
              closureBasis: 'interviewer_recommended',
              proposalPending: false,
              turnId: 11,
              summary: 'Goals, terms, context, and constraints are sufficiently captured.',
            },
            design: {
              status: 'in_progress',
              closeability: true,
              readiness: 'medium',
              closureBasis: null,
              proposalPending: false,
              turnId: 1,
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
    useChatHarness.sendMessage.mockImplementation(async () => {
      useChatHarness.replaceMessages?.([
        {
          id: 'u-force-close',
          role: 'user',
          parts: [
            {
              type: 'data-confirmation',
              data: { kind: 'force-close-active-phase', phase: 'design' },
            },
          ],
        },
      ]);
      useChatHarness.setStatus?.('submitted');
    });

    renderWorkspace('design');

    expect(screen.getByText('Which architecture should we choose next?')).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: 'Close Phase' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm elicitation closure' }));

    expect(await screen.findByText('Force elicitation closure', { selector: 'p' })).toBeTruthy();
    expect(screen.getByTestId('generating-turn-placeholder')).toBeTruthy();
    expect(screen.queryByText('Which architecture should we choose next?')).toBeNull();
  });

  it('hides the force-close action when design already has a pending closure proposal', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: {
          phases: {
            grounding: {
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

  it('renders an active free-text grounding question when the frontier turn has no options', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        options: [],
      }),
    );

    renderWorkspace();

    const questionCard = await screen.findByTestId('active-question-card');
    expect(questionCard.textContent).toContain('What should we build first?');
    expect(screen.getByLabelText('Your response')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /none of the above/i })).toBeNull();
  });

  it('posts free-text-only turn responses via none-of-the-above in design phase', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        phase: 'design',
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed' },
          design: { status: 'in_progress', turnId: 1 },
        }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('design');

    fireEvent.click(await screen.findByRole('checkbox', { name: /none of the above/i }));
    fireEvent.change(await screen.findByLabelText('Additional response context'), {
      target: { value: 'None of these fit our use case' },
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/specifications/1/turns/1/response',
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
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByTestId('turn-processing-state').textContent).toContain(
        'Interviewer is processing this response.',
      );
    });

    const responseContext = screen.getByLabelText('Additional response context') as HTMLTextAreaElement;
    const desktopOption = screen.getByRole('checkbox', { name: /desktop/i }) as HTMLInputElement;

    expect(screen.getByText('What should we build first?')).toBeTruthy();
    expect(screen.queryByTestId('generating-turn-placeholder')).toBeNull();
    expect(responseContext.value).toBe('Best fit for our launch');
    expect(responseContext.disabled).toBe(true);
    expect(desktopOption.getAttribute('data-state')).toBe('checked');
    expect(desktopOption.disabled).toBe(true);
  });

  it('keeps observer waiting state visible when the answered card appears before the next question arrives', async () => {
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
      const answeredLoaderData = createWorkspaceLoaderData({
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
      });
      answeredLoaderData.projectState.specification!.active_turn_id = null;
      answeredLoaderData.projectState.workflow.phases.grounding.turnId = null;
      answeredLoaderData.projectState.landing = deriveSpecificationLanding(answeredLoaderData.projectState);
      setLoaderData(answeredLoaderData);
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
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByTestId('turn-processing-state')).toBeTruthy();
    });

    await act(async () => {
      useChatHarness.setStatus?.('ready');
    });

    await waitFor(() => {
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('Still thinking…');
    });
    expect(screen.getByTestId('answered-turn-card').textContent).not.toContain('Captured: —');
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
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

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
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('Choices:');
      expect(screen.getByRole('checkbox', { name: /web/i })).toBeTruthy();
      expect(screen.getByRole('checkbox', { name: /desktop/i })).toBeTruthy();
    });

    expect(screen.queryByTestId('turn-processing-state')).toBeNull();
    expect(screen.queryByTestId('generating-turn-placeholder')).toBeNull();
  });

  it('enables a streamed question card after durable-ready promotion before bundle refetch resolves', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        assistantText: 'Earlier question?',
        answer: 'Earlier answer',
      }),
    );
    useChatImpl = createUseChatHarness('streaming');
    routerInvalidate.mockImplementationOnce(async () => new Promise<void>(() => {}));

    const rendered = renderWorkspace();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingQuestionMessage(),
      ]);
    });

    await waitFor(() => {
      expect(promoteStreamedFrontierTurnToBundle).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <InterviewView phase="grounding" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(routerInvalidate).not.toHaveBeenCalled();
      expect(screen.getByRole('checkbox', { name: /web/i }).hasAttribute('disabled')).toBe(false);
      expect((screen.getByLabelText('Your response') as HTMLTextAreaElement).disabled).toBe(false);
    });
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
    const answeredTurn: SpecificationTurn = {
      id: 1,
      specification_id: 1,
      parent_turn_id: null,
      phase: 'grounding',
      turn_kind: 'question',
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
      assistant_parts: JSON.stringify([{ type: 'text', text: 'What should we build first?' }]),
      created_at: '2026-04-03 10:00:00',
      options: [
        { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
      ],
      captured_items: [],
    };
    const nextTurn: SpecificationTurn = {
      id: 2,
      specification_id: 1,
      parent_turn_id: 1,
      phase: 'grounding',
      turn_kind: 'question',
      question: 'Which platform should we target next?',
      why: 'Platform shapes the first build.',
      impact: 'high',
      answer: null,
      is_resolution: false,
      user_parts: null,
      assistant_parts: JSON.stringify([{ type: 'text', text: 'Which platform should we target next?' }]),
      created_at: '2026-04-03 10:01:00',
      options: [
        { id: 21, position: 0, content: 'Web', is_recommended: true, is_selected: false },
        { id: 22, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
      ],
      captured_items: [],
    };
    const groundingWithNextTurn = createWorkflowState({
      grounding: {
        status: 'in_progress',
        turnId: 2,
      },
    });

    routerInvalidate.mockImplementationOnce(async () => {
      setLoaderData(
        createWorkspaceLoaderData({
          workflow: groundingWithNextTurn,
          turns: [answeredTurn, nextTurn],
        }),
      );
    });
    entityInvalidate.mockImplementationOnce(async () => {
      const answeredTurnWithCapture: SpecificationTurn = {
        ...answeredTurn,
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
        captured_items: [
          {
            collection: 'knowledge_item',
            kind: 'context',
            id: 1,
            content: 'The launch still targets desktop first',
            referenceCode: createKnowledgeReferenceCode('context', 1),
          },
        ],
      };

      setLoaderData(
        createWorkspaceLoaderData({
          workflow: groundingWithNextTurn,
          turns: [answeredTurnWithCapture, nextTurn],
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

    const rendered = renderWorkspace();

    fireEvent.change(await screen.findByLabelText('Additional response context'), {
      target: { value: 'Best fit for our launch' },
    });
    fireEvent.click(await screen.findByRole('checkbox', { name: /desktop/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByTestId('turn-processing-state')).toBeTruthy();
    });
    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalledTimes(1);
    });
    setLoaderData(
      createWorkspaceLoaderData({
        workflow: groundingWithNextTurn,
        turns: [answeredTurn, nextTurn],
      }),
    );
    await act(async () => {
      rendered.rerender(
        <QueryClientProvider client={rendered.queryClient}>
          <InterviewView phase="grounding" />
        </QueryClientProvider>,
      );
    });
    await waitFor(() => {
      expect(screen.getByText('2 Turns')).toBeTruthy();
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
        createUnacknowledgedQuestionMessage(),
      ]);
      useChatHarness.setStatus?.('ready');
    });

    await waitFor(() => {
      expect(screen.getByTestId('answered-turn-card').textContent).toContain('Still thinking…');
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
      expect(screen.getByTestId('answered-turn-card').textContent).toContain(
        createKnowledgeReferenceCode('context', 1),
      );
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

    expect(answeredCard.textContent).toContain('Choices:');
    expect(answeredCard.textContent).toContain('2');
    expect(answeredCard.textContent).toContain('Best fit for launch');
  });

  it('shows term captures in the compact answered card', async () => {
    const goalCode = createKnowledgeReferenceCode('goal', 1);
    const termCode = createKnowledgeReferenceCode('term', 1);

    setLoaderData(
      createWorkspaceLoaderData({
        turns: [
          {
            id: 1,
            specification_id: 1,
            parent_turn_id: null,
            phase: 'grounding',
            turn_kind: 'question',
            question: 'What should we build first?',
            why: 'This frames the first iteration.',
            impact: 'high',
            answer: 'Build the web app',
            is_resolution: false,
            user_parts: JSON.stringify([{ type: 'text', text: 'Build the web app' }]),
            assistant_parts: JSON.stringify([
              { type: 'text', text: 'What should we build first?' },
              {
                type: 'data-observer-result',
                data: {
                  turnId: 1,
                  entityIds: {
                    goals: [1],
                    terms: [2],
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
            options: [],
            captured_items: [
              {
                collection: 'knowledge_item',
                kind: 'goal',
                id: 1,
                content: 'Ship the web app first',
                referenceCode: goalCode,
              },
              {
                collection: 'knowledge_item',
                kind: 'term',
                id: 2,
                content: 'Visible term',
                referenceCode: termCode,
              },
            ],
          },
        ],
      }),
    );

    renderWorkspace();

    const answeredCard = await screen.findByTestId('answered-turn-card');

    expect(answeredCard.textContent).toContain(goalCode);
    expect(answeredCard.textContent).toContain(termCode);
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

    expect(answeredCard.textContent).toContain('Choices:');
    expect(answeredCard.textContent).toContain('None');
    expect(answeredCard.textContent).toContain('None of these fit our use case');
    expect(screen.queryByLabelText('Additional response context')).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /web/i })).toBeNull();
  });

  it('shows a visible error when saving an option selection fails', async () => {
    setLoaderData(
      createWorkspaceLoaderData({
        answer: '',
        userParts: [],
        phase: 'design',
        options: [
          { id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false },
          { id: 12, position: 1, content: 'Desktop', is_recommended: false, is_selected: false },
        ],
        workflow: createWorkflowState({
          grounding: { status: 'closed' },
          design: { status: 'in_progress', turnId: 1 },
        }),
      }),
    );

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Selection could not be saved' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderWorkspace('design');

    fireEvent.click(await screen.findByRole('checkbox', { name: /desktop/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Selection could not be saved');
    expect(routerInvalidate).not.toHaveBeenCalled();
    expect(entityInvalidate).not.toHaveBeenCalled();
    expect(useChatHarness.sendMessage).not.toHaveBeenCalled();
  });
});
