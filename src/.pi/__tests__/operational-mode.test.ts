import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SessionManager } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeInit,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  registerBrunchOperationalModePolicy,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
} from '../extensions/operational-mode.js';

function runtimeEntry(state: BrunchAgentState, data: Record<string, unknown> = {}) {
  return {
    type: 'custom',
    customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
    data: {
      schemaVersion: 1,
      reason: 'switch',
      state,
      source: 'user',
      ...data,
    },
  };
}

class FakeRuntimeStateSessionManager {
  entries: Array<{
    type: 'custom';
    customType: string;
    data: BrunchAgentStateEntryData;
  }> = [];

  getEntries() {
    return this.entries;
  }

  appendCustomEntry(customType: string, data: BrunchAgentStateEntryData) {
    this.entries.push({ type: 'custom', customType, data });
    return `entry-${this.entries.length}`;
  }
}

describe('Brunch agent runtime-state projection', () => {
  it('projects the deterministic elicit/elicitor default when no runtime entries exist', () => {
    expect(projectBrunchAgentState([])).toMatchObject({
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentRole: 'elicitor',
      operationalModeDefinition: {
        id: 'elicit',
        defaultRole: 'elicitor',
        toolPolicyId: 'elicit-read-only',
      },
      agentRoleDefinition: {
        id: 'elicitor',
        operationalMode: 'elicit',
        defaultStrategy: DEFAULT_BRUNCH_AGENT_STATE.agentStrategy,
        defaultLens: DEFAULT_BRUNCH_AGENT_STATE.agentLens,
        defaultGoal: DEFAULT_BRUNCH_AGENT_STATE.agentGoal,
      },
    });
  });

  it('accepts AUTO as a selection sentinel for every objective axis', () => {
    const autoState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'auto',
      agentLens: 'auto',
      agentGoal: 'auto',
    };

    expect(projectBrunchAgentState([runtimeEntry(autoState)])).toMatchObject({
      ...autoState,
      agentRole: 'elicitor',
    });
  });

  it('uses the last valid runtime-state snapshot without mutating earlier transcript entries', () => {
    const first = runtimeEntry(DEFAULT_BRUNCH_AGENT_STATE);
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'propose-graph',
      agentLens: 'design',
      agentGoal: 'auto',
    };
    const latest = runtimeEntry(latestState);

    expect(projectBrunchAgentState([first, latest])).toMatchObject(latestState);
    expect(first.data.state).toEqual(DEFAULT_BRUNCH_AGENT_STATE);
  });

  it('ignores malformed and invalid runtime entries instead of guessing', () => {
    const valid = runtimeEntry(DEFAULT_BRUNCH_AGENT_STATE);
    const invalidCombination = runtimeEntry({
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'not-a-strategy',
      agentLens: 'intent',
      agentGoal: 'auto',
    } as unknown as BrunchAgentState);
    const malformed = {
      type: 'custom',
      customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
      data: { schemaVersion: 1, reason: 'switch', source: 'user' },
    };

    expect(projectBrunchAgentState([valid, invalidCombination, malformed])).toMatchObject(
      DEFAULT_BRUNCH_AGENT_STATE,
    );
  });

  it('applies resolved elicit state to active tools, prompt, and blockers', async () => {
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'project-graph',
      agentLens: 'oracle',
      agentGoal: 'elicit-II',
    };
    const events: Record<string, (event: never, ctx?: never) => unknown> = {};
    const activeTools: string[][] = [];

    registerBrunchOperationalModePolicy({
      registerTool: (_tool: { name: string }) => {},
      getAllTools: () =>
        [
          'read',
          'grep',
          'find',
          'ls',
          'structured_exchange',
          'present_alternatives',
          'bash',
          'edit',
          'write',
        ].map((name) => ({
          name,
        })),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] = handler;
      },
    } as never);

    const promptResult = await Promise.resolve(
      events.before_agent_start?.(
        { systemPrompt: 'base' } as never,
        {
          sessionManager: {
            getEntries: () => [runtimeEntry(latestState)],
          },
        } as never,
      ),
    );

    expect(activeTools).toEqual([
      ['read', 'grep', 'find', 'ls', 'structured_exchange', 'present_alternatives'],
    ]);
    expect(promptResult).toBeUndefined();
    for (const toolName of ['bash', 'edit', 'write']) {
      await expect(Promise.resolve(events.tool_call?.({ toolName } as never))).resolves.toMatchObject({
        block: true,
        reason: expect.stringContaining(`Brunch tool policy blocks "${toolName}"`),
      });
    }
    await expect(
      Promise.resolve(events.tool_call?.({ toolName: 'structured_exchange' } as never)),
    ).resolves.toBeUndefined();
    expect(events.user_bash?.({ command: 'rm -rf .' } as never)).toMatchObject({
      result: {
        exitCode: 1,
        output: 'Brunch tool policy blocks shell commands: rm -rf .',
      },
    });
  });

  it('appends init only when the transcript has no valid runtime state', () => {
    const manager = new FakeRuntimeStateSessionManager();

    expect(appendBrunchAgentRuntimeInit(manager)).toBe('entry-1');
    expect(appendBrunchAgentRuntimeInit(manager)).toBeUndefined();
    expect(manager.entries).toHaveLength(1);
    expect(manager.entries[0]?.data).toEqual({
      schemaVersion: 1,
      reason: 'init',
      state: DEFAULT_BRUNCH_AGENT_STATE,
      source: 'extension',
    });
  });

  it('appends validated runtime switches as full state snapshots', () => {
    const manager = new FakeRuntimeStateSessionManager();
    appendBrunchAgentRuntimeInit(manager);
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'design',
      agentGoal: 'capture-posture',
    };

    expect(appendBrunchAgentRuntimeSwitch(manager, latestState, 'user')).toBe('entry-2');

    expect(manager.entries[1]?.data).toEqual({
      schemaVersion: 1,
      reason: 'switch',
      state: latestState,
      previous: DEFAULT_BRUNCH_AGENT_STATE,
      source: 'user',
    });
    expect(projectBrunchAgentState(manager.getEntries())).toMatchObject(latestState);
  });

  it('rejects invalid runtime switch combinations before appending', () => {
    const manager = new FakeRuntimeStateSessionManager();

    for (const invalidState of [
      {
        schemaVersion: 1,
        operationalMode: 'execute',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'intent',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentRole: 'elicitor',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'intent',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentStrategy: 'not-a-strategy',
        agentLens: 'intent',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'not-a-lens',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'intent',
        agentGoal: 'not-a-goal',
      },
    ]) {
      expect(() =>
        appendBrunchAgentRuntimeSwitch(manager, invalidState as unknown as BrunchAgentState),
      ).toThrow('Invalid BrunchAgentState runtime selection.');
    }
    expect(manager.entries).toEqual([]);
  });

  it('does not project invalid runtime mode, legacy role, strategy, lens, or goal entries', () => {
    for (const invalidState of [
      {
        schemaVersion: 1,
        operationalMode: 'execute',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'intent',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentRole: 'elicitor',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'intent',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentStrategy: 'not-a-strategy',
        agentLens: 'intent',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'not-a-lens',
        agentGoal: 'auto',
      },
      {
        schemaVersion: 1,
        operationalMode: 'elicit',
        agentStrategy: 'step-wise-decision-tree',
        agentLens: 'intent',
        agentGoal: 'not-a-goal',
      },
    ]) {
      expect(
        projectBrunchAgentState([runtimeEntry(invalidState as unknown as BrunchAgentState)]),
      ).toMatchObject(DEFAULT_BRUNCH_AGENT_STATE);
    }
  });

  it('appends runtime init from the extension session-start hook', async () => {
    const manager = new FakeRuntimeStateSessionManager();
    const events: Record<string, (event: never, ctx?: never) => unknown> = {};

    registerBrunchOperationalModePolicy({
      registerTool: (_tool: { name: string }) => {},
      getAllTools: () => ['read'].map((name) => ({ name })),
      setActiveTools: (_tools: string[]) => {},
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] = handler;
      },
    } as never);

    await events.session_start?.(
      {} as never,
      {
        sessionManager: manager,
      } as never,
    );

    expect(manager.entries[0]?.data.reason).toBe('init');
  });

  it('reprojects runtime-state snapshots after Pi JSONL reload', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-agent-state-'));
    const sessionDir = join(cwd, '.brunch', 'sessions');
    const manager = SessionManager.create(cwd, sessionDir);
    const latestState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'elicit',
      agentStrategy: 'propose-graph',
      agentLens: 'intent',
      agentGoal: 'grounding-advance',
    };

    manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
      schemaVersion: 1,
      reason: 'init',
      state: DEFAULT_BRUNCH_AGENT_STATE,
      source: 'extension',
    });
    manager.appendMessage({
      role: 'assistant',
      content: [{ type: 'text', text: 'runtime initialized' }],
      api: 'test',
      provider: 'test',
      model: 'test',
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          total: 0,
        },
      },
      stopReason: 'stop',
      timestamp: Date.now(),
    } as never);
    manager.appendCustomEntry(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE, {
      schemaVersion: 1,
      reason: 'switch',
      state: latestState,
      previous: DEFAULT_BRUNCH_AGENT_STATE,
      source: 'user',
    });

    const reloaded = SessionManager.open(manager.getSessionFile()!, sessionDir);

    expect(projectBrunchAgentState(reloaded.getEntries())).toMatchObject(latestState);
  });
});
