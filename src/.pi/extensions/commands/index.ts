/** @file commands.ts
 *
 * Registers Brunch's namespaced `/brunch:*` slash commands.
 *
 * Pi parses slash command names as everything between the leading `/` and the
 * first whitespace (see `_tryExecuteExtensionCommand` in
 * `@earendil-works/pi-coding-agent/dist/core/agent-session.js`). Colons in
 * command names are passed through verbatim, so registering a command with the
 * literal name `brunch:menu` makes it invocable as `/brunch:menu`. This is
 * the same trick the built-in `/skill:<name>` registry uses.
 *
 * Active commands:
 *  - `/brunch:menu`     — open the spec/session picker (delegates to
 *                         workspace-dialog.ts).
 *  - `/brunch:continue` — recover/restart from an interrupted structured
 *                         exchange continuation.
 *  - `/brunch:mode`     — change the transcript-backed operational mode.
 *
 * Keyboard shortcuts (match the bracketed key hints in the footer chrome):
 *  - `ctrl+shift+b` — spec/session picker (borrows a command-capable context
 *                     from the composition root for the actual session switch;
 *                     alt+b is reserved by Pi's editor for cursorWordLeft)
 *  - `alt+m` — mode picker
 *
 * The ask collector owns cancellation status hints that point back to
 * `/brunch:continue`.
 */

import type { ExtensionAPI, ExtensionCommandContext } from '@earendil-works/pi-coding-agent';

import { findIncompleteStructuredExchangePresents, type EntryLike } from '../../../exchanges/recovery.js';
import type { KickCompletionOutcome } from '../../../session/originate-assistant-turn.js';
import { appendBrunchAgentRuntimeSwitch } from '../../../session/runtime-state.js';
import {
  OPERATIONAL_MODE_IDS,
  operationalModeLabel,
  type OperationalModeId,
} from '../../../session/schema/kinds.js';
import {
  syntheticExchangeToolCallMessage,
  syntheticExchangeToolResultMessage,
} from '../../../session/structured-exchange-loop.js';
import { BRUNCH_MENU_SHORTCUT, BRUNCH_MODE_PICKER_SHORTCUT } from '../../components/chrome-shortcuts.js';
import { createRuntimeModePickerComponent } from '../../components/runtime-posture/axis-picker.js';
import {
  activeToolNamesForBrunchAgentState,
  projectBrunchAgentState,
} from '../agent-runtime/runtime/index.js';
import { ASK_TOOL, collectAskContinuationResponse } from '../exchanges/ask.js';
import type { StructuredExchangeUiContext } from '../exchanges/shared/ui-context.js';
import {
  CODE_SESSION_ORIENTATION_MENU,
  SESSION_ORIENTATION_MENU,
  type SessionOrientationMenuDescriptor,
} from '../session-orientation/index.js';
import {
  runJunctureForContext,
  runManualTriggerKickForContext,
  sendCustomMessageViaExtensionApi,
} from '../session-orientation/juncture.js';
import {
  forceClaimOrientationJuncture,
  orientationJunctureGate,
  releaseOrientationJuncture,
  type BrunchSessionOrientationDeps,
} from '../session-orientation/registrar.js';
import {
  runBrunchWorkspaceAction,
  type BrunchSpecSessionPickerOptions,
  type BrunchWorkspaceActionContext,
} from '../workspace/index.js';
import {
  BRUNCH_CONSULT_COMMAND,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_MENU_COMMAND,
  BRUNCH_MODE_COMMAND,
  slashCommand,
} from './names.js';

export {
  BRUNCH_COMMAND_PREFIX,
  BRUNCH_CONSULT_COMMAND,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_MENU_COMMAND,
  BRUNCH_MODE_COMMAND,
} from './names.js';

export { BRUNCH_MENU_SHORTCUT, BRUNCH_MODE_PICKER_SHORTCUT } from '../../components/chrome-shortcuts.js';

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
   * J5 mode-switch orientation dep. When present, a mode switch first settles
   * any in-flight assistant turn (abort + wait for idle, with the J4
   * esc-abort juncture suppressed via the shared gate), then fires the target
   * mode's menu. The menu owns which selected choice suppresses a kick
   * (Specify uses `continue`; Execute has none); escape/timeout always
   * resolves to the inert `dismissed` and never kicks. Degraded no-UI
   * switches stay silent.
   */
  readonly sessionOrientation?: BrunchSessionOrientationDeps;
};

