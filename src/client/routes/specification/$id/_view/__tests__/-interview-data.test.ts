import { describe, expect, it } from 'vitest';

import type { BrunchUIMessage } from '@/shared/chat.js';
import {
  deriveSpecificationLanding,
  getAcceptedClosureReplay,
  getPersistedSelectedPositions,
} from '@/shared/specification-state.js';
import type { SpecificationState as ProjectState } from '@/shared/specification.js';

import {
  buildPhaseTurnIds,
  createInterviewControllerViewState,
  createInterviewDurableSpecificationState,
  createInterviewEphemeralChatState,
  filterMessagesByPhase,
} from '../-interview-controller-core.js';

function createSpecificationState({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  userParts = [{ type: 'text', text: answer }] as Array<Record<string, unknown>>,
  options = [],
  workflow,
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
  turns?: ProjectState['turns'];
} = {}): ProjectState {
  const resolvedTurns = turns ?? [
    {
      id: 1,
      specification_id: projectId,
      parent_turn_id: null,
      phase: 'grounding',
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
    workflow: workflow ?? {
      phases: {
        grounding: {
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
    turns: resolvedTurns,
  };

  return {
    ...projectState,
    landing: deriveSpecificationLanding(projectState),
  };
}

describe('workspace controller core', () => {
  it('separates durable project state from ephemeral chat seed state', () => {
    const projectState = createSpecificationState({
      options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
    });

    const durableSpecification = createInterviewDurableSpecificationState(projectState);
    const ephemeralChat = createInterviewEphemeralChatState(projectState);

    expect(durableSpecification.project).toEqual(projectState.project);
    expect(durableSpecification.turns).toEqual(projectState.turns);
    expect(durableSpecification.lastTurn?.id).toBe(1);
    expect(durableSpecification.showTurnCard).toBe(true);
    expect(durableSpecification.lastTurnHasResponse).toBe(false);

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
    const initialProjectState = createSpecificationState({
      assistantText: 'What should we build first?',
      answer: 'Build the web app',
    });
    const refreshedProjectState = createSpecificationState({
      projectId: initialProjectState.project!.id,
      assistantText: 'Which platform should we target now?',
      answer: 'Ship the desktop app',
    });

    const initialChat = createInterviewEphemeralChatState(initialProjectState);
    const refreshedChat = createInterviewEphemeralChatState(refreshedProjectState);

    expect(refreshedChat.seedMessages).not.toEqual(initialChat.seedMessages);
  });

  it('hydrates persisted activity summaries alongside observer state on assistant replay messages', () => {
    const projectState = createSpecificationState();
    projectState.turns[0] = {
      ...projectState.turns[0]!,
      assistant_parts: JSON.stringify([
        {
          type: 'data-activity-summary',
          data: { seconds: 3, tools: ['structured question'] },
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
    };

    expect(createInterviewEphemeralChatState(projectState).seedMessages).toEqual([
      {
        id: 'turn-1-answer',
        role: 'user',
        parts: [{ type: 'text', text: 'Build the web app' }],
      },
      {
        id: 'turn-1-assistant',
        role: 'assistant',
        parts: [
          {
            type: 'data-activity-summary',
            data: { seconds: 3, tools: ['structured question'] },
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
        ],
      },
    ]);
  });

  it('builds phase turn ID sets from persisted turns', () => {
    const projectState = createSpecificationState();
    const scopeIds = buildPhaseTurnIds(projectState.turns, 'grounding');
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
    const selectedResponseTurn = createSpecificationState({
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
    const proposedScope = createInterviewDurableSpecificationState(
      createSpecificationState({
        assistantText: '',
        answer: 'We have enough grounding context',
        userParts: [{ type: 'text', text: 'We have enough grounding context' }],
        workflow: {
          phases: {
            grounding: {
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
              phase: 'grounding',
              summary: 'Goals, terms, context, and constraints are sufficiently captured.',
            },
          },
        ],
      },
    ];

    expect(createInterviewControllerViewState(proposedScope, 'grounding', messages, false)).toEqual({
      project: proposedScope.project,
      workflow: proposedScope.workflow,
      bottomArtifact: {
        kind: 'phase-summary',
        phaseSummary: {
          phase: 'grounding',
          turnId: 1,
          summary: 'Goals, terms, context, and constraints are sufficiently captured.',
        },
      },
    });
  });

  it('projects recovery turn-card visibility from the derived landing seam', () => {
    const recoveryState = createInterviewDurableSpecificationState(
      createSpecificationState({
        workflow: {
          phases: {
            grounding: {
              status: 'in_progress',
              closeability: false,
              readiness: 'medium',
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
        options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
      }),
    );

    expect(createInterviewControllerViewState(recoveryState, 'grounding', [], false)).toEqual({
      project: recoveryState.project,
      workflow: recoveryState.workflow,
      bottomArtifact: { kind: 'recovery', recovery: { phase: 'grounding' } },
    });
    expect(createInterviewControllerViewState(recoveryState, 'grounding', [], true)).toEqual({
      project: recoveryState.project,
      workflow: recoveryState.workflow,
      bottomArtifact: { kind: 'generating' },
    });
  });

  it('projects kickoff turn-card visibility from the derived landing seam', () => {
    const kickoffState = createInterviewDurableSpecificationState(
      createSpecificationState({
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
        turns: [],
      }),
    );

    expect(createInterviewControllerViewState(kickoffState, 'grounding', [], false)).toEqual({
      project: kickoffState.project,
      workflow: kickoffState.workflow,
      bottomArtifact: { kind: 'kickoff', kickoff: { phase: 'grounding', mode: 'start' } },
    });
  });

  it('keeps a submitted turn card mounted until interviewer completion reveals the next step', () => {
    const submittedResponse = createInterviewDurableSpecificationState(
      createSpecificationState({
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
            grounding: {
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

    expect(createInterviewControllerViewState(submittedResponse, 'grounding', [], true, 1)).toEqual({
      project: submittedResponse.project,
      workflow: submittedResponse.workflow,
      bottomArtifact: { kind: 'persisted-turn', turn: submittedResponse.lastTurn!, state: 'submitted' },
    });
  });

  it('projects a pending question before any durable turn exists', () => {
    const emptyProjectState: ProjectState = {
      project: {
        id: 1,
        name: 'Project 1',
        mode: 'greenfield',
        active_turn_id: null,
        created_at: '2026-04-03 10:00:00',
        updated_at: '2026-04-03 10:00:00',
      },
      workflow: {
        phases: {
          grounding: {
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

    const durableSpecification = createInterviewDurableSpecificationState(emptyProjectState);
    const ephemeralChat = createInterviewEphemeralChatState(emptyProjectState);
    const viewState = createInterviewControllerViewState(
      durableSpecification,
      'grounding',
      liveMessages,
      true,
    );

    expect(ephemeralChat.seedMessages).toEqual([]);
    expect(viewState.project).toEqual(emptyProjectState.project);
    expect(viewState.workflow).toEqual(emptyProjectState.workflow);
    expect(viewState.bottomArtifact).toEqual({
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
  });

  it('interprets accepted interviewer-recommended closure replay from the same durable turn', () => {
    const projectState = createSpecificationState({
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
        specification_id: 1,
        parent_turn_id: 1,
        phase: 'grounding',
        question: '',
        why: null,
        impact: null,
        answer: 'Confirm grounding closure',
        is_resolution: false,
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
    ];

    expect(getAcceptedClosureReplay(projectState.turns[1]!, projectState.workflow.phases.grounding)).toEqual({
      turnId: 2,
      phase: 'grounding',
      summary: 'Goals, terms, context, and constraints are sufficiently captured.',
    });
  });

  it('keeps turn-card projection scoped to the current phase', () => {
    const projectState = createSpecificationState({
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
      },
    });
    projectState.turns = [
      projectState.turns[0],
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
    ];
    projectState.project!.active_turn_id = 2;
    projectState.landing = deriveSpecificationLanding(projectState);

    const durableSpecification = createInterviewDurableSpecificationState(projectState);

    expect(createInterviewControllerViewState(durableSpecification, 'grounding', [], false)).toEqual({
      project: durableSpecification.project,
      workflow: durableSpecification.workflow,
      bottomArtifact: {
        kind: 'phase-handoff',
        phase: 'grounding',
        nextPhase: 'design',
        summary: 'Goals, terms, context, and constraints are sufficiently captured.',
        isReviewPhase: false,
      },
    });
    expect(createInterviewControllerViewState(durableSpecification, 'design', [], false)).toEqual({
      project: durableSpecification.project,
      workflow: durableSpecification.workflow,
      bottomArtifact: {
        kind: 'persisted-turn',
        turn: projectState.turns[1]!,
        state: 'active',
      },
    });
  });
});
