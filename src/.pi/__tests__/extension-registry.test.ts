import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { createBrunchPiExtensions } from '../brunch-pi-extensions.js';
import { registerBrunchAlternatives as alternatives } from '../components/alternatives.js';
import chrome from '../extensions/chrome/index.js';
import {
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  registerBrunchCommands as commands,
} from '../extensions/commands/index.js';
import { registerBrunchBranchPolicyHandlers as commandPolicy } from '../extensions/commands/policy.js';
import { registerBrunchContext as context } from '../extensions/context/index.js';
import {
  PRESENT_OPTIONS_TOOL,
  PRESENT_QUESTION_TOOL,
  PRESENT_REVIEW_SET_TOOL,
  REQUEST_ANSWER_TOOL,
  REQUEST_CHOICE_TOOL,
  REQUEST_CHOICES_TOOL,
  REQUEST_REVIEW_TOOL,
  registerStructuredExchange as structuredExchange,
} from '../extensions/exchanges/index.js';
import { registerBrunchMentionAutocomplete as mentionAutocomplete } from '../extensions/mentions/index.js';
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
      'read_session_context',
      'present_alternatives',
      PRESENT_QUESTION_TOOL,
      PRESENT_OPTIONS_TOOL,
      PRESENT_REVIEW_SET_TOOL,
      REQUEST_ANSWER_TOOL,
      REQUEST_CHOICE_TOOL,
      REQUEST_CHOICES_TOOL,
      REQUEST_REVIEW_TOOL,
    ]);
    expect(recording.commandNames).toEqual([
      BRUNCH_SWITCH_COMMAND,
      BRUNCH_CONTINUE_COMMAND,
      BRUNCH_LENS_COMMAND,
      BRUNCH_STRATEGY_COMMAND,
      BRUNCH_MODE_COMMAND,
    ]);
    expect(recording.messageRenderers).toEqual(['alternatives-card-set']);
    expect(recording.shortcuts).toEqual(['ctrl+shift+b']);
    expect(recording.eventNames).toEqual([
      'session_start',
      'before_agent_start',
      'message_start',
      'session_start',
      'model_select',
      'thinking_level_select',
      'turn_end',
      'session_before_tree',
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

  it('wires prepareNextTurn into the live session boundary and leaves provider-request as guard-only', async () => {
    let graphLsn = 3;
    const appended: Array<{ customType: string; data: unknown }> = [];
    const events = new Map<string, Array<(event: any, ctx: any) => Promise<void> | void>>();
    const sessionManager = {
      getEntries: () => appended.map((entry) => ({ type: 'custom', ...entry })),
      appendCustomEntry(customType: string, data: unknown) {
        appended.push({ customType, data });
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
        },
      },
    })(recordingApiWithEvents(events));

    await events.get('before_agent_start')?.[0]?.({}, { sessionManager });

    expect(appended).toEqual([
      {
        customType: 'worldUpdate',
        data: expect.objectContaining({ specId: 1, currentLsn: 3, changedSinceLsn: 0 }),
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
        customType: 'worldUpdate',
        data: expect.objectContaining({ specId: 1, currentLsn: 3, changedSinceLsn: 0 }),
      },
      {
        customType: 'worldUpdate',
        data: expect.objectContaining({ specId: 1, currentLsn: 4, changedSinceLsn: 3 }),
      },
    ]);
  });

  it('does not retain the filesystem-discovery product-extension protocol', async () => {
    const shell = await readFile(join(projectRoot(), 'src/.pi/brunch-pi-extensions.ts'), 'utf8');
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
        PRESENT_OPTIONS_TOOL,
        REQUEST_ANSWER_TOOL,
        REQUEST_CHOICE_TOOL,
        REQUEST_CHOICES_TOOL,
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
        PRESENT_OPTIONS_TOOL,
        REQUEST_ANSWER_TOOL,
        REQUEST_CHOICE_TOOL,
        REQUEST_CHOICES_TOOL,
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
