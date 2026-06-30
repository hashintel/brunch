import { access, readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../../../app/pi-extensions.js';
import { registerBrunchAlternatives as alternatives } from '../../components/alternatives.js';
import { BRUNCH_EXECUTE_SNAPSHOT_TOOL } from '../agent-runtime/execute-snapshot/index.js';
import { BRUNCH_EXECUTE_STATUS_TOOL } from '../agent-runtime/execute-status/index.js';
import { BRUNCH_ORCHESTRATOR_STUB_TOOL } from '../agent-runtime/orchestrator-stub/index.js';
import { registerBrunchOperationalModePolicy as operationalMode } from '../agent-runtime/runtime/index.js';
import { registerBrunchPrompting as prompting } from '../agent-runtime/system-prompts/index.js';
import { registerBrunchContext as context } from '../brunch-data/context/index.js';
import chrome from '../chrome/index.js';
import {
  BRUNCH_MODE_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  registerBrunchCommands as commands,
} from '../commands/index.js';
import { registerBrunchBranchPolicyHandlers as commandPolicy } from '../commands/policy.js';
import {
  PRESENT_CANDIDATES_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_RESPONSE_TOOL,
  registerStructuredExchange as structuredExchange,
} from '../exchanges/index.js';
import { registerBrunchMentionAutocomplete as mentionAutocomplete } from '../mentions/index.js';
import { registerBrunchSessionBoundary as sessionLifecycle } from '../session-hooks/session/lifecycle.js';

const extensionDefaults = {
  'components/alternatives.ts': alternatives,
  'chrome/index.ts': chrome,
  'commands/policy.ts': commandPolicy,
  'commands/index.ts': commands,
  'context/index.ts': context,
  'mentions/index.ts': mentionAutocomplete,
  'runtime/index.ts': operationalMode,
  'system-prompts/index.ts': prompting,
  'session/lifecycle.ts': sessionLifecycle,
  'exchanges/index.ts': structuredExchange,
};

describe('Brunch explicit Pi extension registry', () => {
  it('keeps named factory exports for src/.pi iteration', () => {
    for (const [path, factory] of Object.entries(extensionDefaults)) {
      expect(factory, path).toEqual(expect.any(Function));
    }
  });

  it('keeps product-dependency src/.pi extensions disabled for direct Pi iteration', async () => {
    const settings = JSON.parse(await readFile(join(projectRoot(), 'src/.pi/settings.json'), 'utf8')) as {
      extensions?: unknown;
    };

    expect(settings.extensions).toContain('extensions/chrome/index.ts');
    expect(settings.extensions).not.toContain('!extensions/**');
    expect(settings.extensions).toEqual(
      expect.arrayContaining([
        '-extensions/agent-runtime/index.ts',
        '-extensions/agent-runtime/execute-snapshot/index.ts',
        '-extensions/agent-runtime/execute-status/index.ts',
        '-extensions/agent-runtime/orchestrator-stub/index.ts',
        '-extensions/agent-runtime/runtime/index.ts',
        '-extensions/agent-runtime/system-prompts/index.ts',
        '-extensions/brunch-data/context/index.ts',
        '-extensions/brunch-data/elicitation/index.ts',
        '-extensions/brunch-data/graph/index.ts',
        '-extensions/brunch-data/reconciliation/index.ts',
        '-extensions/commands/index.ts',
        '-extensions/commands/policy.ts',
        '-extensions/compaction/index.ts',
        '-extensions/dev-mode/index.ts',
        '-extensions/dev-mode/introspect-query/index.ts',
        '-extensions/dev-mode/introspection/index.ts',
        '-extensions/dev-mode/session-query/index.ts',
        '-extensions/session-hooks/index.ts',
        '-extensions/subagents/index.ts',
        '-extensions/web-tools/index.ts',
        '-extensions/web-tools/web/index.ts',
        '-extensions/workspace/index.ts',
      ]),
    );
  });

  it('keeps every enabled src/.pi ambient entrypoint default-loadable', async () => {
    const settings = JSON.parse(await readFile(join(projectRoot(), 'src/.pi/settings.json'), 'utf8')) as {
      extensions?: string[];
    };
    const disabledEntrypoints = new Set(
      (settings.extensions ?? [])
        .filter((entry) => entry.startsWith('-'))
        .map((entry) => join(projectRoot(), 'src/.pi', entry.slice(1))),
    );

    const files = await listExtensionEntrypoints();
    for (const file of files) {
      if (disabledEntrypoints.has(file)) continue;
      const source = await readFile(file, 'utf8');
      expect(source, file).toContain('export default');
    }
  });

  it('registers product extensions from the shell in explicit order', async () => {
    const recording = createRecordingExtensionApi();

    await createBrunchPiExtensions(brunchChromeFixture, recording.onSessionBoundary, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
    })(recording.api);

    expect(recording.toolNames).toEqual([
      'read',
      'grep',
      'find',
      'ls',
      'read_workspace_context',
      'read_specification_context',
      'read_session_context',
      'web_fetch',
      'web_search',
      BRUNCH_EXECUTE_STATUS_TOOL,
      BRUNCH_ORCHESTRATOR_STUB_TOOL,
      'present_alternatives',
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      REQUEST_RESPONSE_TOOL,
      'read_elicitation_scratchpad',
      'update_elicitation_scratchpad',
    ]);
    expect(recording.commandNames).toEqual([BRUNCH_SWITCH_COMMAND, BRUNCH_MODE_COMMAND]);
    expect(recording.messageRenderers).toEqual(['alternatives-card-set']);
    expect(recording.shortcuts).toEqual(['alt+m', 'ctrl+shift+b']);
    expect(recording.eventNames).toEqual([
      'session_start',
      'before_agent_start',
      'message_start',
      'session_start',
      'model_select',
      'thinking_level_select',
      'message_start',
      'turn_end',
      'session_before_fork',
      'session_start',
      'before_agent_start',
      'tool_call',
      'user_bash',
      'before_agent_start',
      'session_start',
    ]);

    const sessionStartIndexes = recording.eventNames.flatMap((event, index) =>
      event === 'session_start' ? [index] : [],
    );
    expect(sessionStartIndexes[0]).toBeLessThan(sessionStartIndexes[1] ?? -1);
  });

  it('registers execute_snapshot only with selected graph deps and returns a side-effect-free projection', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 42,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 11,
              nodes: [
                {
                  id: 1,
                  specId: 42,
                  plane: 'intent',
                  kind: 'requirement',
                  kindOrdinal: 1,
                  title: 'Run the cooked feature',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
                {
                  id: 2,
                  specId: 42,
                  plane: 'intent',
                  kind: 'criterion',
                  kindOrdinal: 1,
                  title: 'Feature answers the probe',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [
                {
                  id: 1,
                  specId: 42,
                  category: 'witness',
                  sourceId: 2,
                  targetId: 1,
                  stance: 'for',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getElicitationGaps: () => [],
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 11,
        },
      },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const snapshot = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_SNAPSHOT_TOOL);
    expect(snapshot).toBeDefined();
    const result = await snapshot!.execute('call-1', { mode: 'brownfield' });

    expect(result.content[0]?.text).toContain('execute_snapshot: spec 42 (brownfield)');
    expect(result.details).toMatchObject({
      source: { graphLsn: 11, visibility: 'active' },
      sideEffects: [],
      snapshot: {
        schemaVersion: 1,
        specId: '42',
        mode: 'brownfield',
        requirements: [expect.objectContaining({ itemId: 'requirement-1' })],
        criteria: [expect.objectContaining({ itemId: 'criterion-2', verifies: ['requirement-1'] })],
      },
    });
  });

  it('keeps execute_status side-effect free while plan/cook/land are pending', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (
        toolCallId: string,
        params: unknown,
      ) => Promise<{
        content: readonly { text: string }[];
        details: Record<string, unknown>;
      }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const status = registeredTools.find((tool) => tool.name === BRUNCH_EXECUTE_STATUS_TOOL);
    expect(status).toBeDefined();
    const result = await status!.execute('call-1', { discipline: 'interpretive' });

    expect(result.content[0]?.text).toContain('execute_status: interpretive');
    expect(result.content[0]?.text).toContain('pending tools: plan, cook, land');
    expect(result.details).toMatchObject({
      discipline: 'interpretive',
      availableDisciplines: ['strict', 'interpretive'],
      portedTools: ['execute_status'],
      pendingTools: ['plan', 'cook', 'land'],
      sideEffects: [],
    });
  });

  it('keeps the default stub tool output aligned with its registered identity', async () => {
    const registeredTools: Array<{
      name: string;
      execute: (toolCallId: string, params: unknown) => Promise<{ content: readonly { text: string }[] }>;
    }> = [];

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
    })({
      on() {},
      registerTool(tool: (typeof registeredTools)[number]) {
        registeredTools.push(tool);
      },
      registerCommand() {},
      registerShortcut() {},
      registerMessageRenderer() {},
      sendMessage() {},
      getAllTools: () => [],
      setActiveTools() {},
    } as never);

    const stub = registeredTools.find((tool) => tool.name === BRUNCH_ORCHESTRATOR_STUB_TOOL);
    expect(stub).toBeDefined();
    const result = await stub!.execute('call-1', { message: 'standup' });
    const toolLabel = BRUNCH_ORCHESTRATOR_STUB_TOOL.replaceAll('_', ' ');
    expect(result.content[0]?.text).toBe(`${toolLabel} ran: standup`);
  });

  it('registers both graph-register and reconciliation-register tools when graph deps are provided', async () => {
    const recording = createRecordingExtensionApi();

    await createBrunchPiExtensions(brunchChromeFixture, recording.onSessionBoundary, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () => ({ lsn: 1, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 1,
        },
      },
    })(recording.api);

    expect(recording.toolNames).toEqual(
      expect.arrayContaining([
        'mutate_graph',
        'read_graph',
        BRUNCH_EXECUTE_SNAPSHOT_TOOL,
        'read_elicitation_gaps',
        'read_reconciliation_needs',
        'update_reconciliation_needs',
      ]),
    );
    // the reconciliation register is a dedicated tool, not a read_graph mode
    expect(recording.toolNames.filter((name) => name === 'read_reconciliation_needs')).toHaveLength(1);
  });

  it('wires prepareNextTurn into the live session boundary and leaves provider-request as guard-only', async () => {
    let graphLsn = 3;
    const appended: Array<Record<string, unknown>> = [];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.slice(),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ type: 'custom', customType, data });
      },
      appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
        appended.push({ type: 'custom_message', customType, content, details });
      },
    };

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: graphLsn,
              nodes: [{ id: 10, kind: 'goal', title: 'Live goal', updatedAtLsn: graphLsn }],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => graphLsn,
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual([
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: expect.objectContaining({ specId: 1, currentLsn: 3, changedSinceLsn: 0 }),
      },
    ]);

    await expect(
      events.get('before_provider_request')?.[0]?.({}, { sessionManager }),
    ).resolves.toBeUndefined();
    expect(appended).toHaveLength(1);

    graphLsn = 4;
    await expect(
      events.get('before_provider_request')?.[0]?.({}, { sessionManager }),
    ).resolves.toBeUndefined();
    expect(appended).toEqual([
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: expect.objectContaining({ specId: 1, currentLsn: 3, changedSinceLsn: 0 }),
      },
      {
        type: 'custom_message',
        customType: 'worldUpdate',
        content: expect.any(String),
        details: expect.objectContaining({ specId: 1, currentLsn: 4, changedSinceLsn: 3 }),
      },
    ]);
  });

  it('advances the capture sweep watermark from the live before_agent_start boundary', async () => {
    const appended: Array<Record<string, unknown>> = [
      { type: 'message', message: { role: 'user', content: 'The web observer must be read-only.' } },
      { type: 'message', message: { role: 'toolResult', toolName: 'bash', details: { ok: true } } },
    ];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.slice(),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ type: 'custom', customType, data });
      },
      appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
        appended.push({ type: 'custom_message', customType, content, details });
      },
    };

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () => ({ lsn: 0, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 0,
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual([
      { type: 'message', message: { role: 'user', content: 'The web observer must be read-only.' } },
      { type: 'message', message: { role: 'toolResult', toolName: 'bash', details: { ok: true } } },
      {
        type: 'custom',
        customType: 'brunch.capture_sweep_watermark',
        data: expect.objectContaining({ customType: 'brunch.capture_sweep_watermark' }),
      },
    ]);

    await expect(
      events.get('before_provider_request')?.[0]?.({}, { sessionManager }),
    ).resolves.toBeUndefined();
    expect(appended).toHaveLength(3);
  });

  it('threads transcript mentions and continuity drains into the live prepareNextTurn adapter', async () => {
    const appended: Array<Record<string, unknown>> = [
      { type: 'custom', customType: 'brunch.context_seed', data: { specId: 1, snapshotLsn: 1 } },
      { type: 'custom', customType: 'brunch.mention', data: { entityId: '10', handle: 'G1', seenLsn: 1 } },
    ];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.slice(),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ type: 'custom', customType, data });
      },
      appendCustomMessageEntry(customType: string, content: string, _display: boolean, details?: unknown) {
        appended.push({ type: 'custom_message', customType, content, details });
      },
    };

    await createBrunchPiExtensions(brunchChromeFixture, undefined, {
      coordinator: {} as never,
      continuityDrains: () => [{ kind: 'side_task', id: 'side-1', summary: 'Side task done' }],
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () =>
            ({
              lsn: 2,
              nodes: [{ id: 10, kind: 'goal', title: 'Live goal', updatedAtLsn: 2 }],
              edges: [],
            }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 2,
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual(
      expect.arrayContaining([
        {
          type: 'custom_message',
          customType: 'brunch.mention_staleness_hint',
          content: expect.stringContaining('G1'),
          details: { entityId: '10', handle: 'G1', seenLsn: 1, currentLsn: 2 },
        },
        {
          type: 'custom_message',
          customType: 'brunch.side_task_result',
          content: expect.stringContaining('Side task done'),
          details: { id: 'side-1', summary: 'Side task done' },
        },
      ]),
    );
  });
});

