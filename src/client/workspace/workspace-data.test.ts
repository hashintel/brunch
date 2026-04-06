import { describe, expect, it } from 'vitest';

import type { EntitiesData, ProjectState } from '../../shared/api-types.js';
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
    expect(durableProject.lastTurnHasSelection).toBe(false);

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
      decisions: [{ id: 1, project_id: 1, content: 'Loader decision', rationale: null }],
      assumptions: [{ id: 2, project_id: 1, content: 'Loader assumption' }],
    };
    const refreshedEntities: EntitiesData = {
      decisions: [{ id: 3, project_id: 1, content: 'Refetched decision', rationale: 'Newer' }],
      assumptions: [],
    };

    expect(createWorkspaceDurableEntityState(entitySnapshot, undefined, true)).toEqual({
      decisions: entitySnapshot.decisions,
      assumptions: entitySnapshot.assumptions,
      isLoading: true,
    });

    expect(createWorkspaceDurableEntityState(entitySnapshot, refreshedEntities, false)).toEqual({
      decisions: refreshedEntities.decisions,
      assumptions: refreshedEntities.assumptions,
      isLoading: false,
    });
  });

  it('projects prompt and turn-card visibility without embedding side effects', () => {
    const pendingSelection = createWorkspaceDurableProjectState(
      createProjectState({
        options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: false }],
      }),
    );
    const selectedTurn = createWorkspaceDurableProjectState(
      createProjectState({
        options: [{ id: 11, position: 0, content: 'Web', is_recommended: true, is_selected: true }],
      }),
    );

    expect(createWorkspaceControllerViewState(pendingSelection, false)).toEqual({
      project: pendingSelection.project,
      turnCard: { turn: pendingSelection.lastTurn! },
      promptInput: { visible: false },
    });
    expect(createWorkspaceControllerViewState(pendingSelection, true)).toEqual({
      project: pendingSelection.project,
      turnCard: null,
      promptInput: { visible: false },
    });
    expect(createWorkspaceControllerViewState(selectedTurn, false)).toEqual({
      project: selectedTurn.project,
      turnCard: { turn: selectedTurn.lastTurn! },
      promptInput: { visible: true },
    });
  });
});
