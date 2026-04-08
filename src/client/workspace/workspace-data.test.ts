import { describe, expect, it } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
import type { BrunchUIMessage } from '../../shared/chat.js';
import {
  createWorkspaceControllerViewState,
  createWorkspaceDurableEntityState,
  createWorkspaceDurableProjectState,
  createWorkspaceEphemeralChatState,
} from './workspace-controller-core.js';

function createProjectState({
  projectId = 1,
  assistantText = 'What should we build first?',
  answer = 'Build the web app',
  userParts = [{ type: 'text', text: answer }] as Array<Record<string, unknown>>,
  options = [],
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
        user_parts: JSON.stringify(userParts),
        assistant_parts: JSON.stringify([{ type: 'text', text: assistantText }]),
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

    const durableProject = createWorkspaceDurableProjectState(projectState);
    const ephemeralChat = createWorkspaceEphemeralChatState(projectState);

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

    const initialChat = createWorkspaceEphemeralChatState(initialProjectState);
    const refreshedChat = createWorkspaceEphemeralChatState(refreshedProjectState);

    expect(refreshedChat.seedMessages).not.toEqual(initialChat.seedMessages);
  });

  it('prefers refreshed entity query data while preserving loader snapshot fallback', () => {
    const entitySnapshot: EntitiesData = {
      framing: [],
      constraints: [
        {
          id: 4,
          project_id: 1,
          kind: 'constraint',
          subtype: 'non-goal',
          content: 'Keep setup instant',
          rationale: 'Avoid a heavy launcher',
        },
      ],
      requirements: [
        {
          id: 5,
          project_id: 1,
          kind: 'requirement',
          subtype: null,
          content: 'Support resume',
          rationale: 'Users leave mid-flow',
        },
      ],
      criteria: [],
      decisions: [{ id: 1, project_id: 1, content: 'Loader decision', rationale: null }],
      assumptions: [{ id: 2, project_id: 1, content: 'Loader assumption' }],
      relationships: [
        {
          type: 'depends_on',
          source: { collection: 'decision', kind: 'decision', id: 1 },
          target: { collection: 'assumption', kind: 'assumption', id: 2 },
        },
      ],
    };
    const refreshedEntities: EntitiesData = {
      framing: [
        {
          id: 6,
          project_id: 1,
          kind: 'framing',
          subtype: null,
          content: 'Refetched framing item',
          rationale: null,
        },
      ],
      constraints: [],
      requirements: [],
      criteria: [
        {
          id: 7,
          project_id: 1,
          kind: 'criterion',
          subtype: 'acceptance',
          content: 'Refetched criterion',
          rationale: 'Protects refresh behavior',
        },
      ],
      decisions: [{ id: 3, project_id: 1, content: 'Refetched decision', rationale: 'Newer' }],
      assumptions: [],
      relationships: [
        {
          type: 'depends_on',
          source: { collection: 'decision', kind: 'decision', id: 3 },
          target: { collection: 'knowledge_item', kind: 'framing', id: 6 },
        },
      ],
    };

    expect(createWorkspaceDurableEntityState(entitySnapshot, undefined, true)).toEqual({
      framing: entitySnapshot.framing,
      constraints: entitySnapshot.constraints,
      requirements: entitySnapshot.requirements,
      criteria: entitySnapshot.criteria,
      decisions: entitySnapshot.decisions,
      assumptions: entitySnapshot.assumptions,
      relationships: entitySnapshot.relationships,
      isLoading: true,
    });

    expect(createWorkspaceDurableEntityState(entitySnapshot, refreshedEntities, false)).toEqual({
      framing: refreshedEntities.framing,
      constraints: refreshedEntities.constraints,
      requirements: refreshedEntities.requirements,
      criteria: refreshedEntities.criteria,
      decisions: refreshedEntities.decisions,
      assumptions: refreshedEntities.assumptions,
      relationships: refreshedEntities.relationships,
      isLoading: false,
    });
  });

  it('projects prompt and turn-card visibility from persisted turn responses without embedding side effects', () => {
    const pendingResponse = createWorkspaceDurableProjectState(
      createProjectState({
        options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
      }),
    );
    const selectedResponse = createWorkspaceDurableProjectState(
      createProjectState({
        answer: 'Web — Best fit for launch',
        userParts: [
          { type: 'text', text: 'Web — Best fit for launch' },
          {
            type: 'data-turn-response',
            data: { turnId: 1, selectedOptionIds: [11], freeText: 'Best fit for launch' },
          },
        ],
        options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: true }],
      }),
    );
    const freeTextOnlyResponse = createWorkspaceDurableProjectState(
      createProjectState({
        answer: 'None of these fit our use case',
        userParts: [
          { type: 'text', text: 'None of these fit our use case' },
          {
            type: 'data-turn-response',
            data: { turnId: 1, selectedOptionIds: [], freeText: 'None of these fit our use case' },
          },
        ],
        options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
      }),
    );

    expect(createWorkspaceControllerViewState(pendingResponse, [], false)).toEqual({
      project: pendingResponse.project,
      turnCard: { kind: 'persisted-turn', turn: pendingResponse.lastTurn! },
      promptInput: { visible: false },
    });
    expect(createWorkspaceControllerViewState(pendingResponse, [], true)).toEqual({
      project: pendingResponse.project,
      turnCard: null,
      promptInput: { visible: false },
    });
    expect(createWorkspaceControllerViewState(selectedResponse, [], false)).toEqual({
      project: selectedResponse.project,
      turnCard: { kind: 'persisted-turn', turn: selectedResponse.lastTurn! },
      promptInput: { visible: true },
    });
    expect(createWorkspaceControllerViewState(freeTextOnlyResponse, [], false)).toEqual({
      project: freeTextOnlyResponse.project,
      turnCard: { kind: 'persisted-turn', turn: freeTextOnlyResponse.lastTurn! },
      promptInput: { visible: true },
    });
  });

  it('projects a pending question before any durable turn exists', () => {
    const emptyProjectState: ProjectState = {
      project: {
        id: 1,
        name: 'Project 1',
        active_turn_id: null,
        created_at: '2026-04-03 10:00:00',
        updated_at: '2026-04-03 10:00:00',
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

    const durableProject = createWorkspaceDurableProjectState(emptyProjectState);
    const ephemeralChat = createWorkspaceEphemeralChatState(emptyProjectState);
    const viewState = createWorkspaceControllerViewState(durableProject, liveMessages, true);

    expect(ephemeralChat.seedMessages).toEqual([]);
    expect(viewState.project).toEqual(emptyProjectState.project);
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
  });
});