const brunchChromeFixture = {
  cwd: '/tmp/brunch',
  chatMode: 'responding-to-elicitation' as const,
  phase: 'elicitation' as const,
  spec: {
    id: 1,
    title: 'Fixture spec',
  },
  session: {
    id: 'session-1',
    label: 'Fixture session',
  },
};

function recordingApiWithEvents(events: Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>) {
  return {
    on(eventName: string, handler: (event: any, ctx: any) => Promise<void> | void) {
      events.set(eventName, [...(events.get(eventName) ?? []), handler]);
    },
    registerTool() {},
    registerCommand() {},
    registerShortcut() {},
    registerMessageRenderer() {},
    sendMessage() {},
    getAllTools: () =>
      [
        'read',
        'grep',
        'find',
        'ls',
        'present_alternatives',
        PRESENT_QUESTION_TOOL,
        REQUEST_RESPONSE_TOOL,
        'bash',
        'edit',
        'write',
      ].map((name) => ({ name })),
    setActiveTools() {},
  } as never;
}

function createRecordingExtensionApi() {
  const eventNames: string[] = [];
  const toolNames: string[] = [];
  const commandNames: string[] = [];
  const shortcuts: string[] = [];
  const messageRenderers: string[] = [];
  const onSessionBoundary = async () => {};
  const api = {
    on(eventName: string) {
      eventNames.push(eventName);
    },
    registerTool(tool: { name: string }) {
      toolNames.push(tool.name);
    },
    registerCommand(name: string) {
      commandNames.push(name);
    },
    registerShortcut(name: string) {
      shortcuts.push(name);
    },
    registerMessageRenderer(type: string) {
      messageRenderers.push(type);
    },
    sendMessage() {},
    getAllTools: () =>
      [
        'read',
        'grep',
        'find',
        'ls',
        'present_alternatives',
        PRESENT_QUESTION_TOOL,
        REQUEST_RESPONSE_TOOL,
        'bash',
        'edit',
        'write',
      ].map((name) => ({ name })),
    setActiveTools() {},
  };
  return {
    api: api as never,
    eventNames,
    toolNames,
    commandNames,
    shortcuts,
    messageRenderers,
    onSessionBoundary,
  };
}

async function listExtensionEntrypoints(): Promise<string[]> {
  const extensionsDir = join(projectRoot(), 'src/.pi/extensions');
  const entries = await readdir(extensionsDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(extensionsDir, entry.name);
    if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
    if (entry.isDirectory()) {
      const indexFile = join(path, 'index.ts');
      if (await fileExists(indexFile)) files.push(indexFile);
    }
  }
  return files;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function projectRoot(): string {
  return dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
}
