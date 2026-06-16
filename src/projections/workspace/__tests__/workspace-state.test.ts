import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { WorkspaceSessionState } from '../../../session/workspace-session-coordinator.js';
import { projectWorkspaceState } from '../workspace-state.js';

const cwd = '/tmp/brunch-project';

function readyState(): WorkspaceSessionState {
  return {
    status: 'ready',
    cwd,
    spec: { id: 1, title: 'Alpha spec' },
    session: {
      id: 'session-1',
      file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
      name: 'Alpha session',
      manager: {} as SessionManager,
    },
    chrome: {
      cwd,
      project: { name: 'Brunch', slug: 'brunch' },
      spec: { id: 1, title: 'Alpha spec' },
    },
  };
}

describe('workspace-state projection', () => {
  it('keeps the ready DTO narrow and strips chrome/session-manager internals', () => {
    expect(projectWorkspaceState(readyState())).toEqual({
      status: 'ready',
      cwd,
      spec: { id: 1, title: 'Alpha spec' },
      session: {
        id: 'session-1',
        file: '/tmp/brunch-project/.brunch/sessions/session-1.jsonl',
      },
      chrome: {},
    });
  });

  it('projects needs_human without resurrecting chrome detail fields', () => {
    expect(
      projectWorkspaceState({
        status: 'needs_human',
        cwd,
        reason: 'Pick a spec first.',
        chrome: {
          cwd,
          project: { name: 'Brunch', slug: 'brunch' },
          spec: { id: 7, title: 'Draft spec' },
        },
      }),
    ).toEqual({
      status: 'needs_human',
      cwd,
      spec: { id: 7, title: 'Draft spec' },
      chrome: {},
      reason: 'Pick a spec first.',
    });
  });

  it('projects select_spec as base state with no session or retired chrome fields', () => {
    expect(
      projectWorkspaceState({
        status: 'select_spec',
        cwd,
        chrome: {
          cwd,
          project: { name: 'Brunch', slug: 'brunch' },
          spec: null,
        },
      }),
    ).toEqual({
      status: 'select_spec',
      cwd,
      spec: null,
      chrome: {},
    });
  });
});
