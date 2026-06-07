import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { projectWorkspaceState } from '../../projections/workspace/workspace-state.js';
import type { WorkspaceSessionState } from '../../session/workspace-session-coordinator.js';
import { renderWorkspaceState } from './workspace-state.js';

const cwd = '/tmp/brunch-project';

function readyState(): WorkspaceSessionState {
  return {
    status: 'ready',
    cwd,
    spec: { id: 1, title: 'Alpha spec' },
    session: {
      id: 'session-1',
      file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
      manager: {} as SessionManager,
    },
    chrome: {
      cwd,
      spec: { id: 1, title: 'Alpha spec' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
    },
  };
}

describe('print state', () => {
  it('projects and renders a ready workspace without exposing pi internals', () => {
    const state = projectWorkspaceState(readyState());

    expect(state).toEqual({
      status: 'ready',
      cwd,
      spec: { id: 1, title: 'Alpha spec' },
      session: {
        id: 'session-1',
        file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
      },
      chrome: {
        phase: 'elicitation',
        chatMode: 'responding-to-elicitation',
      },
    });
    expect(renderWorkspaceState(state)).toContain('Brunch workspace state');
    expect(renderWorkspaceState(state)).toContain('status: ready');
    expect(renderWorkspaceState(state)).toContain('spec: Alpha spec (1)');
    expect(renderWorkspaceState(state)).toContain('session: session-1');
  });

  it('renders select-spec as state instead of prompting', () => {
    const state = projectWorkspaceState({
      status: 'select_spec',
      cwd,
      chrome: {
        cwd,
        spec: null,
        phase: 'select_spec',
        chatMode: 'select-spec',
      },
    });

    expect(renderWorkspaceState(state)).toContain('status: select_spec');
    expect(renderWorkspaceState(state)).toContain('spec: <none>');
    expect(renderWorkspaceState(state)).not.toContain('session:');
  });
});
