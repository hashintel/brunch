import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../../app/pi-extensions.js';
import { groundingFloorGaps } from '../../graph/schema/elicitation-gap-fixtures.js';
import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { WorkspacePostureState } from '../../session/workspace-session-coordinator.js';
import { BRUNCH_INTROSPECT_QUERY_TOOL } from '../extensions/introspect-query/index.js';
import { createInMemoryBrunchIntrospectionStore } from '../extensions/introspection/index.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeSwitch,
  projectBrunchAgentState,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  registerBrunchOperationalModePolicy,
} from '../extensions/runtime/index.js';
import { BRUNCH_SESSION_QUERY_TOOL } from '../extensions/session-query/index.js';
import { composeAgentPrompt } from '../extensions/system-prompts/compose.js';
import { registerBrunchPrompting } from '../extensions/system-prompts/index.js';

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
  spec: { id: 1, name: 'Spec' },
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
  graphReads: {
    queryGraph: () => ({
      lsn: 4,
      nodes: [
        {
          id: 1,
          specId: 1,
          plane: 'intent' as const,
          kind: 'goal' as const,
          kindOrdinal: 1,
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
          kindOrdinal: 1,
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
    getNodes: () => [],
    resolveNodeCode: () => undefined,
    getElicitationGaps: () => groundingFloorGaps(),
    latestLsn: () => 4,
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
      gaps: groundingFloorGaps(),
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
          ['read', 'grep', 'bash', 'write', 'present_options', 'request_answer'].map((name) => ({
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
      systemPrompt: expect.stringContaining('base\n\n# Agent: elicitor'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('It should keep multi-spec discipline'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('# Agent: elicitor\n\nThe elicitor'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('[Brunch agent control]'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('- strategy: step-wise-disambiguate'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('- active tools: read, grep, present_options, request_answer'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining(
        '- selected spec: Spec (#1); readiness estimate (soft; gates nothing): grounding=1.00, elicitation=0.00, commitment=0.00',
      ),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.not.stringContaining('readiness_grade='),
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
      spec: { id: 1, name: 'Launch spec' },
      session: { id: 'launch-session', label: 'Launch session' },
      nodeTitles: ['Launch-only node'],
    };

    await createBrunchPiExtensions(
      {
        cwd: '/tmp/brunch',
        spec: { id: 1, title: 'Launch spec' },
        session: { id: 'launch-session', label: 'Launch session' },
      },
      async () => {
        selected = {
          spec: { id: 2, name: 'Switched spec' },
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
          graphReads: {
            queryGraph: () => ({
              lsn: 1,
              nodes: selected.nodeTitles.map((title, index) => ({
                id: index + 1,
                specId: selected.spec.id,
                plane: 'intent' as const,
                kind: 'goal' as const,
                kindOrdinal: index + 1,
                title,
                basis: 'explicit' as const,
                createdAtLsn: 1,
                updatedAtLsn: 1,
              })),
              edges: [],
            }),
            getNodes: () => [],
            resolveNodeCode: () => undefined,
            getElicitationGaps: () => groundingFloorGaps(),
            latestLsn: () => 1,
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
        [
          'read',
          'grep',
          'bash',
          'edit',
          'write',
          'present_options',
          'request_answer',
          'request_choice',
          'request_choices',
          'present_review_set',
          'request_review',
          'read_graph',
          'read_session_context',
          'mutate_graph',
        ].map((name) => ({ name })),
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
      [
        'read',
        'grep',
        'present_options',
        'request_answer',
        'request_choice',
        'request_choices',
        'read_graph',
        'read_session_context',
      ],
      [
        'read',
        'grep',
        'present_options',
        'request_answer',
        'request_choice',
        'request_choices',
        'read_graph',
        'read_session_context',
      ],
      [
        'read',
        'grep',
        'present_options',
        'request_answer',
        'request_choice',
        'request_choices',
        'present_review_set',
        'request_review',
        'read_graph',
        'read_session_context',
        'mutate_graph',
      ],
      [
        'read',
        'grep',
        'present_options',
        'request_answer',
        'request_choice',
        'request_choices',
        'read_graph',
        'read_session_context',
      ],
      [
        'read',
        'grep',
        'present_options',
        'request_answer',
        'request_choice',
        'request_choices',
        'present_review_set',
        'request_review',
        'read_graph',
        'read_session_context',
        'mutate_graph',
      ],
    ]);
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('- strategy: auto'),
    });
    expect(switchedPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('- strategy: propose-graph'),
    });
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining(
        '- active tools: read, grep, present_options, request_answer, request_choice, request_choices, present_review_set, request_review, read_graph, read_session_context, mutate_graph',
      ),
    });
    expect(defaultPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('[Selected-spec graph context · auto lens]'),
    });
    expect(switchedPrompt).toMatchObject({
      systemPrompt: expect.stringContaining('[Selected-spec graph context · oracle lens]'),
    });
  });

  it('keeps dev query tools in the prompt active-tools list when introspection is enabled', async () => {
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};
    const toolNames: string[] = [];
    const activeTools: string[][] = [];

    await createBrunchPiExtensions(
      {
        cwd: '/tmp/brunch',
        spec: { id: 1, title: 'Spec' },
        session: { id: 'session-1', label: 'Session' },
      },
      undefined,
      {
        coordinator: {} as never,
        graphMentionSource: { listMentionCandidates: () => [] },
        promptContext,
        introspection: { enabled: true, store: createInMemoryBrunchIntrospectionStore() },
      },
    )({
      on: (eventName: string, handler: (event: never, ctx?: never) => unknown) => {
        events[eventName] ??= [];
        events[eventName].push(handler);
      },
      registerTool(tool: { name: string }) {
        toolNames.push(tool.name);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () =>
        [...new Set(['read', 'grep', 'bash', 'write', ...toolNames])].map((name) => ({ name })),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
    } as never);

    const results = await Promise.all(
      (events.before_agent_start ?? []).map((handler) =>
        Promise.resolve(
          handler({ systemPrompt: 'base' } as never, { sessionManager: { getEntries: () => [] } } as never),
        ),
      ),
    );
    const promptResult = results.find(
      (result) => typeof (result as { systemPrompt?: unknown } | undefined)?.systemPrompt === 'string',
    ) as { systemPrompt: string } | undefined;

    expect(activeTools.at(-1)).toEqual(
      expect.arrayContaining([BRUNCH_SESSION_QUERY_TOOL, BRUNCH_INTROSPECT_QUERY_TOOL]),
    );
    expect(promptResult?.systemPrompt).toContain(BRUNCH_SESSION_QUERY_TOOL);
    expect(promptResult?.systemPrompt).toContain(BRUNCH_INTROSPECT_QUERY_TOOL);
  });

  it('applies selected-spec gaps to mutate_graph tool activation', async () => {
    async function activeToolsForGaps(gaps: readonly ElicitationGap[]) {
      const events: Record<string, (event: never, ctx?: never) => unknown> = {};
      const activeTools: string[][] = [];
      registerBrunchPrompting(
        {
          on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
            events[event] = handler;
          },
          getAllTools: () =>
            [
              'read',
              'grep',
              'read_graph',
              'read_session_context',
              'read_elicitation_gaps',
              'mutate_graph',
              'present_review_set',
              'request_review',
            ].map((name) => ({ name })),
          setActiveTools: (tools: string[]) => activeTools.push(tools),
        } as never,
        {
          ...promptContext,
          graphReads: { ...promptContext.graphReads, getElicitationGaps: () => gaps },
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

    await expect(activeToolsForGaps(groundingFloorGaps({ defaultCoverage: 0 }))).resolves.not.toContain(
      'mutate_graph',
    );
    await expect(activeToolsForGaps(groundingFloorGaps({ coverage: { context: 0.5 } }))).resolves.toContain(
      'mutate_graph',
    );
    await expect(activeToolsForGaps(groundingFloorGaps({ coverage: { context: 0.5 } }))).resolves.toContain(
      'present_review_set',
    );
    // the elicitation read tool rides the ungated read-context method
    await expect(activeToolsForGaps(groundingFloorGaps({ defaultCoverage: 0 }))).resolves.toContain(
      'read_elicitation_gaps',
    );
  });

  it('is registered by the explicit shell after operational-mode policy and appends composed manifests', async () => {
    const eventNames: string[] = [];
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};

    await createBrunchPiExtensions(
      {
        cwd: '/tmp/brunch',
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

    await createBrunchPiExtensions(
      {
        cwd: '/tmp/brunch',
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
      getAllTools: () =>
        ['read', 'grep', 'present_options', 'request_answer', 'request_choice', 'request_choices'].map(
          (name) => ({ name }),
        ),
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
      readFile(join(projectRoot(), 'src/.pi/extensions/system-prompts/index.ts'), 'utf8'),
      readFile(join(projectRoot(), 'src/app/pi-extensions.ts'), 'utf8'),
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
