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
 *  - `/brunch:mode`     — report the current operational mode; explicit
 *                         `elicit` is accepted as a no-op.
 *
 * Stubbed for later (notify-only):
 *  - `/brunch:continue` — recover/restart from an interrupted `request_*` tool
 *                         or other interruption. Needs to: (a) optionally add a
 *                         system-prompt hint that bare "continue" resumes the
 *                         brunch flow, and (b) install listeners on user cancel
 *                         actions that surface a `setStatus` reminder.
 */

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

import {
  AGENT_LENS_IDS,
  AGENT_STRATEGY_IDS,
  OPERATIONAL_MODE_IDS,
  appendBrunchAgentRuntimeSwitch,
  type AgentLensSelection,
  type AgentStrategySelection,
} from '../../../session/runtime-state.js';
import {
  createRuntimeLensPickerComponent,
  createRuntimeStrategyPickerComponent,
} from '../../components/runtime-posture/axis-picker.js';
import { activeToolNamesForBrunchAgentState, projectBrunchAgentState } from '../runtime/index.js';
import { type BrunchSpecSessionPickerOptions, runBrunchWorkspaceAction } from '../workspace/index.js';

export const BRUNCH_COMMAND_PREFIX = 'brunch:';
export const BRUNCH_SWITCH_COMMAND = 'brunch:switch';
export const BRUNCH_CONTINUE_COMMAND = 'brunch:continue';
export const BRUNCH_LENS_COMMAND = 'brunch:lens';
export const BRUNCH_STRATEGY_COMMAND = 'brunch:strategy';
export const BRUNCH_MODE_COMMAND = 'brunch:mode';

export const BRUNCH_SWITCH_SHORTCUT = 'ctrl+shift+b';

export type BrunchCommandsOptions = BrunchSpecSessionPickerOptions & {
  /** Called after a runtime posture switch so chrome (footer) re-renders from re-projected state. */
  readonly requestChromeRefresh?: () => void;
};

interface BrunchStubCommand {
  readonly name: string;
  readonly description: string;
  readonly pendingMessage: string;
}

const BRUNCH_STUB_COMMANDS: readonly BrunchStubCommand[] = [
  {
    name: BRUNCH_CONTINUE_COMMAND,
    description: 'Resume the Brunch flow after an interruption (not yet implemented)',
    pendingMessage: '/brunch:continue is not wired up yet.',
  },
];

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

function applyRuntimeSwitch(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  patch: RuntimeSwitchPatch,
  requestChromeRefresh: (() => void) | undefined,
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
    activeToolNamesForBrunchAgentState(pi, projectBrunchAgentState(ctx.sessionManager.getEntries()), []),
  );
  requestChromeRefresh?.();
  ctx.ui.notify(`Brunch ${patch.axis} set to ${patch.value}.`, 'info');
}

function registerRuntimeSwitchCommands(pi: ExtensionAPI, requestChromeRefresh?: () => void): void {
  pi.registerCommand(BRUNCH_LENS_COMMAND, {
    description: `Change the active Brunch lens (${['auto', ...AGENT_LENS_IDS].join(', ')})`,
    getArgumentCompletions: (prefix) =>
      ['auto', ...AGENT_LENS_IDS]
        .filter((value) => value.startsWith(prefix))
        .map((value) => ({ value, label: value })),
    handler: async (args, ctx) => {
      const selection = normalizeAxisArg(args);
      if (!selection) {
        if (typeof ctx.ui.custom !== 'function') {
          ctx.ui.notify(lensUsage(), 'info');
          return;
        }
        const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
        const picked = await ctx.ui.custom<AgentLensSelection | undefined>(
          (_tui, theme, _keybindings, done) =>
            createRuntimeLensPickerComponent({
              current: current.agentLens,
              theme,
              onDone: done,
            }),
          {
            overlay: true,
            overlayOptions: {
              anchor: 'center',
              width: 72,
              maxHeight: '90%',
              margin: 1,
            },
          },
        );
        if (picked === undefined) return;
        if (!isLensSelection(picked)) {
          ctx.ui.notify(lensUsage(), 'error');
          return;
        }
        applyRuntimeSwitch(pi, ctx, { axis: 'lens', value: picked }, requestChromeRefresh);
        return;
      }
      if (!isLensSelection(selection)) {
        ctx.ui.notify(
          `Unknown lens "${selection}". Use one of: auto, ${AGENT_LENS_IDS.join(', ')}.`,
          'error',
        );
        return;
      }
      applyRuntimeSwitch(pi, ctx, { axis: 'lens', value: selection }, requestChromeRefresh);
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
        if (typeof ctx.ui.custom !== 'function') {
          ctx.ui.notify(strategyUsage(), 'info');
          return;
        }
        const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
        const picked = await ctx.ui.custom<AgentStrategySelection | undefined>(
          (_tui, theme, _keybindings, done) =>
            createRuntimeStrategyPickerComponent({
              current: current.agentStrategy,
              theme,
              onDone: done,
            }),
          {
            overlay: true,
            overlayOptions: {
              anchor: 'center',
              width: 96,
              maxHeight: '90%',
              margin: 1,
            },
          },
        );
        if (picked === undefined) return;
        if (!isStrategySelection(picked)) {
          ctx.ui.notify(strategyUsage(), 'error');
          return;
        }
        applyRuntimeSwitch(pi, ctx, { axis: 'strategy', value: picked }, requestChromeRefresh);
        return;
      }
      if (!isStrategySelection(selection)) {
        ctx.ui.notify(
          `Unknown strategy "${selection}". Use one of: auto, ${AGENT_STRATEGY_IDS.join(', ')}.`,
          'error',
        );
        return;
      }
      applyRuntimeSwitch(pi, ctx, { axis: 'strategy', value: selection }, requestChromeRefresh);
    },
  });

  pi.registerCommand(BRUNCH_MODE_COMMAND, {
    description: 'Report the active Brunch operational mode; explicit elicit is a no-op',
    getArgumentCompletions: (prefix) =>
      OPERATIONAL_MODE_IDS.filter((value) => value.startsWith(prefix)).map((value) => ({
        value,
        label: value,
      })),
    handler: async (args, ctx) => {
      const selection = normalizeAxisArg(args);
      const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
      if (!selection) {
        ctx.ui.notify(`Brunch mode is ${current.operationalMode}.`, 'info');
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
}

export function registerBrunchCommands(
  pi: ExtensionAPI,
  { coordinator, requestChromeRefresh }: BrunchCommandsOptions,
): void {
  pi.registerCommand(BRUNCH_SWITCH_COMMAND, {
    description: 'Open the Brunch spec/session picker',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      await runBrunchWorkspaceAction(ctx, coordinator);
    },
  });

  for (const command of BRUNCH_STUB_COMMANDS) {
    pi.registerCommand(command.name, {
      description: command.description,
      handler: async (_args, ctx: ExtensionCommandContext) => {
        ctx.ui.notify(command.pendingMessage, 'info');
      },
    });
  }

  registerRuntimeSwitchCommands(pi, requestChromeRefresh);

  pi.registerShortcut?.(BRUNCH_SWITCH_SHORTCUT, {
    description: 'Open the Brunch spec/session picker',
    handler: async (ctx) => {
      ctx.ui.notify(
        'Use /brunch:switch to switch specs or sessions; Pi shortcut contexts cannot switch sessions yet.',
        'warning',
      );
    },
  });
}
