// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntitiesData } from '@/shared/api-types.js';
import type { BrunchUIMessage } from '@/shared/chat.js';
import { deriveSpecificationLanding } from '@/shared/specification-state.js';
import type { SpecificationState } from '@/shared/specification.js';

import { useInterviewController } from '../-interview-controller.js';
import { resetSpecificationLifecycleRegistryForTesting } from '../-specification-lifecycle.js';

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
  onData?: UseChatOptions['onData'];
  onFinish?: UseChatOptions['onFinish'];
  onError?: UseChatOptions['onError'];
};

let currentSpecificationState: SpecificationState;
let currentEntityState: EntitiesData;
const routerInvalidate = vi.fn(async () => {});
const fetchMock = vi.fn<typeof fetch>();
const chatTransportOptions: unknown[] = [];
let useChatImpl: (options: UseChatOptions) => {
  messages: BrunchUIMessage[];
  sendMessage: (message: { text?: string; parts?: Array<Record<string, unknown>> }) => Promise<void> | void;
  setMessages: (messages: BrunchUIMessage[]) => void;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  error?: Error;
};
let useChatHarness: UseChatHarness;

const routerNavigate = vi.fn(async () => {});
vi.mock('@tanstack/react-router', () => ({
  useLoaderData: ({ from }: { from: string }) => {
    if (from === '/specification/$id') return currentSpecificationState;
    if (from === '/specification/$id/_view') return currentEntityState;
    throw new Error(`Unexpected useLoaderData from: ${from}`);
  },
  useRouter: () => ({ invalidate: routerInvalidate, navigate: routerNavigate }),
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

function createSpecificationState({
  specificationId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  options = [],
  turns,
}: {
  specificationId?: number;
  assistantText?: string;
  answer?: string;
  options?: Array<{
    id: number;
    position: number;
    content: string;
    is_recommended: boolean;
    is_selected: boolean;
  }>;
  turns?: SpecificationState['turns'];
} = {}): SpecificationState {
  const resolvedTurns = turns ?? [
    {
      id: 1,
      specification_id: specificationId,
      parent_turn_id: null,
      phase: 'grounding',
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
  ];

  const specificationState: SpecificationState = {
    specification: {
      id: specificationId,
      name: `Specification ${specificationId}`,
      mode: 'greenfield',
      active_turn_id: resolvedTurns.at(-1)?.id ?? null,
      created_at: '2026-04-03 10:00:00',
      updated_at: '2026-04-03 10:00:00',
    },
    workflow: {
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
    ...specificationState,
    landing: deriveSpecificationLanding(specificationState),
  };
}

function createUseChatHarness(status: 'ready' | 'submitted' | 'streaming' | 'error' = 'ready') {
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
    useChatHarness.onError = options.onError;
    useChatHarness.replaceMessages = stableSetMessages;

    return {
      messages: chatStates.get(chatId) ?? options.messages,
      sendMessage,
      setMessages: stableSetMessages,
      status,
      error: undefined,
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

function ControllerProbe({
  phase = 'grounding',
}: {
  phase?: 'grounding' | 'design' | 'requirements' | 'criteria';
}) {
  const workspace = useInterviewController(phase, currentEntityState);

  return (
    <div>
      <div data-testid="project-name">{workspace.specification.name}</div>
      <div data-testid="messages">{messageText(workspace.chat.messages)}</div>
      <div data-testid="bottom-artifact-kind">{workspace.bottomArtifact?.kind ?? 'none'}</div>
      <div data-testid="bottom-artifact-live-activity">
        {workspace.bottomArtifact?.kind === 'persisted-turn' ||
        workspace.bottomArtifact?.kind === 'pending-question' ||
        workspace.bottomArtifact?.kind === 'generating'
          ? JSON.stringify(workspace.bottomArtifact.liveActivity ?? null)
          : 'null'}
      </div>
      <div data-testid="bottom-artifact">
        {workspace.bottomArtifact?.kind === 'persisted-turn'
          ? workspace.bottomArtifact.turn.question
          : workspace.bottomArtifact?.kind === 'pending-question'
            ? workspace.bottomArtifact.pendingQuestion.question
            : workspace.bottomArtifact?.kind === 'kickoff'
              ? `${workspace.bottomArtifact.kickoff.mode}:${workspace.bottomArtifact.kickoff.phase}`
              : workspace.bottomArtifact?.kind === 'recovery'
                ? `recovery:${workspace.bottomArtifact.recovery.phase}`
                : workspace.bottomArtifact?.kind === 'phase-handoff'
                  ? `${workspace.bottomArtifact.phase}->${workspace.bottomArtifact.nextPhase}:${workspace.bottomArtifact.isReviewPhase ? 'review' : 'workspace'}:${workspace.bottomArtifact.summary ?? 'no-summary'}`
                  : workspace.bottomArtifact?.kind === 'workflow-complete'
                    ? `${workspace.bottomArtifact.phase}:${workspace.bottomArtifact.isReviewPhase ? 'review' : 'workspace'}:${workspace.bottomArtifact.summary ?? 'no-summary'}`
                    : 'none'}
      </div>
      <button
        type="button"
        data-testid="submit-kickoff-brownfield"
        onClick={() => {
          if (workspace.bottomArtifact?.kind === 'kickoff') {
            workspace.bottomArtifact.submitKickoff('brownfield');
          }
        }}
      >
        Submit brownfield kickoff
      </button>
      <button
        type="button"
        data-testid="submit-recovery"
        onClick={() => {
          if (workspace.bottomArtifact?.kind === 'recovery') {
            workspace.bottomArtifact.submitRecovery();
          }
        }}
      >
        Submit recovery
      </button>
      <button
        type="button"
        data-testid="force-close-phase"
        onClick={() => {
          workspace.chat.forcePhaseClosure(phase);
        }}
      >
        Force close phase
      </button>
    </div>
  );
}

function renderController(phase: 'grounding' | 'design' | 'requirements' | 'criteria' = 'grounding') {
  const queryClient = createQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ControllerProbe phase={phase} />
    </QueryClientProvider>,
  );

  return { ...rendered, queryClient };
}

beforeEach(() => {
  currentSpecificationState = createSpecificationState();
  currentEntityState = createEntityState();
  routerInvalidate.mockClear();
  routerNavigate.mockClear();
  fetchMock.mockReset();
  chatTransportOptions.length = 0;
  useChatImpl = createUseChatHarness();
  resetSpecificationLifecycleRegistryForTesting();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('interview controller', () => {
  it('projects a kickoff turn card when an open phase has no active frontier turn yet', async () => {
    currentSpecificationState = createSpecificationState({ assistantText: '', answer: '' });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding.turnId = null;
    currentSpecificationState.turns = [];
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    renderController();

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('kickoff');
    expect(screen.getByTestId('bottom-artifact').textContent).toBe('start:grounding');
  });

  it('projects a workspace handoff when the current phase is closed and a later phase remains open', async () => {
    currentSpecificationState = createSpecificationState();
    currentSpecificationState.workflow.phases.grounding = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 1,
      summary: 'Grounding is complete.',
    };
    currentSpecificationState.workflow.phases.design.status = 'in_progress';
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    renderController();

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('phase-handoff');
    expect(screen.getByTestId('bottom-artifact').textContent).toBe(
      'grounding->design:workspace:Grounding is complete.',
    );
  });

  it('projects workflow completion when the final review phase is closed', async () => {
    currentSpecificationState = createSpecificationState();
    currentSpecificationState.workflow.phases.grounding.status = 'closed';
    currentSpecificationState.workflow.phases.grounding.readiness = 'high';
    currentSpecificationState.workflow.phases.design.status = 'closed';
    currentSpecificationState.workflow.phases.design.readiness = 'high';
    currentSpecificationState.workflow.phases.requirements.status = 'closed';
    currentSpecificationState.workflow.phases.requirements.readiness = 'high';
    currentSpecificationState.workflow.phases.criteria = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 1,
      summary: 'Acceptance criteria are complete.',
    };
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    renderController('criteria');

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('workflow-complete');
    expect(screen.getByTestId('bottom-artifact').textContent).toBe(
      'criteria:review:Acceptance criteria are complete.',
    );
  });

  it('auto-continues grounding recovery when an open phase has a completed turn but no successor frontier', async () => {
    currentSpecificationState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentSpecificationState.workflow.phases.grounding.turnId = null;
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController();

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

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('generating');
  });

  it('submits the grounding strategy kickoff from landing-only state without a seeded kickoff turn', async () => {
    currentSpecificationState = createSpecificationState({ assistantText: '', answer: '', turns: [] });
    currentSpecificationState.workflow.phases.grounding.turnId = null;
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController();

    await screen.findByTestId('bottom-artifact-kind');
    fireEvent.click(screen.getByTestId('submit-kickoff-brownfield'));

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
      expect(routerInvalidate).toHaveBeenCalled();
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

  it('submits recovery through the phase-continue intent seam', async () => {
    currentSpecificationState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentSpecificationState.workflow.phases.grounding.turnId = null;
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController();

    await screen.findByTestId('bottom-artifact-kind');
    fireEvent.click(screen.getByTestId('submit-recovery'));

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
      expect(routerInvalidate).toHaveBeenCalled();
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-continue', phase: 'grounding' },
          },
        ],
      });
    });
  });

  it('auto-submits a typed phase-entry for the current reachable kickoff phase', async () => {
    currentSpecificationState = createSpecificationState({ turns: [] });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentSpecificationState.workflow.phases.design = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 12,
      summary: 'Elicitation complete.',
    };
    currentSpecificationState.workflow.phases.requirements = {
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController('requirements');

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

    expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('generating');
  });

  it('auto-submits a typed phase-continue for the current reachable recovery phase', async () => {
    currentSpecificationState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentSpecificationState.workflow.phases.design = {
      status: 'in_progress',
      closeability: false,
      readiness: 'medium',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentSpecificationState.turns = [
      {
        ...currentSpecificationState.turns[0]!,
        phase: 'design',
      },
    ];
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController('design');

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

    expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('generating');
  });

  it('does not duplicate the auto phase-entry submit across rerender and remount', async () => {
    currentSpecificationState = createSpecificationState({ turns: [] });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentSpecificationState.workflow.phases.design = {
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const rendered = renderController('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ControllerProbe phase="design" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });

    rendered.unmount();
    renderController('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  it('does not duplicate the auto phase-continue submit across rerender and remount', async () => {
    currentSpecificationState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentSpecificationState.workflow.phases.design = {
      status: 'in_progress',
      closeability: false,
      readiness: 'medium',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentSpecificationState.turns = [
      {
        ...currentSpecificationState.turns[0]!,
        phase: 'design',
      },
    ];
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const rendered = renderController('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ControllerProbe phase="design" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });

    rendered.unmount();
    renderController('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });
  });

  it('suppresses repeated auto phase-continue retries after a failed submit until landing changes', async () => {
    currentSpecificationState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding.turnId = null;
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockRejectedValueOnce(new Error('network down'));

    const rendered = renderController();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('recovery');
    });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ControllerProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('recovery');
    });
  });

  it('falls back to the projected kickoff card when auto phase-entry submit rejects', async () => {
    currentSpecificationState = createSpecificationState({ turns: [] });
    currentSpecificationState.specification!.active_turn_id = null;
    currentSpecificationState.workflow.phases.grounding = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentSpecificationState.workflow.phases.design = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 12,
      summary: 'Elicitation complete.',
    };
    currentSpecificationState.workflow.phases.requirements = {
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    useChatHarness.sendMessage.mockRejectedValueOnce(new Error('chat down'));

    const rendered = renderController('requirements');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('kickoff');
      expect(screen.getByTestId('bottom-artifact').textContent).toBe('start:requirements');
    });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ControllerProbe phase="requirements" />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(useChatHarness.sendMessage).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('kickoff');
    });
  });

  it('threads live assistant activity onto the streamed bottom artifact while the next question is generating', async () => {
    currentSpecificationState = createSpecificationState({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderController();

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingQuestionMessage({
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
            ...createPendingQuestionMessage().parts!,
          ],
        }),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('pending-question');
      expect(screen.getByTestId('bottom-artifact-live-activity').textContent).toBe(
        JSON.stringify({ tools: ['lookup workspace context'] }),
      );
    });
  });

  it('projects a pending-question turn card from the streamed ask_question part before route invalidation', async () => {
    currentSpecificationState = createSpecificationState({
      assistantText: 'Earlier question?',
      answer: 'Earlier answer',
    });
    useChatImpl = createUseChatHarness('streaming');

    renderController();

    expect((await screen.findByTestId('bottom-artifact')).textContent).toBe('none');

    await act(async () => {
      useChatHarness.replaceMessages?.([
        { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Earlier answer' }] },
        { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Earlier question?' }] },
        createPendingQuestionMessage(),
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('pending-question');
      expect(screen.getByTestId('bottom-artifact').textContent).toBe('Which platform should we target next?');
      expect(routerInvalidate).not.toHaveBeenCalled();
    });
  });

  it('seeds chat state from loader data while auto-continuing the current reachable recovery phase', async () => {
    currentSpecificationState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );
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
    expect(screen.getByTestId('bottom-artifact-kind').textContent).toBe('generating');
  });

  it('rehydrates the transcript on explicit project navigation', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );

    currentSpecificationState = createSpecificationState({
      specificationId: 2,
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
    });

    rendered.rerender(
      <QueryClientProvider client={rendered.queryClient}>
        <ControllerProbe />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('project-name').textContent).toBe('Specification 2');
      expect(screen.getByTestId('messages').textContent).toBe(
        'Ship the desktop app|Which platform should we target now?',
      );
    });
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('invalidates loader state on observer updates without resetting the live transcript', async () => {
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
      expect(chatTransportOptions).toContainEqual({ api: '/api/specifications/1/chat' });
      expect(routerInvalidate).toHaveBeenCalled();
    });
    expect(screen.getByTestId('messages').textContent).toBe('Build the web app|What should we build first?');
    expect(useChatHarness.setMessages).not.toHaveBeenCalled();
  });

  it('navigates to the next phase after a close-phase submission finishes against closed loader truth', async () => {
    renderController();

    await screen.findByTestId('messages');

    currentSpecificationState.workflow.phases.grounding = {
      ...currentSpecificationState.workflow.phases.grounding,
      status: 'closed',
      readiness: 'high',
      closeability: false,
      closureBasis: 'user_forced',
      turnId: 1,
      summary: 'Grounding is complete.',
    };
    currentSpecificationState.workflow.phases.design = {
      ...currentSpecificationState.workflow.phases.design,
      status: 'in_progress',
    };
    currentSpecificationState.landing = deriveSpecificationLanding(currentSpecificationState);

    fireEvent.click(screen.getByTestId('force-close-phase'));

    await act(async () => {
      useChatHarness.onFinish?.();
    });

    await waitFor(() => {
      expect(routerNavigate).toHaveBeenCalledWith({
        to: '/specification/$id/elicitation',
        params: { id: '1' },
      });
    });
  });

  it('keeps the live transcript stable on same-project refresh', async () => {
    const rendered = renderController();

    expect((await screen.findByTestId('messages')).textContent).toBe(
      'Build the web app|What should we build first?',
    );

    currentSpecificationState = createSpecificationState({
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