interface RuntimeSwitchContext {
  readonly ui: Pick<ExtensionCommandContext['ui'], 'notify' | 'custom' | 'select'>;
  readonly sessionManager: ExtensionCommandContext['sessionManager'];
  readonly mode: ExtensionCommandContext['mode'];
  readonly hasUI: ExtensionCommandContext['hasUI'];
  readonly modelRegistry: ExtensionCommandContext['modelRegistry'];
  /**
   * Turn-control surface for settling an in-flight assistant turn before the
   * mode-switch orientation menu shows.
   */
  readonly isIdle?: ExtensionCommandContext['isIdle'];
  readonly abort?: ExtensionCommandContext['abort'];
  readonly waitForIdle?: ExtensionCommandContext['waitForIdle'];
}

type ContinueCommandContext = ExtensionCommandContext & {
  readonly sessionManager: ExtensionCommandContext['sessionManager'] & {
    readonly getBranch?: () => readonly EntryLike[];
    readonly appendMessage?: (message: unknown) => unknown;
  };
};

function normalizeAxisArg(args: string): string {
  return args.trim().split(/\s+/)[0] ?? '';
}

function formatOperationalModeChoices(): string {
  return OPERATIONAL_MODE_IDS.map((mode) => `${mode} (${operationalModeLabel(mode)})`).join(', ');
}

type ModeSwitchOptions = Pick<
  BrunchCommandsOptions,
  'requestChromeRefresh' | 'sessionOrientation' | 'getCommandContext'
>;

const MODE_SWITCH_ORIENTATION_MENUS = {
  specify: SESSION_ORIENTATION_MENU,
  execute: CODE_SESSION_ORIENTATION_MENU,
} as const satisfies Record<OperationalModeId, SessionOrientationMenuDescriptor>;

async function openModePicker(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  options: ModeSwitchOptions,
): Promise<void> {
  const current = projectBrunchAgentState(ctx.sessionManager.getEntries());
  // hasUI first: since pi 0.80.x, headless/no-op UI contexts carry stub
  // `custom` functions that resolve undefined, so shape alone can't gate.
  if (!ctx.hasUI || typeof ctx.ui.custom !== 'function') {
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
  await applyModeSwitchAndOrient(pi, ctx, picked, options);
}

async function applyModeSwitchAndOrient(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  nextMode: OperationalModeId,
  options: ModeSwitchOptions,
): Promise<void> {
  if (options.sessionOrientation) {
    // A turn composed under the old mode's prompt is conceptually stale the
    // moment the user switches, and its streaming/exchange UI would displace
    // the orientation menu (J5 race). Abort it and wait for idle before
    // touching runtime state or showing the menu.
    await settleInFlightTurn(ctx, options.sessionOrientation);
  }
  applyModeSwitch(pi, ctx, nextMode, options);
  if (!options.sessionOrientation) return;
  await runModeSwitchOrientation(
    pi,
    ctx,
    options.sessionOrientation,
    MODE_SWITCH_ORIENTATION_MENUS[nextMode],
  );
}

async function settleInFlightTurn(
  ctx: RuntimeSwitchContext,
  orientationDeps: BrunchSessionOrientationDeps,
): Promise<void> {
  if (
    typeof ctx.isIdle !== 'function' ||
    typeof ctx.abort !== 'function' ||
    typeof ctx.waitForIdle !== 'function'
  ) {
    return;
  }
  if (ctx.isIdle()) return;
  const gate = orientationJunctureGate(orientationDeps);
  // The abort below lands as an agent_end with stopReason 'aborted'; without
  // this flag the J4 esc-abort dialog would fire on top of the J5 menu. The
  // registrar consumes it when that exact event is observed; when waitForIdle
  // is unavailable we skip the abort path rather than guessing event order.
  gate.suppressNextAbortJuncture = true;
  ctx.abort();
  await ctx.waitForIdle();
}

async function runModeSwitchOrientation(
  pi: ExtensionAPI,
  ctx: RuntimeSwitchContext,
  deps: BrunchSessionOrientationDeps,
  menu: SessionOrientationMenuDescriptor,
): Promise<void> {
  const gate = orientationJunctureGate(deps);
  const claim = forceClaimOrientationJuncture(gate);
  let result: { readonly ran: boolean; readonly kickFired: boolean } | undefined;
  try {
    const kickContext = await deps.resolveKickContext();
    result = await runJunctureForContext({
      ctx: {
        mode: ctx.mode,
        hasUI: ctx.hasUI,
        modelRegistry: ctx.modelRegistry,
        sessionManager: ctx.sessionManager,
        ui: ctx.ui,
      },
      trigger: 'mode-switch',
      mode: 'follow-choice',
      menu,
      kick: kickContext
        ? { ...kickContext, sendCustomMessage: sendCustomMessageViaExtensionApi(pi) }
        : undefined,
      onAppendError: (error) => {
        ctx.ui.notify(
          `Session-orientation entry could not be recorded: ${formatErrorMessage(error)}`,
          'warning',
        );
      },
    });
  } finally {
    releaseOrientationJuncture(gate, claim, result);
  }
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatContinueOutcome(outcome: KickCompletionOutcome | undefined): {
  readonly message: string;
  readonly level: 'info' | 'warning';
} {
  if (outcome?.status === 'failed') {
    return {
      message: `Brunch resume could not complete: ${formatErrorMessage(outcome.error)}`,
      level: 'warning',
    };
  }
  if (outcome?.status === 'skipped' && outcome.reason === 'no_model_available') {
    return {
      message:
        'No provider auth is available, so Brunch did not start an assistant turn. Run /login, then try /brunch:continue again.',
      level: 'info',
    };
  }
  return {
    message: `Nothing to resume. Try ${slashCommand(BRUNCH_CONSULT_COMMAND)} or ${slashCommand(BRUNCH_MODE_COMMAND)}.`,
    level: 'info',
  };
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

function registerRuntimeSwitchCommands(pi: ExtensionAPI, options: ModeSwitchOptions): void {
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
      await applyModeSwitchAndOrient(pi, ctx, selection as OperationalModeId, options);
    },
  });

  pi.registerShortcut?.(BRUNCH_MODE_PICKER_SHORTCUT, {
    description: 'Open the Brunch mode picker',
    handler: async (ctx) => {
      const commandCtx = options.getCommandContext?.() ?? ctx;
      await openModePicker(pi, commandCtx, options);
    },
  });
}

