import { describe, expect, it } from 'vitest';

import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentStateEntryData,
} from '../../../session/runtime-state.js';
import { createTestLabTheme } from '../../__tests__/support/tui-theme.js';
import { BRUNCH_MODE_COMMAND, registerBrunchCommands } from '../commands/index.js';

interface RegisteredCommand {
  description?: string;
  handler: (args: string, ctx: FakeCommandContext) => Promise<void>;
}

interface RuntimeEntry {
  type: 'custom';
  customType: string;
  data: BrunchAgentStateEntryData;
}

interface FakeCommandContext {
  ui: {
    notify(message: string, level?: 'info' | 'warning' | 'error'): void;
    custom?<T>(factory: (...args: unknown[]) => unknown, options: unknown): Promise<T | undefined>;
  };
  sessionManager: {
    getEntries(): readonly RuntimeEntry[];
  };
}

function commandHarness(
  options: {
    customResult?: unknown;
    customAvailable?: boolean;
  } = {},
) {
  const entries: RuntimeEntry[] = [];
  const notifications: Array<{ message: string; level?: 'info' | 'warning' | 'error' }> = [];
  const commands = new Map<string, RegisteredCommand>();
  const activeToolNames: string[][] = [];
  const customCalls: Array<{ factory: (...args: unknown[]) => unknown; options: unknown }> = [];
  const chromeRefreshes: number[] = [];
  const ctx: FakeCommandContext = {
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
    },
    sessionManager: {
      getEntries: () => entries,
    },
  };
  if (options.customAvailable !== false) {
    ctx.ui.custom = async <T>(factory: (...args: unknown[]) => unknown, customOptions: unknown) => {
      customCalls.push({ factory, options: customOptions });
      return options.customResult as T | undefined;
    };
  }

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
          'present_question',
          'request_response',
          'mutate_graph',
          'orchestrator_stub',
        ].map((name) => ({
          name,
        })),
      setActiveTools(names: string[]) {
        activeToolNames.push(names);
      },
    } as never,
    {
      coordinator: {} as never,
      requestChromeRefresh: () => {
        chromeRefreshes.push(chromeRefreshes.length + 1);
      },
    },
  );

  return { commands, ctx, entries, notifications, activeToolNames, customCalls, chromeRefreshes };
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
    expect(harness.activeToolNames.at(-1)).toEqual(expect.arrayContaining(['orchestrator_stub']));
  });

  it('reports a no-op when the picker selects the current mode', async () => {
    const harness = commandHarness({ customResult: 'elicit' });

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

    expect(harness.activeToolNames.at(-1)).toEqual(expect.arrayContaining(['orchestrator_stub']));
    expect(harness.activeToolNames.at(-1)).not.toEqual(expect.arrayContaining(['mutate_graph']));
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

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('elicit', harness.ctx);
    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(harness.entries).toHaveLength(1);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('already Specify') }),
      expect.objectContaining({ level: 'info', message: expect.stringContaining('mode set to Execute') }),
    ]);
  });
});
