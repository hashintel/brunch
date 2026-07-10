import { describe, expect, it } from 'vitest';

import type { EntryLike } from '../../../exchanges/recovery.js';
import {
  STRUCTURED_EXCHANGE_DETAILS_VERSION,
  STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
} from '../../../exchanges/schemas/index.js';
import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
import { BRUNCH_KICK_CUSTOM_TYPE } from '../../../session/originate-assistant-turn.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentStateEntryData,
} from '../../../session/runtime-state.js';
import { BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE } from '../../../session/session-orientation.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import {
  BRUNCH_CONSULT_COMMAND,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_MENU_COMMAND,
  BRUNCH_MENU_SHORTCUT,
  BRUNCH_MODE_COMMAND,
  BRUNCH_MODE_PICKER_SHORTCUT,
  BRUNCH_MODE_SHORTCUT,
  registerBrunchCommands,
} from '../commands/index.js';
import { CODE_SESSION_ORIENTATION_MENU } from '../session-orientation/index.js';
import {
  orientationJunctureGate,
  type BrunchSessionOrientationDeps,
} from '../session-orientation/registrar.js';

interface RegisteredCommand {
  description?: string;
  handler: (args: string, ctx: FakeCommandContext) => Promise<void>;
}

interface RegisteredShortcut {
  description?: string;
  handler: (ctx: FakeCommandContext) => Promise<void>;
}

interface RuntimeEntry {
  type: 'custom';
  customType: string;
  data: unknown;
}

interface SentMessage {
  message: unknown;
  options?: unknown;
}

interface FakeCommandContext {
  hasUI: boolean;
  ui: {
    notify(message: string, level?: 'info' | 'warning' | 'error'): void;
    select(title: string, options: string[]): Promise<string | undefined>;
    custom?<T>(factory: (...args: unknown[]) => unknown, options: unknown): Promise<T | undefined>;
    input?(prompt: string, placeholder?: string): Promise<string | undefined>;
    setStatus?(key: string, text: string | undefined): void;
  };
  sessionManager: {
    getEntries(): readonly RuntimeEntry[];
    getBranch?: () => readonly EntryLike[];
    appendCustomEntry(customType: string, data: unknown): void;
    appendMessage?: (message: unknown) => void;
  };
  mode: 'tui';
  modelRegistry: { getAvailable(): readonly unknown[] };
  isIdle?: () => boolean;
  abort?: () => void;
  waitForIdle?: () => Promise<void>;
}