function menuForCurrentOperationalMode(ctx: {
  readonly sessionManager: RuntimeSwitchContext['sessionManager'];
}): SessionOrientationMenuDescriptor {
  const state = projectBrunchAgentState(ctx.sessionManager.getEntries());
  return state.operationalMode === 'execute' ? CODE_SESSION_ORIENTATION_MENU : SESSION_ORIENTATION_MENU;
}

function registerConsultCommand(
  pi: ExtensionAPI,
  options: Pick<BrunchCommandsOptions, 'sessionOrientation'>,
): void {
  pi.registerCommand(BRUNCH_CONSULT_COMMAND, {
    description: 'Consult the Brunch session-orientation menu',
    handler: async (_args, ctx) => {
      if (!options.sessionOrientation) {
        ctx.ui.notify('Brunch consult is unavailable in this session.', 'warning');
        return;
      }
      const gate = orientationJunctureGate(options.sessionOrientation);
      const claim = forceClaimOrientationJuncture(gate);
      let result: { readonly ran: boolean; readonly kickFired: boolean } | undefined;
      try {
        const kickContext = await options.sessionOrientation.resolveKickContext();
        result = await runJunctureForContext({
          ctx,
          trigger: 'consult',
          mode: 'follow-choice',
          menu: menuForCurrentOperationalMode(ctx),
          kick: kickContext
            ? { ...kickContext, sendCustomMessage: sendCustomMessageViaExtensionApi(pi) }
            : undefined,
          onAppendError: (error) => {
            ctx.ui.notify(
              `Session-orientation entry could not be recorded: ${formatErrorMessage(error)}`,
              'warning',
            );
          },
        });
      } finally {
        releaseOrientationJuncture(gate, claim, result);
      }
    },
  });
}

function currentBranchEntries(ctx: ContinueCommandContext): readonly EntryLike[] {
  return ctx.sessionManager.getBranch?.() ?? (ctx.sessionManager.getEntries() as readonly EntryLike[]);
}

function latestDeclaredAskContinuation(ctx: ContinueCommandContext) {
  return findIncompleteStructuredExchangePresents(currentBranchEntries(ctx))
    .filter((present) => {
      const continuation = 'continuation' in present.details ? present.details.continuation : undefined;
      return present.continuationTool === ASK_TOOL && continuation?.tool === ASK_TOOL;
    })
    .at(-1);
}

