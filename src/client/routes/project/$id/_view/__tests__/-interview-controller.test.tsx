// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { BrunchUIMessage } from '@/shared/chat.js';
import { deriveSpecificationLanding } from '@/shared/specification-state.js';
import type { SpecificationState as ProjectState } from '@/shared/specification.js';

import { useInterviewController } from '../-interview-controller.js';
import { resetSpecificationLifecycleRegistryForTesting } from '../-specification-lifecycle.js';

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
  turns,
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
  turns?: ProjectState['turns'];
} = {}): ProjectState {
  const resolvedTurns = turns ?? [
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
  ];

  const projectState: ProjectState = {
    project: {
      id: projectId,
      name: `Project ${projectId}`,
      mode: 'greenfield',
      active_turn_id: resolvedTurns.at(-1)?.id ?? null,
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
    turns: resolvedTurns,
  };

  return {
    ...projectState,
    landing: deriveSpecificationLanding(projectState),
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

function ControllerProbe({ phase = 'scope' }: { phase?: 'scope' | 'design' | 'requirements' | 'criteria' }) {
  const workspace = useInterviewController(phase);

  return (
    <div>
      <div data-testid="project-name">{workspace.project.name}</div>
      <div data-testid="messages">{messageText(workspace.chat.messages)}</div>
      <div data-testid="bottom-artifact-kind">{workspace.bottomArtifact?.kind ?? 'none'}</div>
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
    </div>
  );
}

function renderController(phase: 'scope' | 'design' | 'requirements' | 'criteria' = 'scope') {
  const queryClient = createQueryClient();
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <ControllerProbe phase={phase} />
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
  resetSpecificationLifecycleRegistryForTesting();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('interview controller', () => {
  it('projects a kickoff turn card when an open phase has no active frontier turn yet', async () => {
    currentProjectState = createProjectState({ assistantText: '', answer: '' });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.turns = [];
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

    renderController();

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('kickoff');
    expect(screen.getByTestId('bottom-artifact').textContent).toBe('start:scope');
  });

  it('projects a workspace handoff when the current phase is closed and a later phase remains open', async () => {
    currentProjectState = createProjectState();
    currentProjectState.workflow.phases.scope = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 1,
      summary: 'Grounding is complete.',
    };
    currentProjectState.workflow.phases.design.status = 'in_progress';
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

    renderController();

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('phase-handoff');
    expect(screen.getByTestId('bottom-artifact').textContent).toBe(
      'scope->design:workspace:Grounding is complete.',
    );
  });

  it('projects workflow completion when the final review phase is closed', async () => {
    currentProjectState = createProjectState();
    currentProjectState.workflow.phases.scope.status = 'closed';
    currentProjectState.workflow.phases.scope.readiness = 'high';
    currentProjectState.workflow.phases.design.status = 'closed';
    currentProjectState.workflow.phases.design.readiness = 'high';
    currentProjectState.workflow.phases.requirements.status = 'closed';
    currentProjectState.workflow.phases.requirements.readiness = 'high';
    currentProjectState.workflow.phases.criteria = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 1,
      summary: 'Acceptance criteria are complete.',
    };
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

    renderController('criteria');

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('workflow-complete');
    expect(screen.getByTestId('bottom-artifact').textContent).toBe(
      'criteria:review:Acceptance criteria are complete.',
    );
  });

  it('auto-continues scope recovery when an open phase has a completed turn but no successor frontier', async () => {
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-continue', phase: 'scope' }),
        }),
      );
    });

    expect((await screen.findByTestId('bottom-artifact-kind')).textContent).toBe('generating');
  });

  it('submits the grounding strategy kickoff from landing-only state without a seeded kickoff turn', async () => {
    currentProjectState = createProjectState({ assistantText: '', answer: '', turns: [] });
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

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
        '/api/projects/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-entry', phase: 'scope', mode: 'brownfield' }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalled();
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-entry', phase: 'scope', mode: 'brownfield' },
          },
        ],
      });
    });
  });

  it('submits recovery through the phase-continue intent seam', async () => {
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

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
        '/api/projects/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-continue', phase: 'scope' }),
        }),
      );
    });

    await waitFor(() => {
      expect(routerInvalidate).toHaveBeenCalled();
      expect(useChatHarness.sendMessage).toHaveBeenCalledWith({
        parts: [
          {
            type: 'data-phase-intent',
            data: { kind: 'phase-continue', phase: 'scope' },
          },
        ],
      });
    });
  });

  it('auto-submits a typed phase-entry for the current reachable kickoff phase', async () => {
    currentProjectState = createProjectState({ turns: [] });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentProjectState.workflow.phases.design = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 12,
      summary: 'Elicitation complete.',
    };
    currentProjectState.workflow.phases.requirements = {
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController('requirements');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/phase-intent',
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
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentProjectState.workflow.phases.design = {
      status: 'in_progress',
      closeability: false,
      readiness: 'medium',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentProjectState.turns = [
      {
        ...currentProjectState.turns[0]!,
        phase: 'design',
      },
    ];
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    renderController('design');

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/projects/1/phase-intent',
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
    currentProjectState = createProjectState({ turns: [] });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentProjectState.workflow.phases.design = {
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

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
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentProjectState.workflow.phases.design = {
      status: 'in_progress',
      closeability: false,
      readiness: 'medium',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentProjectState.turns = [
      {
        ...currentProjectState.turns[0]!,
        phase: 'design',
      },
    ];
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

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
    currentProjectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope.turnId = null;
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

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
    currentProjectState = createProjectState({ turns: [] });
    currentProjectState.project!.active_turn_id = null;
    currentProjectState.workflow.phases.scope = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 11,
      summary: 'Grounding complete.',
    };
    currentProjectState.workflow.phases.design = {
      status: 'closed',
      closeability: false,
      readiness: 'high',
      closureBasis: 'interviewer_recommended',
      proposalPending: false,
      turnId: 12,
      summary: 'Elicitation complete.',
    };
    currentProjectState.workflow.phases.requirements = {
      status: 'in_progress',
      closeability: false,
      readiness: 'low',
      closureBasis: null,
      proposalPending: false,
      turnId: null,
      summary: null,
    };
    currentProjectState.landing = deriveSpecificationLanding(currentProjectState);

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

  it('projects a pending-question turn card from the streamed ask_question part before route invalidation', async () => {
    currentProjectState = createProjectState({
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
    currentProjectState = createProjectState({
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
        '/api/projects/1/phase-intent',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind: 'phase-continue', phase: 'scope' }),
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
