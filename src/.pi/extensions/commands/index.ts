/** @file commands.ts
 *
 * Registers Brunch's namespaced `/brunch:*` slash commands.
 *
 * Pi parses slash command names as everything between the leading `/` and the
 * first whitespace (see `_tryExecuteExtensionCommand` in
 * `@earendil-works/pi-coding-agent/dist/core/agent-session.js`). Colons in
 * command names are passed through verbatim, so registering a command with the
 * literal name `brunch:switch` makes it invocable as `/brunch:switch`. This is
 * the same trick the built-in `/skill:<name>` registry uses.
 *
 * Active commands:
 *  - `/brunch:switch`   — open the spec/session picker (delegates to
 *                         workspace-dialog.ts).
 *  - `/brunch:lens`     — change the transcript-backed agent lens.
 *  - `/brunch:strategy` — change the transcript-backed agent strategy.
 *  - `/brunch:mode`     — show the operational-mode picker; planned modes
 *                         (execute) are visible but disabled, so only the
 *                         current `elicit` mode is selectable.
 *
 * Keyboard shortcuts (match the `[opt-x]:` hints in the footer chrome):
 *  - `alt+b` — spec/session picker (borrows a command-capable context from
 *              the composition root for the actual session switch)
 *  - `alt+m` — mode picker
 *  - `alt+s` — strategy picker
 *  - `alt+l` — lens picker
 *
 * Disabled until operational (constant kept so tests can assert absence):
 *  - `/brunch:continue` — recover/restart from an interrupted `request_*` tool
 *                         or other interruption. Needs to: (a) optionally add a
 *                         system-prompt hint that bare "continue" resumes the
 *                         brunch flow, and (b) install listeners on user cancel
 *                         actions that surface a `setStatus` reminder.
 */

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

import type { ElicitationGap } from '../../../graph/schema/elicitation-gaps.js';
import { pinnableAxisOptionsForRuntimeState } from '../../../projections/session/runtime-policy.js';
import {
  AGENT_LENS_IDS,
  AGENT_STRATEGY_IDS,
  OPERATIONAL_MODE_IDS,
  appendBrunchAgentRuntimeSwitch,
  type AgentLensSelection,
  type AgentStrategySelection,
  type OperationalModeChoice,
} from '../../../session/runtime-state.js';
import {
  createRuntimeLensPickerComponent,
  createRuntimeModePickerComponent,
  createRuntimeStrategyPickerComponent,
} from '../../components/runtime-posture/axis-picker.js';
import { activeToolNamesForBrunchAgentState, projectBrunchAgentState } from '../runtime/index.js';
import {
  runBrunchWorkspaceAction,
  type BrunchSpecSessionPickerOptions,
  type BrunchWorkspaceActionContext,
} from '../workspace/index.js';

export const BRUNCH_COMMAND_PREFIX = 'brunch:';
export const BRUNCH_SWITCH_COMMAND = 'brunch:switch';
export const BRUNCH_CONTINUE_COMMAND = 'brunch:continue';
export const BRUNCH_LENS_COMMAND = 'brunch:lens';
export const BRUNCH_STRATEGY_COMMAND = 'brunch:strategy';
export const BRUNCH_MODE_COMMAND = 'brunch:mode';

export const BRUNCH_SWITCH_SHORTCUT = 'alt+b';
/** Long-standing binding for the spec/session picker; kept as an alias of alt+b. */
export const BRUNCH_SWITCH_SHORTCUT_LEGACY = 'ctrl+shift+b';
export const BRUNCH_MODE_SHORTCUT = 'alt+m';
export const BRUNCH_STRATEGY_SHORTCUT = 'alt+s';
export const BRUNCH_LENS_SHORTCUT = 'alt+l';

export type BrunchCommandsOptions = BrunchSpecSessionPickerOptions & {
  /** Called after a runtime posture switch so chrome (footer) re-renders from re-projected state. */
  readonly requestChromeRefresh?: () => void;
  /**
   * Live command-capable context for keyboard shortcuts. Pi's shortcut
   * contexts lack `switchSession`/`waitForIdle`, so the spec/session switch
   * shortcut borrows a full command context from the composition root when
   * available and degrades to the shortcut context otherwise.
   */
  readonly getCommandContext?: () => ExtensionCommandContext | undefined;
  /**
   * Must-wire: the post-switch tool posture derives from these gaps. Required
   * so a composition root cannot leave runtime switches recomputing legality
   * from an empty register (which silently floor-locks gated tools until the
   * next turn boundary).
   */
  readonly getElicitationGaps: () => readonly ElicitationGap[];
};

interface RuntimeSwitchContext {
  readonly ui: Pick<ExtensionCommandContext['ui'], 'notify' | 'custom'>;
  readonly sessionManager: ExtensionCommandContext['sessionManager'];
}

function normalizeAxisArg(args: string): string {
  return args.trim().split(/\s+/)[0] ?? '';
}

