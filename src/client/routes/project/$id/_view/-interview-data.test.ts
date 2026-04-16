import { describe, expect, it } from 'vitest';

import type { ProjectState } from '@/shared/api-types.js';
import type { BrunchUIMessage } from '@/shared/chat.js';

import {
  buildPhaseTurnIds,
  createInterviewControllerViewState,
  createInterviewDurableProjectState,
  createInterviewEphemeralChatState,
  filterMessagesByPhase,
  getAcceptedClosureReplay,
  getPersistedSelectedPositions,
} from './-interview-controller-core.js';

function createProjectState({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  userParts = [{ type: 'text', text: answer }] as Array<Record<string, unknown>>,
  options = [],
  workflow,
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
        turn_kind: 'question',
        question: assistantText,
        why: 'This frames the first iteration.',
        impact: 'high',
        answer,
        is_resolution: false,
        user_parts: JSON.stringify(userParts),
        assistant_parts: JSON.stringify(assistantText ? [{ type: 'text', text: assistantText }] : []),
        created_at: '2026-04-03 10:00:00',
        options,
      },
    ],
  };
}

describe('workspace controller core', () => {
  it('separates durable project state from ephemeral chat seed state', () => {
    const projectState = createProjectState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });

    const durableProject = createInterviewDurableProjectState(projectState);
    const ephemeralChat = createInterviewEphemeralChatState(projectState);

    expect(durableProject.project).toEqual(projectState.project);
    expect(durableProject.turns).toEqual(projectState.turns);
    expect(durableProject.lastTurn?.id).toBe(1);
    expect(durableProject.showTurnCard).toBe(true);
    expect(durableProject.lastTurnHasResponse).toBe(false);

    expect(ephemeralChat.seedMessages).toEqual([
      {
        id: 'turn-1-answer',
        role: 'user',
        parts: [{ type: 'text', text: 'Build the web app' }],
      },
      {
        id: 'turn-1-assistant',
        role: 'assistant',
        parts: [{ type: 'text', text: 'What should we build first?' }],
      },
    ]);
  });

  it('derives fresh seed messages from persisted turns without owning hydration timing', () => {
    const initialProjectState = createProjectState({
      assistantText: 'What should we build first?',
      answer: 'Build the web app',
    });
    const refreshedProjectState = createProjectState({
      projectId: initialProjectState.project.id,
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
    });

    const initialChat = createInterviewEphemeralChatState(initialProjectState);
    const refreshedChat = createInterviewEphemeralChatState(refreshedProjectState);

    expect(refreshedChat.seedMessages).not.toEqual(initialChat.seedMessages);
  });

  it('builds phase turn ID sets from persisted turns', () => {
    const projectState = createProjectState();
    const scopeIds = buildPhaseTurnIds(projectState.turns, 'scope');
    const designIds = buildPhaseTurnIds(projectState.turns, 'design');

    expect(scopeIds).toEqual(new Set([1]));
    expect(designIds).toEqual(new Set());
  });

  it('filters hydrated messages to only those belonging to the target phase', () => {
    const messages: BrunchUIMessage[] = [
      { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Scope answer' }] },
      { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Scope question' }] },
      { id: 'turn-2-answer', role: 'user', parts: [{ type: 'text', text: 'Design answer' }] },
      { id: 'turn-2-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Design question' }] },
      { id: 'streaming-msg', role: 'assistant', parts: [{ type: 'text', text: 'Live message' }] },
    ];
    const scopeTurnIds = new Set([1]);

    const filtered = filterMessagesByPhase(messages, scopeTurnIds);

    expect(filtered).toEqual([
      { id: 'turn-1-answer', role: 'user', parts: [{ type: 'text', text: 'Scope answer' }] },
      { id: 'turn-1-assistant', role: 'assistant', parts: [{ type: 'text', text: 'Scope question' }] },
      { id: 'streaming-msg', role: 'assistant', parts: [{ type: 'text', text: 'Live message' }] },
    ]);
  });

  it('derives persisted selected positions from structured turn responses instead of option flags', () => {
    const selectedResponseTurn = createProjectState({
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
    }).turns[0];

    expect(getPersistedSelectedPositions(selectedResponseTurn)).toEqual([1]);
  });

  it('projects a pending phase-summary confirmation card from persisted workflow state and assistant parts', () => {
    const proposedScope = createInterviewDurableProjectState(
      createProjectState({
        assistantText: '',
        answer: 'We have enough scope context',
        userParts: [{ type: 'text', text: 'We have enough scope context' }],
        workflow: {
          phases: {
            scope: {
              status: 'in_progress',
              closeability: true,
              readiness: 'high',
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
        },
      }),
    );
    const messages: BrunchUIMessage[] = [
      {
        id: 'turn-1-assistant',
        role: 'assistant',
        parts: [
          {
            type: 'data-phase-summary',
            data: {
              turnId: 1,
              phase: 'scope',
              summary: 'Goals, terms, context, and constraints are sufficiently captured.',
            },
          },
        ],
      },
    ];

    expect(createInterviewControllerViewState(proposedScope, 'scope', messages, false)).toEqual({
      project: proposedScope.project,
      workflow: proposedScope.workflow,
      turnCard: null,
      phaseSummary: {
        phase: 'scope',
        turnId: 1,
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
      },
      showGeneratingState: false,
      promptInput: { visible: false },
    });
  });

  it('projects recovery turn-card visibility from the persisted frontier turn kind', () => {
    const recoveryState = createInterviewDurableProjectState({
      project: {
        id: 1,
        name: 'Project 1',
        mode: 'greenfield',
        cwd: null,
        active_turn_id: 2,
        created_at: '2026-04-03 10:00:00',
        updated_at: '2026-04-03 10:00:00',
      },
      workflow: {
        phases: {
          scope: {
            status: 'in_progress',
            closeability: false,
            readiness: 'medium',
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
      turns: [
        {
          id: 1,
          project_id: 1,
          parent_turn_id: null,
          phase: 'scope',
          turn_kind: 'question',
          question: 'What should we build first?',
          why: 'This frames the first iteration.',
          impact: 'high',
          answer: 'Build the web app',
          is_resolution: false,
          user_parts: JSON.stringify([{ type: 'text', text: 'Build the web app' }]),
          assistant_parts: JSON.stringify([{ type: 'text', text: 'What should we build first?' }]),
          created_at: '2026-04-03 10:00:00',
          options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
        },
        {
          id: 2,
          project_id: 1,
          parent_turn_id: 1,
          phase: 'scope',
          turn_kind: 'recovery',
          question: '',
          why: null,
          impact: null,
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-03 10:01:00',
          options: [],
        },
      ],
    });

    expect(createInterviewControllerViewState(recoveryState, 'scope', [], false)).toEqual({
      project: recoveryState.project,
      workflow: recoveryState.workflow,
      turnCard: { kind: 'recovery', recovery: { phase: 'scope' } },
      phaseSummary: null,
      showGeneratingState: false,
      promptInput: { visible: false },
    });
    expect(createInterviewControllerViewState(recoveryState, 'scope', [], true)).toEqual({
      project: recoveryState.project,
      workflow: recoveryState.workflow,
      turnCard: null,
      phaseSummary: null,
      showGeneratingState: true,
      promptInput: { visible: false },
    });
  });

  it('projects kickoff turn-card visibility from the persisted frontier turn kind', () => {
    const kickoffState = createInterviewDurableProjectState({
      project: {
        id: 1,
        name: 'Project 1',
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
          project_id: 1,
          parent_turn_id: null,
          phase: 'scope',
          turn_kind: 'kickoff',
          question: '',
          why: null,
          impact: null,
          answer: null,
          is_resolution: false,
          user_parts: null,
          assistant_parts: null,
          created_at: '2026-04-03 10:00:00',
          options: [],
        },
      ],
    });

    expect(createInterviewControllerViewState(kickoffState, 'scope', [], false)).toEqual({
      project: kickoffState.project,
      workflow: kickoffState.workflow,
      turnCard: { kind: 'kickoff', kickoff: { phase: 'scope', mode: 'start' } },
      phaseSummary: null,
      showGeneratingState: false,
      promptInput: { visible: false },
    });
  });

  it('keeps a submitted turn card mounted until interviewer completion reveals the next step', () => {
    const submittedResponse = createInterviewDurableProjectState(
      createProjectState({
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
        workflow: {
          phases: {
            scope: {
              status: 'in_progress',
              closeability: false,
              readiness: 'medium',
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
      }),
    );

    expect(createInterviewControllerViewState(submittedResponse, 'scope', [], true, 1)).toEqual({
      project: submittedResponse.project,
      workflow: submittedResponse.workflow,
      turnCard: { kind: 'persisted-turn', turn: submittedResponse.lastTurn!, state: 'submitted' },
      phaseSummary: null,
      showGeneratingState: false,
      promptInput: { visible: false },
    });
  });

  it('projects a pending question before any durable turn exists', () => {
    const emptyProjectState: ProjectState = {
      project: {
        id: 1,
        name: 'Project 1',
        mode: 'greenfield',
        cwd: null,
        active_turn_id: null,
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
      turns: [],
    };
    const liveMessages: BrunchUIMessage[] = [
      {
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
            output: { ok: true, turnId: 1, optionCount: 2 },
          },
        ],
      },
    ];

    const durableProject = createInterviewDurableProjectState(emptyProjectState);
    const ephemeralChat = createInterviewEphemeralChatState(emptyProjectState);
    const viewState = createInterviewControllerViewState(durableProject, 'scope', liveMessages, true);

    expect(ephemeralChat.seedMessages).toEqual([]);
    expect(viewState.project).toEqual(emptyProjectState.project);
    expect(viewState.workflow).toEqual(emptyProjectState.workflow);
    expect(viewState.promptInput.visible).toBe(false);
    expect(viewState.turnCard).toEqual({
      kind: 'pending-question',
      pendingQuestion: {
        id: 'pending-question-assistant:tool-1',
        question: 'Which platform should we target next?',
        why: 'Platform shapes the first build.',
        impact: 'high',
        options: [
          { position: 0, content: 'Web', is_recommended: true },
          { position: 1, content: 'Desktop', is_recommended: false },
        ],
      },
    });
    expect(viewState.phaseSummary).toBeNull();
    expect(viewState.showGeneratingState).toBe(false);
  });

  it('interprets accepted interviewer-recommended closure replay from the same durable turn', () => {
    const projectState = createProjectState({
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
            status: 'in_progress',
            closeability: false,
            readiness: 'low',
            closureBasis: null,
            proposalPending: false,
            turnId: 3,
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
    });
    projectState.turns = [
      projectState.turns[0],
      {
        id: 2,
        project_id: 1,
        parent_turn_id: 1,
        phase: 'scope',
        question: '',
        why: null,
        impact: null,
        answer: 'Confirm grounding closure',
        is_resolution: false,
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
    ];

    expect(getAcceptedClosureReplay(projectState.turns[1]!, projectState.workflow.phases.scope)).toEqual({
      turnId: 2,
      phase: 'scope',
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
  });

  it('keeps turn-card projection scoped to the current phase', () => {
    const projectState = createProjectState({
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
      },
    });
    projectState.turns = [
      projectState.turns[0],
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
    ];
    projectState.project.active_turn_id = 2;

    const durableProject = createInterviewDurableProjectState(projectState);

    expect(createInterviewControllerViewState(durableProject, 'scope', [], false)).toEqual({
      project: durableProject.project,
      workflow: durableProject.workflow,
      turnCard: null,
      phaseSummary: null,
      showGeneratingState: false,
      promptInput: { visible: true },
    });
    expect(createInterviewControllerViewState(durableProject, 'design', [], false)).toEqual({
      project: durableProject.project,
      workflow: durableProject.workflow,
      turnCard: {
        kind: 'persisted-turn',
        turn: projectState.turns[1]!,
        state: 'active',
      },
      phaseSummary: null,
      showGeneratingState: false,
      promptInput: { visible: false },
    });
  });
});