function commandHarness(
  options: {
    customResult?: unknown;
    customAvailable?: boolean;
    orientation?: boolean;
    selectResult?: string | undefined;
    modelAvailable?: boolean;
    getCommandContext?: () => FakeCommandContext;
    branch?: readonly EntryLike[];
    inputResult?: string;
  } = {},
) {
  const entries: RuntimeEntry[] = [];
  const appendedMessages: unknown[] = [];
  const sent: SentMessage[] = [];
  const notifications: Array<{ message: string; level?: 'info' | 'warning' | 'error' }> = [];
  const commands = new Map<string, RegisteredCommand>();
  const shortcuts = new Map<string, RegisteredShortcut>();
  const activeToolNames: string[][] = [];
  const customCalls: Array<{ factory: (...args: unknown[]) => unknown; options: unknown }> = [];
  const selectCalls: Array<{ title: string; options: string[] }> = [];
  const statusCalls: Array<{ key: string; text: string | undefined }> = [];
  const chromeRefreshes: number[] = [];
  const workspaceDecisions: unknown[] = [];
  const originationDecisions: unknown[] = [];
  const coordinator = {
    inspectWorkspace: async () => ({ projects: [] }),
    activateWorkspace: async (decision: unknown) => {
      workspaceDecisions.push(decision);
      return { status: 'needs_human', reason: 'workspace action reached' };
    },
  };
  const ctx: FakeCommandContext = {
    // hasUI mirrors custom availability: since pi 0.80.x headless contexts
    // carry stub custom functions, so the guard checks hasUI first.
    hasUI: options.customAvailable !== false,
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
      setStatus(key, text) {
        statusCalls.push({ key, text });
      },
      select: async (title, choices) => {
        selectCalls.push({ title, options: choices });
        return options.selectResult ?? choices[0];
      },
      input: async () => options.inputResult ?? '',
    },
    sessionManager: {
      getEntries: () => entries,
      getBranch: () => [
        ...(options.branch ?? []),
        ...appendedMessages.map((message) => ({
          type: 'message' as const,
          message: message as EntryLike['message'],
        })),
      ],
      appendCustomEntry(customType, data) {
        entries.push({ type: 'custom', customType, data });
      },
      appendMessage(message) {
        appendedMessages.push(message);
      },
    },
    mode: 'tui',
    modelRegistry: { getAvailable: () => (options.modelAvailable === false ? [] : [{}]) },
  };
  if (options.customAvailable !== false) {
    ctx.ui.custom = async <T>(factory: (...args: unknown[]) => unknown, customOptions: unknown) => {
      customCalls.push({ factory, options: customOptions });
      return options.customResult as T | undefined;
    };
  }

  const orientationDeps: BrunchSessionOrientationDeps | undefined = options.orientation
    ? {
        resolveKickContext: () => ({
          specId: 7,
          specName: 'Alpha',
          reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) as never },
          workspaceContext: '',
          sendCustomMessage: async () => undefined,
          onOriginationDecision: (decision, context) => {
            originationDecisions.push({ decision, context });
          },
        }),
      }
    : undefined;

  registerBrunchCommands(
    {
      registerCommand(name: string, command: RegisteredCommand) {
        commands.set(name, command);
      },
      registerShortcut(name: string, shortcut: RegisteredShortcut) {
        shortcuts.set(name, shortcut);
      },
      appendEntry(customType: string, data: BrunchAgentStateEntryData) {
        entries.push({ type: 'custom', customType, data });
      },
      getAllTools: () =>
        [
          'read',
          'grep',
          'find',
          'ls',
          'ask',

          'mutate_graph',
          'execute_status',
        ].map((name) => ({
          name,
        })),
      setActiveTools(names: string[]) {
        activeToolNames.push(names);
      },
      sendMessage(message: unknown, sendOptions?: unknown) {
        sent.push({ message, options: sendOptions });
      },
    } as never,
    {
      coordinator: coordinator as never,
      getCommandContext: options.getCommandContext as never,
      requestChromeRefresh: () => {
        chromeRefreshes.push(chromeRefreshes.length + 1);
      },
      ...(orientationDeps ? { sessionOrientation: orientationDeps } : {}),
    },
  );

  return {
    commands,
    shortcuts,
    ctx,
    entries,
    notifications,
    appendedMessages,
    activeToolNames,
    customCalls,
    selectCalls,
    statusCalls,
    chromeRefreshes,
    workspaceDecisions,
    originationDecisions,
    sent,
    orientationDeps,
  };
}

