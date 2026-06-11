import { describe, expect, it } from 'vitest';

import type { WorkspaceState } from '../../projections/workspace/workspace-state.js';
import { renderWorkspaceState } from './workspace-state.js';

const cwd = '/tmp/brunch-project';

function readyState(): WorkspaceState {
  return {
    status: 'ready',
    cwd,
    spec: { id: 1, title: 'Alpha spec' },
    session: {
      id: 'session-1',
      file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
    },
    chrome: {},
  };
}

describe('print state', () => {
  it('renders a ready workspace without exposing retired chrome fields', () => {
    const rendered = renderWorkspaceState(readyState());

    expect(rendered).toContain('Brunch workspace state');
    expect(rendered).toContain('status: ready');
    expect(rendered).toContain('spec: Alpha spec (1)');
    expect(rendered).toContain('session: session-1');
    expect(rendered).not.toContain('phase:');
    expect(rendered).not.toContain('chatMode:');
  });

  it('renders select-spec as state instead of prompting', () => {
    const state: WorkspaceState = {
      status: 'select_spec',
      cwd,
      spec: null,
      chrome: {},
    };

    expect(renderWorkspaceState(state)).toContain('status: select_spec');
    expect(renderWorkspaceState(state)).toContain('spec: <none>');
    expect(renderWorkspaceState(state)).not.toContain('session:');
  });
});
