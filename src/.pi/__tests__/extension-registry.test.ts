import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import alternatives from '../extensions/alternatives.js';
import chrome from '../extensions/chrome.js';
import commandPolicy from '../extensions/command-policy.js';
import commands, {
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  BRUNCH_SWITCH_COMMAND,
} from '../extensions/commands.js';
import mentionAutocomplete from '../extensions/mention-autocomplete.js';
import operationalMode from '../extensions/operational-mode.js';
import prompting from '../extensions/prompting.js';
import sessionLifecycle from '../extensions/session-lifecycle.js';
import structuredExchange, {
  PRESENT_OPTIONS_TOOL,
  PRESENT_QUESTION_TOOL,
  REQUEST_ANSWER_TOOL,
  REQUEST_CHOICE_TOOL,
  REQUEST_CHOICES_TOOL,
} from '../extensions/structured-exchange/index.js';
import { createBrunchPiExtensionShell } from '../pi-extension-shell.js';

const extensionDefaults = {
  'alternatives.ts': alternatives,
  'chrome.ts': chrome,
  'command-policy.ts': commandPolicy,
  'commands.ts': commands,
  'mention-autocomplete.ts': mentionAutocomplete,
  'operational-mode.ts': operationalMode,
  'prompting.ts': prompting,
  'session-lifecycle.ts': sessionLifecycle,
  'structured-exchange/index.ts': structuredExchange,
};

describe('Brunch explicit Pi extension registry', () => {
  it('keeps default factory exports for src/.pi iteration', () => {
    for (const [path, factory] of Object.entries(extensionDefaults)) {
      expect(factory, path).toEqual(expect.any(Function));
    }
  });

  it('registers product extensions from the shell in explicit order', async () => {
    const recording = createRecordingExtensionApi();

    await createBrunchPiExtensionShell(brunchChromeFixture, recording.onSessionBoundary, {
      coordinator: {} as never,
      graphMentionSource: { listMentionCandidates: () => [] },
    })(recording.api);

    expect(recording.toolNames).toEqual([
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

  it('does not retain the filesystem-discovery product-extension protocol', async () => {
    const shell = await readFile(join(projectRoot(), 'src/.pi/pi-extension-shell.ts'), 'utf8');
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