function isStrategySelection(value: string): value is AgentStrategySelection {
  return value === 'auto' || AGENT_STRATEGY_IDS.includes(value as never);
}

function isLensSelection(value: string): value is AgentLensSelection {
  return value === 'auto' || AGENT_LENS_IDS.includes(value as never);
}

type RuntimeSwitchPatch =
  | { readonly axis: 'strategy'; readonly value: AgentStrategySelection }
  | { readonly axis: 'lens'; readonly value: AgentLensSelection };

function strategyUsage(): string {
  return `Usage: /${BRUNCH_STRATEGY_COMMAND} <auto|${AGENT_STRATEGY_IDS.join('|')}>`;
}

function lensUsage(): string {
  return `Usage: /${BRUNCH_LENS_COMMAND} <auto|${AGENT_LENS_IDS.join('|')}>`;
}

/**
 * Open the lens picker (non-overlay ui.custom: temporarily replaces the input
 * editor in place, so it renders at the input area instead of floating at a
 * terminal-absolute anchor). Shared by the `/brunch:lens` no-arg command and
 * the lens shortcut.
 */
async function openLensPicker(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh' | 'getElicitationGaps'>,
): Promise<void> {
  const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
  // Capability-readiness (D74-L) marks readiness-thin lenses as caution in
  // the picker, but never bars pinning them — the agent negotiates and
  // gated methods/tools stay withheld downstream.
  const readinessLegal = pinnableAxisOptionsForRuntimeState('lens', current, options.getElicitationGaps());
  if (typeof ctx.ui.custom !== 'function') {
    ctx.ui.notify(lensUsage(), 'info');
    return;
  }
  const picked = await ctx.ui.custom<AgentLensSelection | undefined>((_tui, theme, _keybindings, done) =>
    createRuntimeLensPickerComponent({
      current: current.agentLens,
      caution: AGENT_LENS_IDS.filter((id) => !readinessLegal.includes(id)),
      theme,
      onDone: done,
    }),
  );
  if (picked === undefined) return;
  if (!isLensSelection(picked)) {
    ctx.ui.notify(lensUsage(), 'error');
    return;
  }
  applyRuntimeSwitch(pi, ctx, { axis: 'lens', value: picked }, options);
}

/** Open the strategy picker; see {@link openLensPicker} for rendering notes. */
async function openStrategyPicker(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh' | 'getElicitationGaps'>,
): Promise<void> {
  const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
  // Capability-readiness (D74-L) marks readiness-thin strategies as caution
  // in the picker, but never bars pinning them; freestyle is always an
  // explicit user pin (D66-L).
  const readinessLegal = pinnableAxisOptionsForRuntimeState(
    'strategy',
    current,
    options.getElicitationGaps(),
  );
  if (typeof ctx.ui.custom !== 'function') {
    ctx.ui.notify(strategyUsage(), 'info');
    return;
  }
  const picked = await ctx.ui.custom<AgentStrategySelection | undefined>((_tui, theme, _keybindings, done) =>
    createRuntimeStrategyPickerComponent({
      current: current.agentStrategy,
      caution: AGENT_STRATEGY_IDS.filter((id) => !readinessLegal.includes(id)),
      theme,
      onDone: done,
    }),
  );
  if (picked === undefined) return;
  if (!isStrategySelection(picked)) {
    ctx.ui.notify(strategyUsage(), 'error');
    return;
  }
  applyRuntimeSwitch(pi, ctx, { axis: 'strategy', value: picked }, options);
}

/**
 * Open the mode picker. Planned modes render disabled, so the only
 * committable pick is the current mode — committing it is a no-op report
 * until execute mode exists.
 */
async function openModePicker(ctx: RuntimeSwitchContext): Promise<void> {
  const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
  if (typeof ctx.ui.custom !== 'function') {
    ctx.ui.notify(`Brunch mode is ${current.operationalMode}.`, 'info');
    return;
  }
  const picked = await ctx.ui.custom<OperationalModeChoice | undefined>((_tui, theme, _keybindings, done) =>
    createRuntimeModePickerComponent({
      current: current.operationalMode,
      theme,
      onDone: done,
    }),
  );
  if (picked === undefined) return;
  ctx.ui.notify(`Brunch mode is already ${current.operationalMode}.`, 'info');
}

function applyRuntimeSwitch(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  patch: RuntimeSwitchPatch,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh' | 'getElicitationGaps'>,
): void {
  const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
  const nextState = {
    schemaVersion: 1 as const,
    operationalMode: current.operationalMode,
    agentStrategy: patch.axis === 'strategy' ? patch.value : current.agentStrategy,
    agentLens: patch.axis === 'lens' ? patch.value : current.agentLens,
    agentGoal: current.agentGoal,
  };

  appendBrunchAgentRuntimeSwitch(
    {
      getEntries: () => ctx.sessionManager.getEntries(),
      appendCustomEntry: (customType, data) => {
        pi.appendEntry(customType, data);
      },
    },
    nextState,
    'user',
  );

  pi.setActiveTools(
    activeToolNamesForBrunchAgentState(
      pi,
      projectBrunchAgentState(ctx.sessionManager.getEntries()),
      options.getElicitationGaps(),
    ),
  );
  options.requestChromeRefresh?.();
  ctx.ui.notify(`Brunch ${patch.axis} set to ${patch.value}.`, 'info');
}