describe('Brunch menu command', () => {
  it('registers /brunch:menu without keeping the retired command as an alias', () => {
    const harness = commandHarness();
    const retiredCommand = ['brunch', 'switch'].join(':');

    expect([...harness.commands.keys()]).toEqual([
      BRUNCH_MENU_COMMAND,
      BRUNCH_MODE_COMMAND,
      BRUNCH_CONSULT_COMMAND,
      BRUNCH_CONTINUE_COMMAND,
    ]);
    expect(harness.commands.has(retiredCommand)).toBe(false);
  });

  it('runs the workspace action from /brunch:menu', async () => {
    const decision = { kind: 'newSession' };
    const harness = commandHarness({ customResult: decision });

    await harness.commands.get(BRUNCH_MENU_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.workspaceDecisions).toEqual([decision]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'warning', message: 'workspace action reached' }),
    ]);
  });

  it('keeps ctrl+shift+b wired to the workspace action through a command-capable context fallback', async () => {
    const decision = { kind: 'openSession' };
    const borrowedWaits: number[] = [];
    const harness = commandHarness({
      customAvailable: false,
      customResult: decision,
      getCommandContext: () => ({
        ...harness.ctx,
        hasUI: true,
        waitForIdle: async () => {
          borrowedWaits.push(1);
        },
        ui: {
          ...harness.ctx.ui,
          custom: async <T>(_factory: (...args: unknown[]) => unknown, _options: unknown) => decision as T,
        },
      }),
    });

    await harness.shortcuts.get(BRUNCH_MENU_SHORTCUT)?.handler(harness.ctx);

    expect(borrowedWaits).toEqual([1]);
    expect(harness.workspaceDecisions).toEqual([decision]);
  });

  it('registers /brunch:consult and forces the orientation dialog through custom UI', async () => {
    const harness = commandHarness({ orientation: true, customResult: { id: 'propose_design' } });

    await harness.commands.get(BRUNCH_CONSULT_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.selectCalls).toEqual([]);
    const rendered = (
      harness.customCalls[0]!.factory(undefined, createTestLabTheme(), undefined, () => {}) as {
        render(width: number): string[];
      }
    )
      .render(80)
      .join('\n');
    expect(rendered).toContain('[ Specify ]');
    expect(rendered).toContain('"Alpha"');
    expect(rendered).not.toContain('[ Consult ]');
    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'propose_design', trigger: 'consult' },
      }),
    );
  });

  it('derives /brunch:consult (J6) menu from Execute runtime state', async () => {
    const harness = commandHarness({
      orientation: true,
      customAvailable: false,
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'execute_plan')!.label,
    });
    harness.ctx.hasUI = true;
    harness.entries.push({
      type: 'custom',
      customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
      data: {
        schemaVersion: 1,
        reason: 'switch',
        source: 'user',
        state: { schemaVersion: 1, operationalMode: 'execute' },
      },
    });

    await harness.commands.get(BRUNCH_CONSULT_COMMAND)?.handler('', harness.ctx);

    expect(harness.selectCalls).toEqual([
      {
        title: CODE_SESSION_ORIENTATION_MENU.title,
        options: CODE_SESSION_ORIENTATION_MENU.items.map((item) => item.label),
      },
    ]);
    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'execute_plan', trigger: 'consult' },
      }),
    );
  });

  it('reports unavailable resume when no incomplete structured exchange exists and no kick seam is bound', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.appendedMessages).toEqual([]);
    expect(harness.sent).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'warning', message: 'Brunch resume is unavailable in this session.' }),
    ]);
  });

  it('resumes no-auth-suppressed boot work with seed-before-kick debug evidence when no declared ask is open', async () => {
    const harness = commandHarness({ orientation: true });

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.appendedMessages).toEqual([]);
    expect(harness.sent).toEqual([
      {
        message: expect.objectContaining({
          customType: 'brunch.context_seed',
          content: expect.stringContaining('Alpha'),
          details: { specId: 7, snapshotLsn: 1 },
        }),
        options: undefined,
      },
      {
        message: expect.objectContaining({
          customType: BRUNCH_KICK_CUSTOM_TYPE,
          details: { origin: 'manual_trigger' },
        }),
        options: { triggerTurn: true },
      },
    ]);
    expect(harness.originationDecisions).toEqual([
      {
        decision: expect.objectContaining({
          action: 'start',
          origin: 'manual_trigger',
          seedEntries: [
            expect.objectContaining({
              customType: 'brunch.context_seed',
              details: { specId: 7, snapshotLsn: 1 },
            }),
          ],
        }),
        context: { modelAvailable: true },
      },
    ]);
  });

  it('resumes general interrupted work through a manual-trigger kick when no declared ask is open', async () => {
    const harness = commandHarness({ orientation: true });
    harness.entries.push({
      type: 'message',
      message: { role: 'assistant', content: 'Waiting here.', timestamp: 1 },
    } as never);
    harness.ctx.sessionManager.getBranch = () => harness.entries as never;

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.appendedMessages).toEqual([]);
    expect(harness.sent).toContainEqual({
      message: expect.objectContaining({
        customType: BRUNCH_KICK_CUSTOM_TYPE,
        details: { origin: 'manual_trigger' },
      }),
      options: { triggerTurn: true },
    });
  });

  it('lets explicit continue override a prior dismissed orientation entry', async () => {
    const harness = commandHarness({ orientation: true });
    harness.entries.push(
      {
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'dismissed', trigger: 'consult' },
      },
      {
        type: 'message',
        message: { role: 'assistant', content: 'Waiting here.', timestamp: 1 },
      } as never,
    );
    harness.ctx.sessionManager.getBranch = () => harness.entries as never;

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.sent).toContainEqual({
      message: expect.objectContaining({
        customType: BRUNCH_KICK_CUSTOM_TYPE,
        details: { origin: 'manual_trigger' },
      }),
      options: { triggerTurn: true },
    });
  });

  it('re-presents the most recent incomplete structured exchange, records the canonical answer, and clears the continue hint', async () => {
    const harness = commandHarness({
      branch: [
        toolResultEntry({
          schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
          v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
          exchange_id: 'digest-review',
          tool_meta: { curr: 'present_digest', next: 'ask' },
          display: { heading: 'Review digest' },
          digest: { abstract: 'The source supports building the slice.' },
          continuation: {
            tool: 'ask',
            params: {
              body: 'Review digest',
              options: [
                { id: 'approve', label: 'Approve' },
                { id: 'request_changes', label: 'Request changes' },
                { id: 'reject', label: 'Reject' },
              ],
            },
          },
        }),
      ],
      customResult: { id: 'approve' },
    });

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.statusCalls).toContainEqual({ key: 'brunch.continue', text: undefined });
    expect(harness.appendedMessages).toEqual([
      expect.objectContaining({
        role: 'assistant',
        content: [expect.objectContaining({ name: 'ask', arguments: { continues: 'digest-review' } })],
      }),
      expect.objectContaining({
        role: 'toolResult',
        toolName: 'ask',
        details: expect.objectContaining({
          exchange_id: 'digest-review',
          tool_meta: { prev: 'present_digest', curr: 'request_review', next: 'capture_review' },
          answered: expect.objectContaining({
            decision: 'approve',
            accepted_abstract: 'The source supports building the slice.',
          }),
        }),
      }),
    ]);
  });

  it('surfaces a /brunch:continue status hint when ask collection is cancelled', async () => {
    const harness = commandHarness({
      branch: [
        toolResultEntry({
          schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
          v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
          exchange_id: 'digest-review',
          tool_meta: { curr: 'present_digest', next: 'ask' },
          display: { heading: 'Review digest' },
          digest: { abstract: 'The source supports building the slice.' },
          continuation: {
            tool: 'ask',
            params: {
              body: 'Review digest',
              options: [
                { id: 'approve', label: 'Approve' },
                { id: 'request_changes', label: 'Request changes' },
                { id: 'reject', label: 'Reject' },
              ],
            },
          },
        }),
      ],
      customResult: undefined,
    });

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.statusCalls).toContainEqual({
      key: 'brunch.continue',
      text: expect.stringContaining('/brunch:continue'),
    });
    expect(harness.statusCalls).toContainEqual({
      key: 'brunch.continue',
      text: expect.stringContaining('/brunch:consult'),
    });
    expect(harness.statusCalls).toContainEqual({
      key: 'brunch.continue',
      text: expect.stringContaining('/brunch:mode'),
    });
    expect(harness.appendedMessages.at(-1)).toMatchObject({
      role: 'toolResult',
      toolName: 'ask',
      details: { exchange_id: 'digest-review', cancelled: {} },
    });
  });

  it('keeps the exchange resumable after a cancelled continue attempt', async () => {
    const harness = commandHarness({
      branch: [
        toolResultEntry({
          schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
          v: STRUCTURED_EXCHANGE_DETAILS_VERSION,
          exchange_id: 'digest-review',
          tool_meta: { curr: 'present_digest', next: 'ask' },
          display: { heading: 'Review digest' },
          digest: { abstract: 'The source supports building the slice.' },
          continuation: {
            tool: 'ask',
            params: {
              body: 'Review digest',
              options: [
                { id: 'approve', label: 'Approve' },
                { id: 'request_changes', label: 'Request changes' },
                { id: 'reject', label: 'Reject' },
              ],
            },
          },
        }),
      ],
      customResult: undefined,
    });

    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);
    await harness.commands.get(BRUNCH_CONTINUE_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(2);
    expect(harness.notifications).not.toContainEqual(
      expect.objectContaining({ message: 'Nothing to continue.' }),
    );
  });
});

