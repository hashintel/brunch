import { describe, expect, it } from 'vitest';

import type { BrunchSessionEnvelope } from '../../../session/brunch-session-envelope.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentState,
} from '../../../session/runtime-state.js';
import { createSessionBindingData } from '../../../session/session-binding.js';
import { projectSessionRuntimeState } from '../runtime-state.js';

function envelope(entries: BrunchSessionEnvelope['entries'] = []): BrunchSessionEnvelope {
  return {
    header: { type: 'session', id: 'session-1', cwd: '/tmp/brunch' } as never,
    binding: createSessionBindingData({ specId: 1 }),
    entries: [
      { type: 'session', id: 'session-1', cwd: '/tmp/brunch' } as never,
      {
        id: 'binding-1',
        type: 'custom',
        parentId: null,
        customType: 'brunch.session_binding',
        data: createSessionBindingData({ specId: 1 }),
      } as never,
      ...entries,
    ],
  };
}

function runtimeEntry(id: string, state: BrunchAgentState, parentId = 'binding-1') {
  return {
    id,
    type: 'custom',
    parentId,
    customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
    data: {
      schemaVersion: 1,
      reason: 'switch',
      state,
      source: 'user',
    },
  } as never;
}

describe('runtime-state projection', () => {
  it('ignores stale legacy runtime fields while projecting only public mode/role posture', () => {
    const legacyAxisState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'specify',
      agentStrategy: 'freestyle',
      agentLens: 'intent',
    } as unknown as BrunchAgentState;

    expect(
      projectSessionRuntimeState(envelope([runtimeEntry('runtime-legacy-axes', legacyAxisState)])),
    ).toMatchObject({
      agent: {
        operationalMode: 'specify',
        role: 'elicitor',
      },
    });
    expect(
      projectSessionRuntimeState(envelope([runtimeEntry('runtime-legacy-axes', legacyAxisState)])).agent,
    ).not.toHaveProperty('strategy');
  });

  it('returns flattened defaults for an explicit linear session with no runtime entries', () => {
    expect(projectSessionRuntimeState(envelope())).toEqual({
      status: 'ready',
      specId: 1,
      sessionId: 'session-1',
      agent: {
        operationalMode: DEFAULT_BRUNCH_AGENT_STATE.operationalMode,
        role: 'elicitor',
      },
      mentions: { graphNodes: [], files: [] },
      world: { graph: { latestLsn: null }, git: { head: null } },
      lifecycle: {
        specOrigin: null,
        sessionOrigin: null,
        sessionIndexInSpec: null,
        isFirstSessionForSpec: null,
        isTenthSessionForSpec: null,
      },
    });
  });

  it('projects last-writer-wins runtime posture plus mention, world, and lifecycle slots', () => {
    const first: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'specify',
    };
    const latest: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'execute',
    };

    expect(
      projectSessionRuntimeState(
        envelope([
          runtimeEntry('runtime-1', first),
          {
            id: 'mention-1',
            type: 'custom',
            parentId: 'runtime-1',
            customType: 'brunch.mention',
            data: { entityId: 'node-1', handle: 'D12', title: 'Decision seam', seenLsn: 7 },
          } as never,
          {
            id: 'file-mention-1',
            type: 'custom',
            parentId: 'mention-1',
            customType: 'brunch.file_mention',
            data: { path: 'src/session/runtime-state.ts', gitHead: 'abc123' },
          } as never,
          {
            id: 'world-1',
            type: 'custom',
            parentId: 'file-mention-1',
            customType: 'worldUpdate',
            details: {
              changedSinceLsn: 12,
              items: [{ id: 'node-1' }],
              gitHead: 'def456',
              rawBag: { hidden: true },
            },
          } as never,
          {
            id: 'lifecycle-1',
            type: 'custom',
            parentId: 'world-1',
            customType: 'brunch.session_lifecycle',
            data: { specOrigin: 'existing', sessionOrigin: 'resumed', sessionIndexInSpec: 10 },
          } as never,
          runtimeEntry('runtime-2', latest, 'lifecycle-1'),
        ]),
      ),
    ).toMatchObject({
      agent: {
        operationalMode: 'execute',
        role: 'executor',
      },
      mentions: {
        graphNodes: [{ id: 'node-1', handle: 'D12', title: 'Decision seam', seenLsn: 7 }],
        files: [{ path: 'src/session/runtime-state.ts', seenGitHead: 'abc123' }],
      },
      world: {
        graph: {
          latestLsn: 12,
        },
        git: { head: 'def456' },
      },
      lifecycle: {
        specOrigin: 'existing',
        sessionOrigin: 'resumed',
        sessionIndexInSpec: 10,
        isFirstSessionForSpec: false,
        isTenthSessionForSpec: true,
      },
    });
  });

  it('projects runtime posture from an active-branch envelope without rejecting Pi tree metadata', () => {
    const projection = projectSessionRuntimeState(
      envelope([
        {
          id: 'summary-1',
          type: 'branch_summary',
          parentId: 'binding-1',
          fromId: 'abandoned-runtime',
          summary: 'Abandoned sibling summary',
        } as never,
        runtimeEntry('active-runtime', {
          schemaVersion: 1,
          operationalMode: 'execute',
        }),
      ]),
    );

    expect(projection.agent).toEqual({ operationalMode: 'execute', role: 'executor' });
  });
});
