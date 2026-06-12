import { describe, expect, it } from 'vitest';

import { groundingFloorGaps } from '../../graph/schema/elicitation-gap-fixtures.js';
import { projectBrunchAgentState } from '../../projections/session/runtime-state.js';
import {
  BRUNCH_AGENT_RUNTIME_STATE_CUSTOM_TYPE,
  DEFAULT_BRUNCH_AGENT_STATE,
  type BrunchAgentStateEntryData,
} from '../../session/runtime-state.js';
import {
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  registerBrunchCommands,
} from '../extensions/commands/index.js';
import { createTestLabTheme } from './support/tui-theme.js';

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
    gaps?: ReturnType<typeof groundingFloorGaps>;
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
        ['read', 'grep', 'find', 'ls', 'present_question', 'request_answer', 'mutate_graph'].map((name) => ({
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
      getElicitationGaps: () => options.gaps ?? groundingFloorGaps(),
    },
  );

  return { commands, ctx, entries, notifications, activeToolNames, customCalls, chromeRefreshes };
}

describe('Brunch runtime switch commands', () => {
  it.each([
    [BRUNCH_STRATEGY_COMMAND, 'propose-graph', { agentStrategy: 'propose-graph' }],
    [BRUNCH_STRATEGY_COMMAND, 'auto', { agentStrategy: 'auto' }],
    [BRUNCH_LENS_COMMAND, 'intent', { agentLens: 'intent' }],
    [BRUNCH_LENS_COMMAND, 'auto', { agentLens: 'auto' }],
  ] as const)('appends a user runtime switch for /%s %s', async (commandName, args, expectedState) => {
    const harness = commandHarness();

    await harness.commands.get(commandName)?.handler(args, harness.ctx);

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
  });

  it('opens the strategy picker for no-arg strategy commands and commits through the runtime switch path', async () => {
    const harness = commandHarness({ customResult: 'project-graph' });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    // No overlay options: the picker replaces the input editor in place.
    expect(harness.customCalls[0]?.options).toBeUndefined();
    expect(harness.entries).toHaveLength(1);
    expect(harness.entries[0]?.data).toMatchObject({
      reason: 'switch',
      source: 'user',
      state: { ...DEFAULT_BRUNCH_AGENT_STATE, agentStrategy: 'project-graph' },
    });
    expect(harness.activeToolNames).toHaveLength(1);
  });

  it('opens the lens picker for no-arg lens commands and commits through the runtime switch path', async () => {
    const harness = commandHarness({ customResult: 'oracle' });

    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    // No overlay options: the picker replaces the input editor in place.
    expect(harness.customCalls[0]?.options).toBeUndefined();
    expect(harness.entries).toHaveLength(1);
    expect(harness.entries[0]?.data).toMatchObject({
      reason: 'switch',
      source: 'user',
      state: { ...DEFAULT_BRUNCH_AGENT_STATE, agentLens: 'oracle' },
    });
    expect(harness.activeToolNames).toHaveLength(1);
  });

  it('cancels the no-arg strategy picker without appending runtime state', async () => {
    const harness = commandHarness({ customResult: undefined });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.entries).toEqual([]);
  });

  it('cancels the no-arg lens picker without appending runtime state', async () => {
    const harness = commandHarness({ customResult: undefined });

    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    expect(harness.entries).toEqual([]);
  });

  it('falls back to usage when no-arg strategy command has no custom TUI surface', async () => {
    const harness = commandHarness({ customAvailable: false });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('Usage:') }),
    ]);
  });

  it('falls back to usage when no-arg lens command has no custom TUI surface', async () => {
    const harness = commandHarness({ customAvailable: false });

    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('Usage:') }),
    ]);
  });

  it('rejects unknown strategy and lens values without appending runtime state', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('unknown-strategy', harness.ctx);
    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('unknown-lens', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Unknown strategy') }),
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Unknown lens') }),
    ]);
  });

  it('derives the post-switch tool posture from the supplied gap reader, not an empty register', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('propose-graph', harness.ctx);

    // The harness gap reader reports a covered grounding floor, so the
    // recomputed active tools must include the capability-gated mutate_graph
    // instead of the floor-locked set an empty register would produce.
    expect(harness.activeToolNames.at(-1)).toEqual(expect.arrayContaining(['mutate_graph']));
  });

  it('requests a chrome refresh after a successful runtime switch and not on rejection or cancel', async () => {
    const harness = commandHarness({ customResult: undefined });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('propose-graph', harness.ctx);
    expect(harness.chromeRefreshes).toHaveLength(1);

    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('unknown-lens', harness.ctx);
    expect(harness.chromeRefreshes).toHaveLength(1);

    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('', harness.ctx);
    expect(harness.chromeRefreshes).toHaveLength(1);
  });

  it('rejects pinning a readiness-gated strategy while floor gaps are uncovered', async () => {
    const harness = commandHarness({ gaps: groundingFloorGaps({ defaultCoverage: 0 }) });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('propose-graph', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({
        level: 'error',
        message: expect.stringContaining('"propose-graph" is not yet enabled'),
      }),
    ]);
  });

  it('keeps freestyle explicitly pinnable at zero floor coverage', async () => {
    const harness = commandHarness({ gaps: groundingFloorGaps({ defaultCoverage: 0 }) });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('freestyle', harness.ctx);

    expect(harness.entries).toHaveLength(1);
    expect(harness.entries[0]?.data).toMatchObject({
      reason: 'switch',
      source: 'user',
      state: { ...DEFAULT_BRUNCH_AGENT_STATE, agentStrategy: 'freestyle' },
    });
  });

  it('shows readiness-gated options as disabled in the pickers', async () => {
    const theme = createTestLabTheme();
    const harness = commandHarness({ gaps: groundingFloorGaps({ defaultCoverage: 0 }) });

    await harness.commands.get(BRUNCH_STRATEGY_COMMAND)?.handler('', harness.ctx);
    await harness.commands.get(BRUNCH_LENS_COMMAND)?.handler('', harness.ctx);

    const renderPicker = (call?: { factory: (...args: unknown[]) => unknown }) => {
      const component = call?.factory(undefined, theme, undefined, () => {}) as {
        render(width: number): string[];
      };
      return component.render(220).join('\n');
    };

    expect(renderPicker(harness.customCalls[0])).toContain(
      '-- NOTE: propose-graph and project-graph are not yet enabled',
    );
    expect(renderPicker(harness.customCalls[1])).toContain('-- NOTE: design and oracle are not yet enabled');
  });

  it('opens the mode picker for no-arg mode commands and never appends a runtime switch', async () => {
    const harness = commandHarness({ customResult: 'elicit' });

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('', harness.ctx);

    expect(harness.customCalls).toHaveLength(1);
    // No overlay options: the picker replaces the input editor in place.
    expect(harness.customCalls[0]?.options).toBeUndefined();
    // Elicit is the only enabled mode, so committing it is a no-op report.
    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('already elicit') }),
    ]);
  });

  it('reports explicit mode args without inventing future modes', async () => {
    const harness = commandHarness();

    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('elicit', harness.ctx);
    await harness.commands.get(BRUNCH_MODE_COMMAND)?.handler('execute', harness.ctx);

    expect(harness.entries).toEqual([]);
    expect(harness.notifications).toEqual([
      expect.objectContaining({ level: 'info', message: expect.stringContaining('already elicit') }),
      expect.objectContaining({ level: 'error', message: expect.stringContaining('Only elicit mode') }),
    ]);
  });
});
