import { describe, expect, it } from 'vitest';

import { renderWorkspaceSnapshot, workspaceSnapshotFromState } from './print-snapshot.js';
import type { WorkspaceSessionState } from './workspace-session-coordinator.js';

const cwd = '/tmp/brunch-project';

function readyState(): WorkspaceSessionState {
  return {
    status: 'ready',
    cwd,
    spec: { id: 1, title: 'Alpha spec' },
    session: {
      id: 'session-1',
      file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
      manager: {} as WorkspaceSessionState & never,
    },
    chrome: {
      cwd,
      spec: { id: 1, title: 'Alpha spec' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
    },
  };
}

describe('print snapshot', () => {
  it('projects and renders a ready workspace without exposing pi internals', () => {
    const snapshot = workspaceSnapshotFromState(readyState());

    expect(snapshot).toEqual({
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
    expect(renderWorkspaceSnapshot(snapshot)).toContain('status: ready');
    expect(renderWorkspaceSnapshot(snapshot)).toContain('spec: Alpha spec (1)');
    expect(renderWorkspaceSnapshot(snapshot)).toContain('session: session-1');
  });

  it('renders select-spec as a snapshot instead of prompting', () => {
    const snapshot = workspaceSnapshotFromState({
      status: 'select_spec',
      cwd,
      chrome: {
        cwd,
        spec: null,
        phase: 'select_spec',
        chatMode: 'select-spec',
      },
    });

    expect(renderWorkspaceSnapshot(snapshot)).toContain('status: select_spec');
    expect(renderWorkspaceSnapshot(snapshot)).toContain('spec: <none>');
    expect(renderWorkspaceSnapshot(snapshot)).not.toContain('session:');
  });
});
