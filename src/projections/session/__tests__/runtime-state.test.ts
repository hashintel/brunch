import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { assistantMessage } from '../../../probes/test-helpers.js';
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

  it('projects mode and derived role from the selected Pi branch, not the newer abandoned sibling', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-runtime-branch-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch/sessions'));
    manager.appendCustomEntry('brunch.session_binding', createSessionBindingData({ specId: 1 }));
    const forkId = manager.appendMessage(assistantMessage('Choose runtime'));
    const activeRuntimeId = manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
      schemaVersion: 1,
      reason: 'switch',
      state: { schemaVersion: 1, operationalMode: 'specify' },
      source: 'user',
    });
    manager.branch(forkId);
    const abandonedRuntimeId = manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
      schemaVersion: 1,
      reason: 'switch',
      state: { schemaVersion: 1, operationalMode: 'execute' },
      source: 'user',
    });
    manager.branch(activeRuntimeId);

    expect(manager.getEntries().at(-1)).toMatchObject({
      data: { state: { operationalMode: 'execute' } },
    });
    const projection = projectSessionRuntimeState({
      header: manager.getHeader()!,
      binding: createSessionBindingData({ specId: 1 }),
      entries: manager.getBranch(),
    });

    expect(projection.agent).toEqual({ operationalMode: 'specify', role: 'elicitor' });
    expect(JSON.stringify(manager.getTree())).toContain(activeRuntimeId);
    expect(JSON.stringify(manager.getTree())).toContain(abandonedRuntimeId);
    expect(
      manager
        .getBranch()
        .filter((entry) => entry.type === 'custom' && entry.customType === 'brunch.session_binding'),
    ).toHaveLength(1);
    expect(
      manager
        .getEntries()
        .filter((entry) => entry.type === 'custom' && entry.customType === 'brunch.session_binding'),
    ).toHaveLength(1);
  });
});
