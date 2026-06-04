import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { composeAgentPrompt } from '../../agents/compose.js';
import type { ReadinessGrade } from '../../agents/state.js';
import type { WorkspacePostureState } from '../../session/workspace-session-coordinator.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
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

const promptContext = {
  spec: { id: 1, name: 'Spec', readinessGrade: 'commitments_ready' as const },
  workspace: {
    cwd: '/tmp/brunch',
    posture: workspacePosture({
      certainty: 'proving',
      stakes: 'high',
      audience: 'internal',
      horizon: 'current-milestone',
      migration: 'free-rewrite',
      sourcing: 'strip-or-build',
    }),
  },
  session: { id: 'session-1', label: 'Session' },
  graphSnapshots: {
    getGraphOverview: () => ({
      lsn: 4,
      nodeCount: 2,
      edgeCount: 1,
      nodes: [
        {
          id: 1,
          specId: 1,
          plane: 'intent' as const,
          kind: 'goal' as const,
          title: 'Clarify Brunch prompt posture',
          basis: 'explicit' as const,
          createdAtLsn: 2,
          updatedAtLsn: 2,
        },
        {
          id: 2,
          specId: 1,
          plane: 'design' as const,
          kind: 'module' as const,
          title: 'Agent context renderer',
          basis: 'explicit' as const,
          createdAtLsn: 3,
          updatedAtLsn: 3,
        },
      ],
      edges: [
        {
          id: 1,
          specId: 1,
          category: 'realization' as const,
          sourceId: 2,
          targetId: 1,
          basis: 'explicit' as const,
          createdAtLsn: 4,
          updatedAtLsn: 4,
        },
      ],
    }),
    getNodeNeighborhood: () => ({ status: 'not_found' as const }),
  },
};

function workspacePosture(posture: WorkspacePostureState): WorkspacePostureState {
  return posture;
}