describe('Brunch runtime switch commands', () => {
  it.each([['execute', { operationalMode: 'execute' }]] as const)(
    'appends a user runtime switch for /brunch:mode %s',
    async (args, expectedState) => {
      const harness = commandHarness();

      await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler(args, harness.ctx);

      expect(harness.entries).toHaveLength(1);
      expect(harness.entries[0]).toMatchObject({
        type: 'custom',
        customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
        data: {
          schemaVersion: 1,
          reason: 'switch',
          source: 'user',
          previous: DEFAULT_BRUNCH_AGENT_STATE,
          state: {
            ...DEFAULT_BRUNCH_AGENT_STATE,
            ...expectedState,
          },
        },
      });
      expect(projectBrunchAgentState(harness.entries)).toMatchObject(expectedState);
      expect(harness.notifications.at(-1)).toMatchObject({ level: 'info' });
    },
  );

  it('opens the mode picker for no-arg mode commands and commits through the runtime switch path', async () => {
    const harness = commandHarness({ customResult: 'execute' });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    // No overlay options: the picker replaces the input editor in place.
    expect(harness.customCalls[0]?.options).toBeUndefined();
    expect(harness.entries).toHaveLength(1);
    expect(harness.entries[0]?.data).toMatchObject({
      reason: 'switch',
      source: 'user',
      state: { ...DEFAULT_BRUNCH_AGENT_STATE, operationalMode: 'execute' },
    });
    expect(harness.activeToolNames).toHaveLength(1);
    expect(harness.activeToolNames.at(-1)).toEqual(expect.arrayContaining(['execute_status']));
  });

  it('opens the mode picker from alt+m while shift+tab keeps cycling', async () => {
    const harness = commandHarness({ customResult: 'execute' });

    await harness.shortcuts.get(BRUNCH_MODE_PICKER_SHORTCUT)?.handler(harness.ctx);
    await harness.shortcuts.get(BRUNCH_MODE_SHORTCUT)?.handler(harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.entries.map((entry) => (entry.data as BrunchAgentStateEntryData).state)).toEqual([
      { ...DEFAULT_BRUNCH_AGENT_STATE, operationalMode: 'execute' },
      { ...DEFAULT_BRUNCH_AGENT_STATE, operationalMode: 'specify' },
    ]);
  });

  it('reports a no-op when the picker selects the current mode', async () => {
    const harness = commandHarness({ customResult: 'specify' });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('already Specify') }),
    ]);
  });

  it('cancels the no-arg mode picker without appending runtime state', async () => {
    const harness = commandHarness({ customResult: undefined });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.entries).toEqual([]);
  });

  it('falls back to current-mode reporting when no-arg mode command has no custom TUI surface', async () => {
    const harness = commandHarness({ customResult: undefined });
    delete harness.ctx.ui.custom;

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: 'Brunch mode is Specify.' }),
    ]);
  });

  it('rejects unknown mode values without appending runtime state', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('unknown-mode', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Unknown mode') }),
    ]);
  });

  it('derives the post-switch tool posture from the new operational mode', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(harness.activeToolNames.at(-1)).toEqual(
      expect.arrayContaining(['ask', 'mutate_graph', 'execute_status']),
    );
  });

  it('cycles operational mode from the shortcut through the runtime switch path', async () => {
    const harness = commandHarness();

    await harness.shortcuts.get(BRUNCH_MODE_SHORTCUT)?.handler(harness.ctx);
    await harness.shortcuts.get(BRUNCH_MODE_SHORTCUT)?.handler(harness.ctx);

    expect(harness.customCalls).toEqual([]);
    expect(harness.entries.map((entry) => (entry.data as BrunchAgentStateEntryData).state)).toEqual([
      { ...DEFAULT_BRUNCH_AGENT_STATE, operationalMode: 'execute' },
      { ...DEFAULT_BRUNCH_AGENT_STATE, operationalMode: 'specify' },
    ]);
    expect(projectBrunchAgentState(harness.entries)).toMatchObject({ operationalMode: 'specify' });
    expect(harness.activeToolNames).toHaveLength(2);
    expect(harness.chromeRefreshes).toHaveLength(2);
  });

  it('borrows the command context for shortcut mode cycling so J5 can settle in-flight work', async () => {
    const harness = commandHarness({
      orientation: true,
      customResult: { id: 'prepare_execution' },
    });
    const shortcutCtx = { ...harness.ctx };
    let idle = false;
    const borrowedCtx = {
      ...harness.ctx,
      isIdle: () => idle,
      abort: () => {
        idle = true;
      },
      waitForIdle: async () => undefined,
    };
    registerBrunchCommands(
      {
        registerCommand() {},
        registerShortcut(name: string, shortcut: RegisteredShortcut) {
          harness.shortcuts.set(name, shortcut);
        },
        appendEntry(customType: string, data: BrunchAgentStateEntryData) {
          harness.entries.push({ type: 'custom', customType, data });
        },
        getAllTools: () => [{ name: 'read' }, { name: 'execute_status' }],
        setActiveTools(names: string[]) {
          harness.activeToolNames.push(names);
        },
        sendMessage(message: unknown, sendOptions?: unknown) {
          harness.sent.push({ message, options: sendOptions });
        },
      } as never,
      {
        coordinator: {} as never,
        sessionOrientation: harness.orientationDeps!,
        getCommandContext: () => borrowedCtx as never,
      },
    );

    await harness.shortcuts.get(BRUNCH_MODE_SHORTCUT)?.handler(shortcutCtx);

    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'prepare_execution', trigger: 'mode-switch' },
      }),
    );
  });

  it('does not fire a provider turn from shortcut cycling when no allowlisted model is available', async () => {
    const harness = commandHarness({
      orientation: true,
      modelAvailable: false,
    });

    await harness.shortcuts.get(BRUNCH_MODE_SHORTCUT)?.handler(harness.ctx);

    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        customType: BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
        data: expect.objectContaining({
          state: { ...DEFAULT_BRUNCH_AGENT_STATE, operationalMode: 'execute' },
        }),
      }),
    );
    expect(harness.sent).toEqual([]);
  });

  it('aborts an in-flight turn (claiming the J4 gate) before showing the mode-switch menu', async () => {
    const harness = commandHarness({
      orientation: true,
      customResult: { id: 'prepare_execution' },
    });
    const events: string[] = [];
    let idle = false;
    harness.ctx.isIdle = () => idle;
    harness.ctx.abort = () => {
      events.push('abort');
      // The J4 claim must already be set when the abort lands, so the
      // registrar's agent_end handler sees it before running its dialog.
      expect(orientationJunctureGate(harness.orientationDeps!).suppressNextAbortJuncture).toBe(true);
    };
    harness.ctx.waitForIdle = async () => {
      events.push('waitForIdle');
      idle = true;
    };
    const baseCustom = harness.ctx.ui.custom!.bind(harness.ctx.ui);
    harness.ctx.ui.custom = async (factory, options) => {
      events.push('custom');
      return baseCustom(factory, options);
    };

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(events).toEqual(['abort', 'waitForIdle', 'custom']);
    expect(orientationJunctureGate(harness.orientationDeps!).suppressNextAbortJuncture).toBe(true);
    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'prepare_execution', trigger: 'mode-switch' },
      }),
    );
  });

  it('skips the abort path when waitForIdle is unavailable', async () => {
    const harness = commandHarness({
      orientation: true,
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'prepare_execution')!
        .label,
    });
    const aborts: number[] = [];
    harness.ctx.isIdle = () => false;
    harness.ctx.abort = () => {
      aborts.push(1);
    };

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(aborts).toEqual([]);
    expect(orientationJunctureGate(harness.orientationDeps!).suppressNextAbortJuncture).toBe(false);
  });

  it('leaves an idle agent alone on mode switch (no abort, no gate claim)', async () => {
    const harness = commandHarness({
      orientation: true,
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'prepare_execution')!
        .label,
    });
    const aborts: number[] = [];
    harness.ctx.isIdle = () => true;
    harness.ctx.abort = () => {
      aborts.push(1);
    };

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(aborts).toEqual([]);
    expect(orientationJunctureGate(harness.orientationDeps!).suppressNextAbortJuncture).toBe(false);
  });

  it('runs the CODE-side orientation menu and kicks on the selected choice after switching to Execute', async () => {
    const harness = commandHarness({
      orientation: true,
      customResult: { id: 'prepare_execution' },
    });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.selectCalls).toEqual([]);
    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'prepare_execution', trigger: 'mode-switch' },
      }),
    );
    expect(harness.sent).toHaveLength(2);
    expect(harness.sent[0]?.message).toMatchObject({
      customType: 'brunch.context_seed',
      content: expect.stringContaining('chosen: prepare_execution'),
    });
    expect(harness.sent[1]).toEqual({
      message: expect.objectContaining({ customType: BRUNCH_KICK_CUSTOM_TYPE }),
      options: { triggerTurn: true },
    });
  });

  it('requests a chrome refresh after a successful runtime switch and not on rejection or cancel', async () => {
    const harness = commandHarness({ customResult: undefined });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);
    expect(harness.chromeRefreshes).toHaveLength(1);

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('unknown-mode', harness.ctx);
    expect(harness.chromeRefreshes).toHaveLength(1);

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);
    expect(harness.chromeRefreshes).toHaveLength(1);
  });

  it('renders a simple mode picker without suspended caution text', async () => {
    const theme = createTestLabTheme();
    const harness = commandHarness({ customResult: undefined });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);

    const renderPicker = (call?: { factory: (...args: unknown[]) => unknown }) => {
      const component = call?.factory(undefined, theme, undefined, () => {}) as {
        render(width: number): string[];
      };
      return component.render(220).join('\n');
    };

    const modeText = renderPicker(harness.customCalls[0]);
    expect(modeText).not.toContain('-- NOTE:');
    expect(modeText).toContain('Specify');
    expect(modeText).toContain('Execute');
  });

  it('reports explicit mode args without inventing extra runtime state', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('specify', harness.ctx);
    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(harness.entries).toHaveLength(1);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('already Specify') }),
      expect.objectContaining({ level: 'info', message: expect.stringContaining('mode set to Execute') }),
    ]);
  });
});

function toolResultEntry(details: unknown): EntryLike {
  return {
    type: 'message',
    message: {
      role: 'toolResult',
      details,
    },
  };
}
