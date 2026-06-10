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
      chrome: {},
    });
    const rendered = renderWorkspaceState(state);
    expect(rendered).toContain('Brunch workspace state');
    expect(rendered).toContain('status: ready');
    expect(rendered).toContain('spec: Alpha spec (1)');
    expect(rendered).toContain('session: session-1');
    expect(rendered).not.toContain('phase:');
    expect(rendered).not.toContain('chatMode:');
  });

  it('renders select-spec as state instead of prompting', () => {
    const state = projectWorkspaceState({
      status: 'select_spec',
      cwd,
      chrome: {
        cwd,
        spec: null,
      },
    });

    expect(renderWorkspaceState(state)).toContain('status: select_spec');
    expect(renderWorkspaceState(state)).toContain('spec: <none>');
    expect(renderWorkspaceState(state)).not.toContain('session:');
  });
});