describe('Brunch prompt-pack topology', () => {
  it('composes gated Brunch resource manifests instead of eager private prompt packs', () => {
    const result = composeAgentPrompt({
      agentId: 'elicitor',
      sessionState: projectBrunchAgentState([
        runtimeEntry({
          ...DEFAULT_BRUNCH_AGENT_STATE,
          agentStrategy: 'step-wise-decision-tree',
          agentLens: 'intent',
          agentGoal: 'auto',
        }),
      ]),
      spec: promptContext.spec,
      workspace: promptContext.workspace,
      activeTools: ['read', 'grep', 'present_options'],
    });

    expect(result.prompt).toContain('[Brunch agent control]');
    expect(result.prompt).toContain('- op_mode: elicit');
    expect(result.prompt).toContain('- goal: auto');
    expect(result.prompt).toContain('- strategy: step-wise-decision-tree');
    expect(result.prompt).toContain('- lens: intent');
    expect(result.prompt).toContain('<available_goals>');
    expect(result.prompt).toContain('<available_strategies>');
    expect(result.prompt).toContain('<available_lenses>');
    expect(result.prompt).toContain('<available_methods>');
    expect(result.prompt).toContain('name="step-wise-decision-tree"');
    expect(result.prompt).not.toContain('# Brunch base');
    expect(result.prompt).not.toContain('Request outcomes are an exactly-one property-presence union');
  });

  it('appends composed Brunch prompting from runtime-state projection', async () => {
    const latestState: BrunchAgentState = {
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'design',
      agentGoal: 'elicit-expand',
    };
    const events: Record<string, (event: never, ctx?: never) => unknown> = {};

    registerBrunchPrompting(
      {
        on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
          events[event] = handler;
        },
        getAllTools: () =>
          ['read', 'grep', 'bash', 'write', 'present_options'].map((name) => ({
            name,
          })),
      } as never,
      promptContext,
    );

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
      systemPrompt: expect.stringContaining('base\n\n[Brunch agent control]'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('- strategy: step-wise-disambiguate'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('- active tools: read, grep, present_options'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('[Selected-spec graph context · design lens]'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('design modules/interfaces'),
    });
  });

  it('refreshes selected-spec prompt context through the shell session-boundary path before composing', async () => {
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};
    let selected = {
      spec: { id: 1, name: 'Launch spec', readinessGrade: 'commitments_ready' as const },
      session: { id: 'launch-session', label: 'Launch session' },
      nodeTitles: ['Launch-only node'],
    };

    await createBrunchPiExtensionShell(
      {
        cwd: '/tmp/brunch',
        chatMode: 'responding-to-elicitation',
        phase: 'elicitation',
        spec: { id: 1, title: 'Launch spec' },
        session: { id: 'launch-session', label: 'Launch session' },
      },
      async () => {
        selected = {
          spec: { id: 2, name: 'Switched spec', readinessGrade: 'commitments_ready' as const },
          session: { id: 'switched-session', label: 'Switched session' },
          nodeTitles: ['Switched current node'],
        };
      },
      {
        coordinator: {} as never,
        graphMentionSource: { listMentionCandidates: () => [] },
        promptContext: () => ({
          spec: selected.spec,
          workspace: promptContext.workspace,
          session: selected.session,
          graphSnapshots: {
            getGraphOverview: () => ({
              lsn: 1,
              nodeCount: selected.nodeTitles.length,
              edgeCount: 0,
              nodes: selected.nodeTitles.map((title, index) => ({
                id: index + 1,
                specId: selected.spec.id,
                plane: 'intent' as const,
                kind: 'goal' as const,
                title,
                basis: 'explicit' as const,
                createdAtLsn: 1,
                updatedAtLsn: 1,
              })),
              edges: [],
            }),
            getNodeNeighborhood: () => ({ status: 'not_found' as const }),
          },
        }),
      },
    )({
      on: (eventName: string, handler: (event: never, ctx?: never) => unknown) => {
        events[eventName] ??= [];
        events[eventName].push(handler);
      },
      registerTool() {},
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => ['read', 'grep'].map((name) => ({ name })),
      setActiveTools() {},
    } as never);

    const results: unknown[] = [];
    for (const handler of events.before_agent_start ?? []) {
      results.push(
        await Promise.resolve(
          handler({ systemPrompt: 'base' } as never, { sessionManager: { getEntries: () => [] } } as never),
        ),
      );
    }
    const promptResult = results.find(
      (result) => typeof (result as { systemPrompt?: unknown } | undefined)?.systemPrompt === 'string',
    ) as { systemPrompt: string } | undefined;

    expect(promptResult?.systemPrompt).toContain('- spec: Switched spec (#2)');
    expect(promptResult?.systemPrompt).toContain('Switched current node');
    expect(promptResult?.systemPrompt).not.toContain('Launch spec (#1)');
    expect(promptResult?.systemPrompt).not.toContain('Launch-only node');
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
        ['read', 'grep', 'bash', 'edit', 'write', 'present_options', 'read_graph', 'commit_graph'].map(
          (name) => ({ name }),
        ),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
    };
    registerBrunchOperationalModePolicy(pi as never);
    registerBrunchPrompting(pi as never, promptContext);

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
      agentGoal: 'commit-converge',
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
      ['read', 'grep', 'present_options', 'read_graph'],
      ['read', 'grep', 'present_options', 'read_graph'],
      ['read', 'grep', 'present_options', 'read_graph', 'commit_graph'],
      ['read', 'grep', 'present_options', 'read_graph'],
      ['read', 'grep', 'present_options', 'read_graph', 'commit_graph'],
    ]);
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('- strategy: auto'),
    });
    expect(switchedPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('- strategy: propose-graph'),
    });
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining(
        '- active tools: read, grep, present_options, read_graph, commit_graph',
      ),
    });
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('[Selected-spec graph context · auto lens]'),
    });
    expect(switchedPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('[Selected-spec graph context · oracle lens]'),
    });
  });

  it('applies the selected-spec grade to commit_graph tool activation', async () => {
    async function activeToolsForGrade(readinessGrade: ReadinessGrade) {
      const events: Record<string, (event: never, ctx?: never) => unknown> = {};
      const activeTools: string[][] = [];
      registerBrunchPrompting(
        {
          on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
            events[event] = handler;
          },
          getAllTools: () => ['read', 'grep', 'read_graph', 'commit_graph'].map((name) => ({ name })),
          setActiveTools: (tools: string[]) => activeTools.push(tools),
        } as never,
        {
          ...promptContext,
          spec: { ...promptContext.spec, readinessGrade },
        },
      );

      await Promise.resolve(
        events.before_agent_start?.(
          { systemPrompt: 'base' } as never,
          { sessionManager: { getEntries: () => [] } } as never,
        ),
      );
      return activeTools.at(-1) ?? [];
    }

    await expect(activeToolsForGrade('grounding_onboarding')).resolves.not.toContain('commit_graph');
    await expect(activeToolsForGrade('elicitation_ready')).resolves.toContain('commit_graph');
  });

  it('is registered by the explicit shell after operational-mode policy and appends composed manifests', async () => {
    const eventNames: string[] = [];
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};

    await createBrunchPiExtensionShell(
      {
        cwd: '/tmp/brunch',
        chatMode: 'responding-to-elicitation',
        phase: 'elicitation',
        spec: { id: 1, title: 'Spec' },
        session: { id: 'session-1', label: 'Session' },
      },
      undefined,
      {
        coordinator: {} as never,
        graphMentionSource: { listMentionCandidates: () => [] },
        promptContext,
      },
    )({
      on: (eventName: string, handler: (event: never, ctx?: never) => unknown) => {
        eventNames.push(eventName);
        events[eventName] ??= [];
        events[eventName].push(handler);
      },
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
    const switchedState: BrunchAgentState = {
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'design',
      agentGoal: 'elicit-expand',
    };
    const promptResults = await Promise.all(
      (events.before_agent_start ?? []).map((handler) =>
        Promise.resolve(
          handler(
            { systemPrompt: 'base' } as never,
            { sessionManager: { getEntries: () => [runtimeEntry(switchedState)] } } as never,
          ),
        ),
      ),
    );
    const promptResult = promptResults.find(
      (result) => typeof (result as { systemPrompt?: unknown } | undefined)?.systemPrompt === 'string',
    );

    expect(operationalToolPolicyIndex).toBeGreaterThan(-1);
    expect(userBashPolicyIndex).toBeGreaterThan(operationalToolPolicyIndex);
    expect(promptingIndex).toBeGreaterThan(userBashPolicyIndex);
    expect(promptingIndex).toBeLessThan(nextBeforeAgentStartIndex);
    expect(promptResult).toMatchObject({
      systemPrompt: expect.stringContaining('<available_strategies>'),
    });
    expect(promptResult).toMatchObject({
      systemPrompt: expect.stringContaining('name="step-wise-disambiguate"'),
    });
  });

  it('proves transcript-backed strategy and lens switches change product prompt posture', async () => {
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};

    await createBrunchPiExtensionShell(
      {
        cwd: '/tmp/brunch',
        chatMode: 'responding-to-elicitation',
        phase: 'elicitation',
        spec: { id: 1, title: 'Spec' },
        session: { id: 'session-1', label: 'Session' },
      },
      undefined,
      {
        coordinator: {} as never,
        graphMentionSource: { listMentionCandidates: () => [] },
        promptContext,
      },
    )({
      on: (eventName: string, handler: (event: never, ctx?: never) => unknown) => {
        events[eventName] ??= [];
        events[eventName].push(handler);
      },
      registerTool() {},
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => ['read', 'grep', 'present_options'].map((name) => ({ name })),
      setActiveTools() {},
    } as never);

    async function promptFor(state: BrunchAgentState): Promise<string> {
      const results = await Promise.all(
        (events.before_agent_start ?? []).map((handler) =>
          Promise.resolve(
            handler(
              { systemPrompt: 'base' } as never,
              { sessionManager: { getEntries: () => [runtimeEntry(state)] } } as never,
            ),
          ),
        ),
      );
      const promptResult = results.find(
        (result) => typeof (result as { systemPrompt?: unknown } | undefined)?.systemPrompt === 'string',
      ) as { systemPrompt: string } | undefined;
      return promptResult?.systemPrompt ?? '';
    }

    const disambiguateIntentPrompt = await promptFor({
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'intent',
      agentGoal: 'elicit-expand',
    });
    const proposeDesignPrompt = await promptFor({
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'propose-graph',
      agentLens: 'design',
      agentGoal: 'elicit-expand',
    });
    const acceptedBlindSpots = [
      'prompt/body quality is fitness evidence',
      'graph-write reliability remains with graph-tool-resilience',
      'capture quality remains with capture-response-to-graph',
    ];

    expect(disambiguateIntentPrompt).toContain('name="step-wise-disambiguate"');
    expect(disambiguateIntentPrompt).not.toContain('name="propose-graph"');
    expect(proposeDesignPrompt).toContain('name="propose-graph"');
    expect(proposeDesignPrompt).not.toContain('name="step-wise-disambiguate"');
    expect(disambiguateIntentPrompt).toContain('[Selected-spec graph context · intent lens]');
    expect(disambiguateIntentPrompt).toContain('intent claims, terms, assumptions');
    expect(proposeDesignPrompt).toContain('[Selected-spec graph context · design lens]');
    expect(proposeDesignPrompt).toContain('design modules/interfaces');
    expect(disambiguateIntentPrompt).toContain('Clarify Brunch prompt posture');
    expect(proposeDesignPrompt).toContain('Clarify Brunch prompt posture');
    expect(acceptedBlindSpots).toEqual([
      'prompt/body quality is fitness evidence',
      'graph-write reliability remains with graph-tool-resilience',
      'capture quality remains with capture-response-to-graph',
    ]);
  });

  it('does not expose prompt manifests through Pi resource discovery or legacy context imports', async () => {
    const [promptingSource, shellSource] = await Promise.all([
      readFile(join(projectRoot(), 'src/.pi/extensions/prompting.ts'), 'utf8'),
      readFile(join(projectRoot(), 'src/.pi/pi-extension-shell.ts'), 'utf8'),
    ]);

    expect(promptingSource).not.toContain('resources_discover');
    expect(promptingSource).not.toContain('promptPaths');
    expect(promptingSource).not.toContain('compose-brunch-prompt');
    expect(shellSource).not.toContain('compose-brunch-prompt');
  });
});

function projectRoot(): string {
  return dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
}
