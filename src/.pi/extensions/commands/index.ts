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
 *
 * Stubbed for later (notify-only):
 *  - `/brunch:continue` — recover/restart from an interrupted `request_*` tool
 *                         or other interruption. Needs to: (a) optionally add a
 *                         system-prompt hint that bare "continue" resumes the
 *                         brunch flow, and (b) install listeners on user cancel
 *                         actions that surface a `setStatus` reminder.
 *  - `/brunch:lens`     — change agent lens.
 *  - `/brunch:strategy` — change agent strategy.
 *  - `/brunch:mode`     — change agent mode.
 */

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

import { type BrunchSpecSessionPickerOptions, runBrunchWorkspaceAction } from '../workspace/index.js';

export const BRUNCH_COMMAND_PREFIX = 'brunch:';
export const BRUNCH_SWITCH_COMMAND = 'brunch:switch';
export const BRUNCH_CONTINUE_COMMAND = 'brunch:continue';
export const BRUNCH_LENS_COMMAND = 'brunch:lens';
export const BRUNCH_STRATEGY_COMMAND = 'brunch:strategy';
export const BRUNCH_MODE_COMMAND = 'brunch:mode';

export const BRUNCH_SWITCH_SHORTCUT = 'ctrl+shift+b';

export type BrunchCommandsOptions = BrunchSpecSessionPickerOptions;

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
  {
    name: BRUNCH_LENS_COMMAND,
    description: 'Change the active agent lens (not yet implemented)',
    pendingMessage: '/brunch:lens is not wired up yet.',
  },
  {
    name: BRUNCH_STRATEGY_COMMAND,
    description: 'Change the active agent strategy (not yet implemented)',
    pendingMessage: '/brunch:strategy is not wired up yet.',
  },
  {
    name: BRUNCH_MODE_COMMAND,
    description: 'Change the active agent mode (not yet implemented)',
    pendingMessage: '/brunch:mode is not wired up yet.',
  },
];

export function registerBrunchCommands(pi: ExtensionAPI, { coordinator }: BrunchCommandsOptions): void {
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

export default registerBrunchCommands;
