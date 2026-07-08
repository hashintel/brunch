import { describe, expect, it } from 'vitest';

import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
import { BRUNCH_KICK_CUSTOM_TYPE } from '../../../session/originate-assistant-turn.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentStateEntryData,
} from '../../../session/runtime-state.js';
import { BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE } from '../../../session/session-orientation.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { BRUNCH_MODE_COMMAND, registerBrunchCommands } from '../commands/index.js';
import { CODE_SESSION_ORIENTATION_MENU } from '../session-orientation/index.js';
import {
  orientationJunctureGate,
  type BrunchSessionOrientationDeps,
} from '../session-orientation/registrar.js';

interface RegisteredCommand {
  description?: string;
  handler: (args: string, ctx: FakeCommandContext) => Promise<void>;
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
  };
  sessionManager: {
    getEntries(): readonly RuntimeEntry[];
    appendCustomEntry(customType: string, data: unknown): void;
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
  } = {},
) {
  const entries: RuntimeEntry[] = [];
  const sent: SentMessage[] = [];
  const notifications: Array<{ message: string; level?: 'info' | 'warning' | 'error' }> = [];
  const commands = new Map<string, RegisteredCommand>();
  const activeToolNames: string[][] = [];
  const customCalls: Array<{ factory: (...args: unknown[]) => unknown; options: unknown }> = [];
  const selectCalls: Array<{ title: string; options: string[] }> = [];
  const chromeRefreshes: number[] = [];
  const ctx: FakeCommandContext = {
    // hasUI mirrors custom availability: since pi 0.80.x headless contexts
    // carry stub custom functions, so the guard checks hasUI first.
    hasUI: options.customAvailable !== false,
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
      select: async (title, choices) => {
        selectCalls.push({ title, options: choices });
        return options.selectResult ?? choices[0];
      },
    },
    sessionManager: {
      getEntries: () => entries,
      appendCustomEntry(customType, data) {
        entries.push({ type: 'custom', customType, data });
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
          reads: { queryGraph: () => ({ nodes: [], edges: [], lsn: 1 }) as never },
          workspaceContext: '',
          sendCustomMessage: async () => undefined,
        }),
      }
    : undefined;

  registerBrunchCommands(
    {
      registerCommand(name: string, command: RegisteredCommand) {
        commands.set(name, command);
      },
      registerShortcut() {},
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
      coordinator: {} as never,
      requestChromeRefresh: () => {
        chromeRefreshes.push(chromeRefreshes.length + 1);
      },
      ...(orientationDeps ? { sessionOrientation: orientationDeps } : {}),
    },
  );

  return {
    commands,
    ctx,
    entries,
    notifications,
    activeToolNames,
    customCalls,
    selectCalls,
    chromeRefreshes,
    sent,
    orientationDeps,
  };
}

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

  it('aborts an in-flight turn (claiming the J4 gate) before showing the mode-switch menu', async () => {
    const harness = commandHarness({
      orientation: true,
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'proceed')!.label,
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
    const baseSelect = harness.ctx.ui.select.bind(harness.ctx.ui);
    harness.ctx.ui.select = async (title, choices) => {
      events.push('select');
      return baseSelect(title, choices);
    };

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(events).toEqual(['abort', 'waitForIdle', 'select']);
    expect(orientationJunctureGate(harness.orientationDeps!).suppressNextAbortJuncture).toBe(true);
    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'proceed', trigger: 'mode-switch' },
      }),
    );
  });

  it('skips the abort path when waitForIdle is unavailable', async () => {
    const harness = commandHarness({
      orientation: true,
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'proceed')!.label,
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
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'proceed')!.label,
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
      selectResult: CODE_SESSION_ORIENTATION_MENU.items.find((item) => item.id === 'design_first')!.label,
    });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(harness.selectCalls[0]?.title).toBe(CODE_SESSION_ORIENTATION_MENU.title);
    expect(harness.entries).toContainEqual(
      expect.objectContaining({
        type: 'custom',
        customType: BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE,
        data: { schemaVersion: 1, choice: 'design_first', trigger: 'mode-switch' },
      }),
    );
    expect(harness.sent).toHaveLength(2);
    expect(harness.sent[0]?.message).toMatchObject({
      customType: 'brunch.context_seed',
      content: expect.stringContaining('chosen: design_first'),
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