function appendRecoveredAskResult(
  ctx: ContinueCommandContext,
  exchangeId: string,
  result: Awaited<ReturnType<typeof collectAskContinuationResponse>>,
): boolean {
  if (typeof ctx.sessionManager.appendMessage !== 'function') return false;
  const toolCallMessage = syntheticExchangeToolCallMessage(exchangeId, ASK_TOOL, { continues: exchangeId });
  ctx.sessionManager.appendMessage(toolCallMessage);
  ctx.sessionManager.appendMessage(
    syntheticExchangeToolResultMessage(exchangeId, ASK_TOOL, result.content, result.details),
  );
  return true;
}

function registerContinueCommand(
  pi: ExtensionAPI,
  options: Pick<BrunchCommandsOptions, 'sessionOrientation'>,
): void {
  pi.registerCommand(BRUNCH_CONTINUE_COMMAND, {
    description: 'Resume interrupted Brunch work',
    handler: async (_args, ctx) => {
      const commandCtx = ctx as ContinueCommandContext;
      const pending = latestDeclaredAskContinuation(commandCtx);
      if (!pending) {
        await runGeneralContinue(pi, commandCtx, options);
        return;
      }
      const exchangeId = pending.details.exchange_id;
      const askCtx: StructuredExchangeUiContext = {
        hasUI: commandCtx.hasUI,
        ui: commandCtx.ui as unknown as NonNullable<StructuredExchangeUiContext['ui']>,
        sessionManager: { getBranch: () => currentBranchEntries(commandCtx) },
      };
      // The continuation collector owns the brunch.continue hint lifecycle:
      // it re-surfaces the hint on cancel and clears it on an answered result.
      const result = await collectAskContinuationResponse(exchangeId, askCtx);
      if (!appendRecoveredAskResult(commandCtx, exchangeId, result)) {
        ctx.ui.notify('Brunch continue could not record the recovered answer in this session.', 'warning');
      }
    },
  });
}

async function runGeneralContinue(
  pi: ExtensionAPI,
  ctx: ContinueCommandContext,
  options: Pick<BrunchCommandsOptions, 'sessionOrientation'>,
): Promise<void> {
  if (!options.sessionOrientation) {
    ctx.ui.notify('Brunch resume is unavailable in this session.', 'warning');
    return;
  }
  const kickContext = await options.sessionOrientation.resolveKickContext();
  const result = await runManualTriggerKickForContext({
    ctx,
    kick: kickContext
      ? { ...kickContext, sendCustomMessage: sendCustomMessageViaExtensionApi(pi) }
      : undefined,
    onAppendError: (error) => {
      ctx.ui.notify(`Brunch resume could not start: ${formatErrorMessage(error)}`, 'warning');
    },
  });
  if (!result.kickFired) {
    const notice = formatContinueOutcome(result.kickOutcome);
    ctx.ui.notify(notice.message, notice.level);
  }
}

function workspaceActionOptions(
  options: Pick<BrunchCommandsOptions, 'productUpdates'>,
): Parameters<typeof runBrunchWorkspaceAction>[2] {
  return options.productUpdates ? { productUpdates: options.productUpdates } : {};
}

export function registerBrunchCommands(pi: ExtensionAPI, options: BrunchCommandsOptions): void {
  const { coordinator } = options;
  pi.registerCommand(BRUNCH_MENU_COMMAND, {
    description: 'Open the Brunch spec/session picker',
    handler: async (_args, ctx: ExtensionCommandContext) => {
      await runBrunchWorkspaceAction(ctx, coordinator, workspaceActionOptions(options));
    },
  });

  registerRuntimeSwitchCommands(pi, options);
  registerConsultCommand(pi, options);
  registerContinueCommand(pi, options);

  // Pi shortcut contexts lack switchSession/waitForIdle, so borrow a
  // command-capable context from the composition root when available.
  // The fallback shortcut context still opens the picker; an actual
  // cross-session switch then degrades to a warning (see
  // switchToActivatedWorkspace).
  const openMenuPicker = async (ctx: BrunchWorkspaceActionContext) => {
    const commandContext = options.getCommandContext?.();
    await runBrunchWorkspaceAction(commandContext ?? ctx, coordinator, workspaceActionOptions(options));
  };
  pi.registerShortcut?.(BRUNCH_MENU_SHORTCUT, {
    description: 'Open the Brunch spec/session picker',
    handler: openMenuPicker,
  });
}
