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
 *  - `/brunch:mode`     — change the transcript-backed operational mode.
 *
 * Keyboard shortcuts (match the bracketed key hints in the footer chrome):
 *  - `ctrl+shift+b` — spec/session picker (borrows a command-capable context
 *                     from the composition root for the actual session switch;
 *                     alt+b is reserved by Pi's editor for cursorWordLeft)
 *  - `alt+m` — mode picker
 *
 * Disabled until operational (constant kept so tests can assert absence):
 *  - `/brunch:continue` — recover/restart from an interrupted `request_*` tool
 *                         or other interruption. Needs to: (a) optionally add a
 *                         system-prompt hint that bare "continue" resumes the
 *                         brunch flow, and (b) install listeners on user cancel
 *                         actions that surface a `setStatus` reminder.
 */

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

import { appendBrunchAgentRuntimeSwitch } from '../../../session/runtime-state.js';
import {
  OPERATIONAL_MODE_IDS,
  operationalModeLabel,
  type OperationalModeId,
} from '../../../session/schema/kinds.js';
import { createRuntimeModePickerComponent } from '../../components/runtime-posture/axis-picker.js';
import {
  activeToolNamesForBrunchAgentState,
  projectBrunchAgentState,
} from '../agent-runtime/runtime/index.js';
import {
  runBrunchWorkspaceAction,
  type BrunchSpecSessionPickerOptions,
  type BrunchWorkspaceActionContext,
} from '../workspace/index.js';

export const BRUNCH_COMMAND_PREFIX = 'brunch:';
export const BRUNCH_SWITCH_COMMAND = 'brunch:switch';
export const BRUNCH_CONTINUE_COMMAND = 'brunch:continue';
export const BRUNCH_MODE_COMMAND = 'brunch:mode';

/** alt+b is unavailable: Pi reserves it as a built-in editor binding (cursorWordLeft). */
export const BRUNCH_SWITCH_SHORTCUT = 'ctrl+shift+b';
export const BRUNCH_MODE_SHORTCUT = 'alt+m';

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
};

interface RuntimeSwitchContext {
  readonly ui: Pick<ExtensionCommandContext['ui'], 'notify' | 'custom'>;
  readonly sessionManager: ExtensionCommandContext['sessionManager'];
}

function normalizeAxisArg(args: string): string {
  return args.trim().split(/\s+/)[0] ?? '';
}

function formatOperationalModeChoices(): string {
  return OPERATIONAL_MODE_IDS.map((mode) => `${mode} (${operationalModeLabel(mode)})`).join(', ');
}

async function openModePicker(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh'>,
): Promise<void> {
  const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
  if (typeof ctx.ui.custom !== 'function') {
    ctx.ui.notify(`Brunch mode is ${operationalModeLabel(current.operationalMode)}.`, 'info');
    return;
  }
  const picked = await ctx.ui.custom<OperationalModeId | undefined>((_tui, theme, _keybindings, done) =>
    createRuntimeModePickerComponent({
      current: current.operationalMode,
      theme,
      onDone: done,
    }),
  );
  if (picked === undefined) return;
  if (picked === current.operationalMode) {
    ctx.ui.notify(`Brunch mode is already ${operationalModeLabel(current.operationalMode)}.`, 'info');
    return;
  }
  applyModeSwitch(pi, ctx, picked, options);
}

function applyModeSwitch(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  nextMode: OperationalModeId,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh'>,
): void {
  const nextState = {
    schemaVersion: 1 as const,
    operationalMode: nextMode,
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
    activeToolNamesForBrunchAgentState(pi, projectBrunchAgentState(ctx.sessionManager.getEntries())),
  );
  options.requestChromeRefresh?.();
  ctx.ui.notify(`Brunch mode set to ${operationalModeLabel(nextMode)}.`, 'info');
}

function registerRuntimeSwitchCommands(
  pi: ExtensionAPI,
  options: Pick<BrunchCommandsOptions, 'requestChromeRefresh'>,
): void {
  pi.registerCommand(BRUNCH_MODE_COMMAND, {
    description: 'Change the active Brunch operational mode',
    getArgumentCompletions: (prefix) =>
      OPERATIONAL_MODE_IDS.filter((value) => value.startsWith(prefix)).map((value) => ({
        value,
        label: operationalModeLabel(value),
      })),
    handler: async (args, ctx) => {
      const selection = normalizeAxisArg(args);
      const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
      if (!selection) {
        await openModePicker(pi, ctx, options);
        return;
      }
      if (!OPERATIONAL_MODE_IDS.includes(selection as OperationalModeId)) {
        ctx.ui.notify(`Unknown mode "${selection}". Use one of: ${formatOperationalModeChoices()}.`, 'error');
        return;
      }
      if (selection === current.operationalMode) {
        ctx.ui.notify(`Brunch mode is already ${operationalModeLabel(current.operationalMode)}.`, 'info');
        return;
      }
      applyModeSwitch(pi, ctx, selection as OperationalModeId, options);
    },
  });

  pi.registerShortcut?.(BRUNCH_MODE_SHORTCUT, {
    description: 'Change the Brunch mode',
    handler: async (ctx) => {
      await openModePicker(pi, ctx, options);
    },
  });
}

function workspaceActionOptions(
  options: Pick<BrunchCommandsOptions, 'productUpdates'>,
): Parameters<typeof runBrunchWorkspaceAction>[2] {
  return options.productUpdates ? { productUpdates: options.productUpdates } : {};
}

export function registerBrunchCommands(pi: ExtensionAPI, options: BrunchCommandsOptions): void {
  const { coordinator } = options;
  pi.registerCommand(BRUNCH_SWITCH_COMMAND, {
    description: 'Open the Brunch spec/session picker',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      await runBrunchWorkspaceAction(ctx, coordinator, workspaceActionOptions(options));
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
    await runBrunchWorkspaceAction(commandContext ?? ctx, coordinator, workspaceActionOptions(options));
  };
  pi.registerShortcut?.(BRUNCH_SWITCH_SHORTCUT, {
    description: 'Open the Brunch spec/session picker',
    handler: openSwitchPicker,
  });
}