function registerRuntimeSwitchCommands(
  pi: ExtensionAPI,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh' | 'getElicitationGaps'>,
): void {
  pi.registerCommand(BRUNCH_LENS_COMMAND, {
    description: `Change the active Brunch lens (${['auto', ...AGENT_LENS_IDS].join(', ')})`,
    getArgumentCompletions: (prefix) =>
      ['auto', ...AGENT_LENS_IDS]
        .filter((value) => value.startsWith(prefix))
        .map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      const selection = normalizeAxisArg(args);
      if (!selection) {
        await openLensPicker(pi, ctx, options);
        return;
      }
      if (!isLensSelection(selection)) {
        ctx.ui.notify(
          `Unknown lens "${selection}". Use one of: auto, ${AGENT_LENS_IDS.join(', ')}.`,
          'error',
        );
        return;
      }
      applyRuntimeSwitch(pi, ctx, { axis: 'lens', value: selection }, options);
    },
  });

  pi.registerCommand(BRUNCH_STRATEGY_COMMAND, {
    description: `Change the active Brunch strategy (${['auto', ...AGENT_STRATEGY_IDS].join(', ')})`,
    getArgumentCompletions: (prefix) =>
      ['auto', ...AGENT_STRATEGY_IDS]
        .filter((value) => value.startsWith(prefix))
        .map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      const selection = normalizeAxisArg(args);
      if (!selection) {
        await openStrategyPicker(pi, ctx, options);
        return;
      }
      if (!isStrategySelection(selection)) {
        ctx.ui.notify(
          `Unknown strategy "${selection}". Use one of: auto, ${AGENT_STRATEGY_IDS.join(', ')}.`,
          'error',
        );
        return;
      }
      applyRuntimeSwitch(pi, ctx, { axis: 'strategy', value: selection }, options);
    },
  });

  pi.registerCommand(BRUNCH_MODE_COMMAND, {
    description: 'Show the active Brunch operational mode; only elicit is selectable for now',
    getArgumentCompletions: (prefix) =>
      OPERATIONAL_MODE_IDS.filter((value) => value.startsWith(prefix)).map((value) => ({
        value,
        label: value,
      })),
    handler: async (args, ctx) => {
      const selection = normalizeAxisArg(args);
      const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
      if (!selection) {
        await openModePicker(ctx);
        return;
      }
      if (selection === current.operationalMode) {
        ctx.ui.notify(`Brunch mode is already ${current.operationalMode}.`, 'info');
        return;
      }
      ctx.ui.notify(
        'Only elicit mode is available in this Brunch build; execute mode is not implemented.',
        'error',
      );
    },
  });

  pi.registerShortcut?.(BRUNCH_MODE_SHORTCUT, {
    description: 'Change the Brunch mode',
    handler: async (ctx) => {
      await openModePicker(ctx);
    },
  });
  pi.registerShortcut?.(BRUNCH_STRATEGY_SHORTCUT, {
    description: 'Change the Brunch strategy',
    handler: async (ctx) => {
      await openStrategyPicker(pi, ctx, options);
    },
  });
  pi.registerShortcut?.(BRUNCH_LENS_SHORTCUT, {
    description: 'Change the Brunch lens',
    handler: async (ctx) => {
      await openLensPicker(pi, ctx, options);
    },
  });
}

export function registerBrunchCommands(pi: ExtensionAPI, options: BrunchCommandsOptions): void {
  const { coordinator } = options;
  pi.registerCommand(BRUNCH_SWITCH_COMMAND, {
    description: 'Open the Brunch spec/session picker',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      await runBrunchWorkspaceAction(ctx, coordinator);
    },
  });

  registerRuntimeSwitchCommands(pi, options);

  // Pi shortcut contexts lack switchSession/waitForIdle, so borrow a
  // command-capable context from the composition root when available.
  // The fallback shortcut context still opens the picker; an actual
  // cross-session switch then degrades to a warning (see
  // switchToActivatedWorkspace).
  const openSwitchPicker = async (ctx: BrunchWorkspaceActionContext) => {
    const commandContext = options.getCommandContext?.();
    await runBrunchWorkspaceAction(commandContext ?? ctx, coordinator);
  };
  for (const shortcut of [BRUNCH_SWITCH_SHORTCUT, BRUNCH_SWITCH_SHORTCUT_LEGACY] as const) {
    pi.registerShortcut?.(shortcut, {
      description: 'Open the Brunch spec/session picker',
      handler: openSwitchPicker,
    });
  }
}
