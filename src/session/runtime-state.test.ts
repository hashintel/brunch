import { describe, expect, it } from 'vitest';

import { projectSessionRuntimeState } from '../projections/session/runtime-state.js';
import { NonLinearTranscriptError, type BrunchSessionEnvelope } from './brunch-session-envelope.js';
import {
  AGENT_STRATEGY_IDS,
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentState,
} from './runtime-state.js';
import { createSessionBindingData } from './session-binding.js';

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

describe('session runtime-state projection', () => {
  it('accepts freestyle as a real strategy id in runtime state parsing', () => {
    expect(AGENT_STRATEGY_IDS).toContain('freestyle');

    const freestyle: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'freestyle',
      agentLens: 'intent',
      agentGoal: 'grounding-advance',
    };

    expect(
      projectSessionRuntimeState(envelope([runtimeEntry('runtime-freestyle', freestyle)])),
    ).toMatchObject({
      agent: {
        strategy: 'freestyle',
      },
    });
  });

  it('returns flattened defaults for an explicit linear session with no runtime entries', () => {
    expect(projectSessionRuntimeState(envelope())).toEqual({
      status: 'ready',
      specId: 1,
      sessionId: 'session-1',
      agent: {
        operationalMode: DEFAULT_BRUNCH_AGENT_STATE.operationalMode,
        role: 'elicitor',
        strategy: DEFAULT_BRUNCH_AGENT_STATE.agentStrategy,
        lens: DEFAULT_BRUNCH_AGENT_STATE.agentLens,
        goal: DEFAULT_BRUNCH_AGENT_STATE.agentGoal,
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
      operationalMode: 'elicit',
      agentStrategy: 'step-wise-decision-tree',
      agentLens: 'intent',
      agentGoal: 'grounding-advance',
    };
    const latest: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'project-graph',
      agentLens: 'oracle',
      agentGoal: 'commit-converge',
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
            data: { entityId: 'node-1', handle: 'D12', title: 'Decision seam', snapshottedLsn: 7 },
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
        operationalMode: 'elicit',
        role: 'elicitor',
        strategy: 'project-graph',
        lens: 'oracle',
        goal: 'commit-converge',
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

  it('rejects non-linear transcripts instead of flattening runtime state', () => {
    expect(() =>
      projectSessionRuntimeState(
        envelope([
          {
            id: 'a',
            type: 'message',
            parentId: 'binding-1',
            message: { role: 'assistant', content: [] },
          } as never,
          {
            id: 'b',
            type: 'message',
            parentId: 'binding-1',
            message: { role: 'assistant', content: [] },
          } as never,
        ]),
      ),
    ).toThrow(NonLinearTranscriptError);
  });
});
