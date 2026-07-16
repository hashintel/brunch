import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../../../app/pi-extensions.js';
import type { WorkspacePostureState } from '../../../session/workspace-session-coordinator.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  appendBrunchAgentRuntimeSwitch,
  type BrunchAgentState,
  type BrunchAgentStateEntryData,
  registerBrunchOperationalModePolicy,
} from '../agent-runtime/runtime/index.js';
import { registerBrunchPrompting } from '../agent-runtime/system-prompts/index.js';

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

  getBranch() {
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
      dependencies: 'resist',
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
          settlement: 'settled' as const,
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
          settlement: 'settled' as const,
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
          settlement: 'settled' as const,
          createdAtLsn: 4,
          updatedAtLsn: 4,
        },
      ],
    }),
    getNodes: () => [],
    resolveNodeCode: () => undefined,
    getOpenReconciliationNeeds: () => [],
    latestLsn: () => 4,
  },
};

function workspacePosture(posture: WorkspacePostureState): WorkspacePostureState {
  return posture;
}

function countOccurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('Brunch prompt-pack topology', () => {
  it('appends composed Brunch prompting from runtime-state projection', async () => {
    const latestState: BrunchAgentState = {
      ...DEFAULT_BRUNCH_AGENT_STATE,
    };
    const events: Record<string, (event: never, ctx?: never) => unknown> = {};

    registerBrunchPrompting(
      {
        on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
          events[event] = handler;
        },
        getAllTools: () =>
          [
            'read',
            'grep',
            'bash',
            'write',
            'ask',
            'present_candidates',
            'present_digest',
            'present_review_set',
          ].map((name) => ({
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
            getBranch: () => [runtimeEntry(latestState)],
          },
        } as never,
      ),
    );

    expect(result).toMatchObject({
      systemPrompt: expect.stringMatching(/^base\n\n/s),
    });
  });

  it('repairs triggerTurn provider payloads that bypass before_agent_start without changing tools', async () => {
    const manager = new FakeRuntimeStateSessionManager();
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};
    const activeTools: string[][] = [];

    const pi = {
      on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
        events[event] ??= [];
        events[event].push(handler);
      },
      registerTool() {},
      getAllTools: () =>
        [
          'read',
          'grep',
          'bash',
          'edit',
          'write',
          'ask',

          'present_review_set',
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

    const providerTools = activeTools.at(-1)?.map((name) => ({ name })) ?? [];
    const payload = {
      input: [{ role: 'developer', content: 'base prompt' }],
      tools: providerTools,
    };

    const results = await Promise.all(
      (events.before_provider_request ?? []).map((handler) =>
        Promise.resolve(handler({ payload } as never, { sessionManager: manager } as never)),
      ),
    );
    const repaired = results.find((result) => result !== undefined) as typeof payload | undefined;

    expect(repaired?.input[0]?.content).toContain('# Elicitor');
    expect(repaired?.input[0]?.content).toContain('[Brunch live skills]');
    expect(repaired?.tools).toEqual(providerTools);
    expect(activeTools).toHaveLength(1);
    expect(providerTools.map((tool) => tool.name)).toEqual(expect.arrayContaining(['ask', 'mutate_graph']));
  });

  it('repairs every supported provider system-prompt carrier shape', async () => {
    const cases = [
      {
        name: 'instructions',
        payload: { instructions: 'base prompt' },
        read: (payload: { instructions?: string }) => payload.instructions,
      },
      {
        name: 'systemInstruction',
        payload: { systemInstruction: 'base prompt' },
        read: (payload: { systemInstruction?: string }) => payload.systemInstruction,
      },
      {
        name: 'systemPrompt',
        payload: { systemPrompt: 'base prompt' },
        read: (payload: { systemPrompt?: string }) => payload.systemPrompt,
      },
      {
        name: 'system string',
        payload: { system: 'base prompt' },
        read: (payload: { system?: string }) => payload.system,
      },
      {
        name: 'system blocks',
        payload: { system: [{ type: 'text', text: 'base prompt' }] },
        read: (payload: { system?: Array<{ text?: string }> }) =>
          payload.system?.map((block) => block.text).join('\n'),
      },
      {
        name: 'messages system',
        payload: { messages: [{ role: 'system', content: 'base prompt' }] },
        read: (payload: { messages?: Array<{ content?: string }> }) => payload.messages?.[0]?.content,
      },
      {
        name: 'input developer',
        payload: { input: [{ role: 'developer', content: 'base prompt' }] },
        read: (payload: { input?: Array<{ content?: string }> }) => payload.input?.[0]?.content,
      },
      {
        name: 'input developer blocks',
        payload: { input: [{ role: 'developer', content: [{ type: 'text', text: 'base prompt' }] }] },
        read: (payload: { input?: Array<{ content?: Array<{ text?: string }> }> }) =>
          payload.input?.[0]?.content?.map((block) => block.text).join('\n'),
      },
    ];

    for (const testCase of cases) {
      const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};
      registerBrunchPrompting(
        {
          on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
            events[event] ??= [];
            events[event].push(handler);
          },
          getAllTools: () => ['read', 'grep', 'ask'].map((name) => ({ name })),
          setActiveTools() {},
        } as never,
        promptContext,
      );

      const repaired = (await Promise.resolve(
        events.before_provider_request?.[0]?.(
          { payload: testCase.payload } as never,
          { sessionManager: { getBranch: () => [] } } as never,
        ),
      )) as typeof testCase.payload | undefined;

      expect(repaired, testCase.name).toBeDefined();
      expect(testCase.read(repaired as never), testCase.name).toContain('# Elicitor');
    }
  });

  it('keeps the provider-request prompt guard idempotent after before_agent_start appended', async () => {
    const events: Record<string, Array<(event: never, ctx?: never) => unknown>> = {};

    registerBrunchPrompting(
      {
        on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
          events[event] ??= [];
          events[event].push(handler);
        },
        getAllTools: () => ['read', 'grep', 'ask'].map((name) => ({ name })),
        setActiveTools() {},
      } as never,
      promptContext,
    );

    const beforeStart = (await Promise.resolve(
      events.before_agent_start?.[0]?.(
        { systemPrompt: 'base prompt' } as never,
        { sessionManager: { getBranch: () => [] } } as never,
      ),
    )) as { systemPrompt: string };
    const payload = {
      messages: [{ role: 'system', content: beforeStart.systemPrompt }],
    };

    const repaired = (await Promise.resolve(
      events.before_provider_request?.[0]?.(
        { payload } as never,
        { sessionManager: { getBranch: () => [] } } as never,
      ),
    )) as typeof payload;

    expect(repaired).toBe(payload);
    expect(countOccurrences(repaired.messages[0]?.content ?? '', '# Elicitor')).toBe(1);
  });

  it('composes the execute-mode executor prompt from the branch despite a stale append-order rival', async () => {
    const executeState: BrunchAgentState = {
      schemaVersion: 1,
      operationalMode: 'execute',
    };
    const events: Record<string, (event: never, ctx?: never) => unknown> = {};
    const sessionManager = {
      getBranch: () => [runtimeEntry(executeState)],
      getEntries: () => [
        runtimeEntry(executeState),
        runtimeEntry({ schemaVersion: 1, operationalMode: 'specify' }),
      ],
    };

    registerBrunchPrompting(
      {
        on: (event: string, handler: (event: never, ctx?: never) => unknown) => {
          events[event] = handler;
        },
        getAllTools: () =>
          ['read', 'grep', 'find', 'ls', 'bash', 'write', 'execute_status'].map((name) => ({ name })),
        setActiveTools() {},
      } as never,
      promptContext,
    );

    const result = await Promise.resolve(
      events.before_agent_start?.({ systemPrompt: 'base' } as never, { sessionManager } as never),
    );
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('# Executor'),
    });
    expect(result).toMatchObject({
      systemPrompt: expect.stringContaining('[Brunch shared references]'),
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
                settlement: 'settled' as const,
                createdAtLsn: 1,
                updatedAtLsn: 1,
              })),
              edges: [],
            }),
            getNodes: () => [],
            resolveNodeCode: () => undefined,
            getOpenReconciliationNeeds: () => [],
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
          handler({ systemPrompt: 'base' } as never, { sessionManager: { getBranch: () => [] } } as never),
        ),
      );
    }
    const promptResult = results.find(
      (result) => typeof (result as { systemPrompt?: unknown } | undefined)?.systemPrompt === 'string',
    ) as { systemPrompt: string } | undefined;

    expect(promptResult?.systemPrompt).toMatch(/^base\n\n/s);
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
          'ask',

          'present_review_set',
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
    await Promise.all(
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
    };
    appendBrunchAgentRuntimeSwitch(manager, latestState, 'user');
    await Promise.all(
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

    expect(manager.entries[0]?.customType).toBe(BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE);
    // D86-L: graph-write tools (present_review_set / ask / mutate_graph) are
    // floor in Specify mode, so every entry carries them regardless of gap coverage.
    const elicitFloorTools = [
      'read',
      'grep',
      'ask',
      'present_review_set',
      'read_graph',
      'read_session_context',
      'mutate_graph',
    ];
    expect(activeTools).toEqual([
      elicitFloorTools,
      elicitFloorTools,
      elicitFloorTools,
      elicitFloorTools,
      elicitFloorTools,
    ]);
  });

  it('activates live elicitor tools from the fixed policy without selected-spec gap reads', async () => {
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
            'read_elicitation_scratchpad',
            'mutate_graph',
            'present_review_set',
            'bash',
          ].map((name) => ({ name })),
        setActiveTools: (tools: string[]) => activeTools.push(tools),
      } as never,
      {
        ...promptContext,
        graphReads: {
          ...promptContext.graphReads,
          latestLsn: () => {
            throw new Error('live elicitor tool policy must not read graph clocks');
          },
        },
      },
    );

    await Promise.resolve(
      events.before_agent_start?.(
        { systemPrompt: 'base' } as never,
        { sessionManager: { getBranch: () => [] } } as never,
      ),
    );

    expect(activeTools.at(-1)).toEqual([
      'read',
      'grep',
      'read_graph',
      'read_session_context',
      'read_elicitation_scratchpad',
      'mutate_graph',
      'present_review_set',
    ]);
  });

  it('is registered by the explicit shell after operational-mode policy and appends the live elicitor prompt', async () => {
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
      operationalMode: 'execute',
    };
    await Promise.all(
      (events.before_agent_start ?? []).map((handler) =>
        Promise.resolve(
          handler(
            { systemPrompt: 'base' } as never,
            { sessionManager: { getBranch: () => [runtimeEntry(switchedState)] } } as never,
          ),
        ),
      ),
    );

    expect(operationalToolPolicyIndex).toBeGreaterThan(-1);
    expect(userBashPolicyIndex).toBeGreaterThan(operationalToolPolicyIndex);
    expect(promptingIndex).toBeGreaterThan(userBashPolicyIndex);
    expect(promptingIndex).toBeLessThan(nextBeforeAgentStartIndex);
  });

  it('keeps live elicitor prompt selection keyed to mode, not stale legacy fields', async () => {
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
      getAllTools: () => ['read', 'grep', 'ask'].map((name) => ({ name })),
      setActiveTools() {},
    } as never);

    async function promptFor(state: BrunchAgentState): Promise<string> {
      const results = await Promise.all(
        (events.before_agent_start ?? []).map((handler) =>
          Promise.resolve(
            handler(
              { systemPrompt: 'base' } as never,
              { sessionManager: { getBranch: () => [runtimeEntry(state)] } } as never,
            ),
          ),
        ),
      );
      const promptResult = results.find(
        (result) => typeof (result as { systemPrompt?: unknown } | undefined)?.systemPrompt === 'string',
      ) as { systemPrompt: string } | undefined;
      return promptResult?.systemPrompt ?? '';
    }

    const legacyIntentPrompt = await promptFor({
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'intent',
    } as unknown as BrunchAgentState);
    const legacyDesignPrompt = await promptFor({
      ...DEFAULT_BRUNCH_AGENT_STATE,
      agentStrategy: 'step-wise-disambiguate',
      agentLens: 'design',
    } as unknown as BrunchAgentState);
    expect(legacyIntentPrompt).toBe(legacyDesignPrompt);
  });
});
