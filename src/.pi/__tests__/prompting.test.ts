import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { composeBrunchPrompt } from '../context/compose-brunch-prompt.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeSwitch,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  registerBrunchOperationalModePolicy,
} from '../extensions/operational-mode.js';
import { registerBrunchPrompting } from '../extensions/prompting.js';
import { createBrunchPiExtensionShell } from '../pi-extension-shell.js';

function runtimeEntry(state: BrunchAgentState) {
  return {
    type: 'custom',
    customType: 'brunch.agent_runtime_state',
    data: {
      schemaVersion: 1,
      reason: 'switch',
      state,
      source: 'user',
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

describe('Brunch prompt-pack topology', () => {
  it('composes deterministic private prompt packs in stable order', () => {
    const result = composeBrunchPrompt({
      operationalMode: 'elicit',
      agentRole: 'elicitor',
      agentStrategy: 'step-wise-decision-tree',
      agentLens: 'intent',
      agentGoal: 'auto',
      activeTools: ['read', 'grep', 'present_options'],
    });

    expect(result.packIds).toEqual([
      'brunch-base',
      'elicit',
      'elicitor',
      'structured-exchange',
      'candidate-proposals',
      'capture-analysis',
    ]);
    expect(result.prompt).toContain('[Brunch agent state]');
    expect(result.prompt).toContain('Operational mode: elicit.');
    expect(result.prompt).toContain('Agent role: elicitor.');
    expect(result.prompt).toContain('Agent goal: auto.');
    expect(result.prompt).toContain('Agent strategy: step-wise-decision-tree.');
    expect(result.prompt).toContain('Agent lens: intent.');
    expect(result.prompt).toContain('Brunch exposes only elicit-safe tools: read, grep, present_options.');
    expect(result.prompt.indexOf('# Brunch base')).toBeLessThan(
      result.prompt.indexOf('# Operational mode: elicit'),
    );
    expect(result.prompt.indexOf('# Structured exchanges')).toBeLessThan(
      result.prompt.indexOf('# Candidate proposals'),
    );
    expect(result.prompt).toContain('Request outcomes are an exactly-one property-presence union');
    expect(result.prompt).toContain(
      '`graph_refs` are per-candidate and strictly existing graph node references',
    );
    expect(result.prompt).toContain('Capture is transcript-native analysis, not graph mutation.');
    expect(result.prompt).not.toContain('CommandExecutor result shapes');
  });

  it('appends composed Brunch prompting from runtime-state projection', async () => {
    const latestState: BrunchAgentState = {
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'design',
      agentGoal: 'elicit-I',
    };
    const events: Record<string, (event: never, ctx?: never) => unknown> = {};

    registerBrunchPrompting({
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] = handler;
      },
      getAllTools: () =>
        ['read', 'grep', 'bash', 'write', 'present_options'].map((name) => ({
          name,
        })),
    } as never);

    const result = await Promise.resolve(
      events.before_agent_start?.(
        { systemPrompt: 'base' } as never,
        {
          sessionManager: {
            getEntries: () => [runtimeEntry(latestState)],
          },
        } as never,
      ),
    );

    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('base\n\n[Brunch agent state]'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('Agent strategy: step-wise-disambiguate.'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining(
        'Brunch exposes only elicit-safe tools: read, grep, present_options.',
      ),
    });
  });

  it('derives prompt and active tools from the same transcript-backed runtime state', async () => {
    const manager = new FakeRuntimeStateSessionManager();
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};
    const activeTools: string[][] = [];

    const pi = {
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] ??= [];
        events[event].push(handler);
      },
      registerTool: (_tool: { name: string }) => {},
      getAllTools: () =>
        ['read', 'grep', 'bash', 'edit', 'write', 'present_options'].map((name) => ({ name })),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
    };
    registerBrunchOperationalModePolicy(pi as never);
    registerBrunchPrompting(pi as never);

    for (const handler of events.session_start ?? []) {
      await handler({} as never, { sessionManager: manager } as never);
    }
    const defaultPromptResults = await Promise.all(
      (events.before_agent_start ?? []).map((handler) =>
        Promise.resolve(
          handler(
            { systemPrompt: 'base' } as never,
            {
              sessionManager: manager,
            } as never,
          ),
        ),
      ),
    );
    const latestState: BrunchAgentState = {
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'propose-graph',
      agentLens: 'oracle',
      agentGoal: 'commitment-converge',
    };
    appendBrunchAgentRuntimeSwitch(manager, latestState, 'user');
    const switchedPromptResults = await Promise.all(
      (events.before_agent_start ?? []).map((handler) =>
        Promise.resolve(
          handler(
            { systemPrompt: 'base' } as never,
            {
              sessionManager: manager,
            } as never,
          ),
        ),
      ),
    );
    const defaultPrompt = defaultPromptResults.find(Boolean);
    const switchedPrompt = switchedPromptResults.find(Boolean);

    expect(manager.entries[0]?.customType).toBe(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE);
    expect(activeTools).toEqual([
      ['read', 'grep', 'present_options'],
      ['read', 'grep', 'present_options'],
      ['read', 'grep', 'present_options'],
    ]);
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('Agent strategy: auto.'),
    });
    expect(switchedPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('Agent strategy: propose-graph.'),
    });
  });

  it('is registered by the explicit shell after operational-mode policy', async () => {
    const eventNames: string[] = [];

    await createBrunchPiExtensionShell(
      {
        cwd: '/tmp/brunch',
        chatMode: 'interactive',
        phase: 'ready',
        spec: { id: 'spec-1', title: 'Spec' },
        session: { id: 'session-1', label: 'Session' },
      },
      undefined,
      {
        coordinator: {} as never,
        graphMentionSource: { listMentionCandidates: () => [] },
      },
    )({
      on: (eventName: string) => eventNames.push(eventName),
      registerTool() {},
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => ['read', 'bash', 'write'].map((name) => ({ name })),
      setActiveTools() {},
    } as never);

    const operationalToolPolicyIndex = eventNames.indexOf('tool_call');
    const userBashPolicyIndex = eventNames.indexOf('user_bash');
    const promptingIndex = eventNames.indexOf('before_agent_start', userBashPolicyIndex + 1);
    const nextBeforeAgentStartIndex = eventNames.indexOf('before_agent_start', promptingIndex + 1);

    expect(operationalToolPolicyIndex).toBeGreaterThan(-1);
    expect(userBashPolicyIndex).toBeGreaterThan(operationalToolPolicyIndex);
    expect(promptingIndex).toBeGreaterThan(userBashPolicyIndex);
    expect(promptingIndex).toBeLessThan(nextBeforeAgentStartIndex);
  });

  it('does not expose private prompt packs through Pi resource discovery', async () => {
    const [promptingSource, composerSource] = await Promise.all([
      readFile(join(projectRoot(), 'src/.pi/extensions/prompting.ts'), 'utf8'),
      readFile(join(projectRoot(), 'src/.pi/context/compose-brunch-prompt.ts'), 'utf8'),
    ]);

    expect(promptingSource).not.toContain('resources_discover');
    expect(promptingSource).not.toContain('promptPaths');
    expect(composerSource).not.toContain('resources_discover');
    expect(composerSource).not.toContain('promptPaths');
  });
});

function projectRoot(): string {
  return dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
}
