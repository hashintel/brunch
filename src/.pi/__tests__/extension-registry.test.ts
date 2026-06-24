import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../../app/pi-extensions.js';
import { registerBrunchAlternatives as alternatives } from '../components/alternatives.js';
import chrome from '../extensions/chrome/index.js';
import {
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  registerBrunchCommands as commands,
} from '../extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers as commandPolicy } from '../extensions/commands/policy.js';
import { registerBrunchContext as context } from '../extensions/context/index.js';
import {
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_RESPONSE_TOOL,
  registerStructuredExchange as structuredExchange,
  PRESENT_CANDIDATES_TOOL,
} from '../extensions/exchanges/index.js';
import { registerBrunchMentionAutocomplete as mentionAutocomplete } from '../extensions/mentions/index.js';
import { BRUNCH_ORCHESTRATOR_STUB_TOOL } from '../extensions/orchestrator-stub/index.js';
import { registerBrunchOperationalModePolicy as operationalMode } from '../extensions/runtime/index.js';
import { registerBrunchSessionBoundary as sessionLifecycle } from '../extensions/session/lifecycle.js';
import { registerBrunchPrompting as prompting } from '../extensions/system-prompts/index.js';

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

  it('keeps the src/.pi chrome entrypoint activated for direct Pi iteration', async () => {
    const settings = JSON.parse(await readFile(join(projectRoot(), 'src/.pi/settings.json'), 'utf8')) as {
      extensions?: unknown;
    };

    expect(settings.extensions).toContain('extensions/chrome/index.ts');
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
      BRUNCH_ORCHESTRATOR_STUB_TOOL,
      'present_alternatives',
      PRESENT_QUESTION_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      PRESENT_CANDIDATES_TOOL,
      REQUEST_RESPONSE_TOOL,
    ]);
    expect(recording.commandNames).toEqual([
      BRUNCH_SWITCH_COMMAND,
      BRUNCH_LENS_COMMAND,
      BRUNCH_STRATEGY_COMMAND,
      BRUNCH_MODE_COMMAND,
    ]);
    expect(recording.messageRenderers).toEqual(['alternatives-card-set']);
    expect(recording.shortcuts).toEqual(['alt+m', 'alt+s', 'alt+l', 'ctrl+shift+b']);
    expect(recording.eventNames).toEqual([
      'session_start',
      'before_agent_start',
      'message_start',
      'session_start',
      'model_select',
      'thinking_level_select',
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

  it('registers the orchestrator stub tool on the default product extension path', async () => {
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
    await expect(stub!.execute('call-1', { message: 'standup' })).resolves.toMatchObject({
      content: [{ type: 'text', text: 'orchestrator stub ran: standup' }],
    });
  });

  it('registers both graph-register and elicitation-register tools when graph deps are provided', async () => {
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
          getElicitationGaps: () => [],
          getOpenReconciliationNeeds: () => [],
          latestLsn: () => 1,
        },
      },
    })(recording.api);

    expect(recording.toolNames).toEqual(
      expect.arrayContaining([
        'mutate_graph',
        'read_graph',
        'read_elicitation_gaps',
        'read_reconciliation_needs',
        'update_reconciliation_needs',
      ]),
    );
    // the elicitation/reconciliation registers are dedicated tools, not read_graph modes
    expect(recording.toolNames.filter((name) => name === 'read_elicitation_gaps')).toHaveLength(1);
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
          queryGraph: () => ({ lsn: 0, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getElicitationGaps: () => [],
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
      graph: {
        specId: 1,
        commandExecutor: {} as never,
        reads: {
          queryGraph: () => ({ lsn: 0, nodes: [], edges: [] }) as never,
          getNodes: () => [],
          resolveNodeCode: () => undefined,
          getElicitationGaps: () => [],
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
          getElicitationGaps: () => [],
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

  it('does not retain the filesystem-discovery product-extension protocol', async () => {
    const shell = await readFile(join(projectRoot(), 'src/app/pi-extensions.ts'), 'utf8');
    const discoveryExport = ['discover', 'BrunchProductExtensionEntries'].join('');
    expect(shell).not.toContain(`export async function ${discoveryExport}`);
    expect(shell).not.toContain('node:fs/promises');
    expect(shell).not.toContain('pathToFileURL');

    const forbiddenExportNames = [
      ['brunch', 'ExtensionMeta'].join(''),
      ['register', 'BrunchProductExtension'].join(''),
    ];
    const files = await listExtensionEntrypoints();
    for (const file of files) {
      const source = await readFile(file, 'utf8');
      for (const exportName of forbiddenExportNames) {
        expect(source, file).not.toContain(`export const ${exportName}`);
        expect(source, file).not.toContain(`export function ${exportName}`);
      }
    }
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
  return dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
}
