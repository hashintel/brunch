/**
 * Pi extension registrar wiring the session-orientation dialog to every
 * juncture in the session-entry-orientation decision-flow chart:
 *
 *  - J1 (option-2 boot): `pi.on('session_start')` reason `startup` — dialog
 *        + origination + kick, driven from inside the session-extension
 *        binding so `ctx.ui`/`hasUI` are already live (verified against
 *        Pi's `bindExtensions` order). Replaces the pre-session-binding
 *        origination call that previously lived in `brunch-tui.ts`.
 *  - J2: `pi.on('session_start')` reasons `new`/`resume` (post-switch);
 *        guarded off for `reload` (extension reload; J8 guard) and `fork`
 *        (blocked upstream by `commands/policy.ts`; J7 guard).
 *  - J3: `pi.on('session_tree')` — after tree navigation, always dialog.
 *  - J4: `pi.on('agent_end')` when the tail assistant message has
 *        `stopReason === 'aborted'` (C3 probe, `pi-ai` `StopReason`).
 *        `agent_end` extension event does NOT carry `willRetry`; compaction-
 *        overflow retries fire a fresh `agent_end` and the debounce window
 *        below covers the double-dialog case. Documented ceiling.
 *  - J6: `pi.registerCommand('brunch:consult')` — always run the dialog.
 *
 * All handlers route through `runOrientationJuncture` so the entry rule and
 * kick rule stay in one place; the registrar itself is thin wiring only.
 *
 * Gate contract: event-driven junctures (J1-J4) read both an ownership-aware
 * in-flight claim and a short resolution window before running. User-initiated
 * junctures write but do not read this gate: J5 mode switch always shows its
 * explicit menu, then claims the shared gate while its menu is in flight and
 * stamps the same resolution window. J6 still reads the window today; align it
 * in a future sync if explicit consult should match J5.
 */

import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionStartEvent,
  SessionTreeEvent,
} from '@earendil-works/pi-coding-agent';

import type { SessionOrientationTrigger } from '../../../session/session-orientation.js';
import { runJunctureForContext, type JunctureContextKick, type OrientationJunctureMode } from './juncture.js';

export interface BrunchSessionOrientationDeps {
  /**
   * Resolve the currently-bound workspace's kick surface. Returns
   * `undefined` when no workspace is bound (defensive; the extension
   * simply no-ops).
   *
   * `modelAvailable` is filled in by the registrar from
   * `ctx.modelRegistry.getAvailable().length > 0` so the caller never has to
   * close over `services` (which does not exist yet at extension-factory
   * construction time in the current TUI boot path).
   */
  readonly resolveKickContext: () =>
    | Promise<JunctureContextKick | undefined>
    | JunctureContextKick
    | undefined;
}

// ceiling: one shared 750ms wall-clock resolution window plus one in-flight
// ownership claim. Upgrade to a per-session juncture state machine now that the
// trigger set has grown to six and policy differs by user/event source.
const JUNCTURE_DEBOUNCE_MS = 750;

/**
 * Mutable coordination state shared between the registrar junctures and the
 * mode-switch command path (J5). Keyed off the deps object identity via
 * `orientationJunctureGate` so both registration sites — which receive the
 * same `BrunchSessionOrientationDeps` from the composition root — coordinate
 * without new wiring.
 */
export interface OrientationJunctureGate {
  lastResolvedAt: number;
  activeClaim: symbol | undefined;
  /**
   * One-shot flag set by a flow that programmatically aborts an in-flight
   * assistant turn (J5 mode switch): the resulting `agent_end` with
   * stopReason `aborted` must not open the J4 esc-abort dialog on top of the
   * flow's own menu. Consumed (cleared) by the J4 handler.
   */
  suppressNextAbortJuncture: boolean;
}

const gates = new WeakMap<BrunchSessionOrientationDeps, OrientationJunctureGate>();

export function orientationJunctureGate(deps: BrunchSessionOrientationDeps): OrientationJunctureGate {
  let gate = gates.get(deps);
  if (!gate) {
    gate = { lastResolvedAt: 0, activeClaim: undefined, suppressNextAbortJuncture: false };
    gates.set(deps, gate);
  }
  return gate;
}

export const BRUNCH_CONSULT_COMMAND = 'brunch:consult';

export function claimOrientationJuncture(gate: OrientationJunctureGate): symbol | undefined {
  if (gate.activeClaim !== undefined) return undefined;
  return forceClaimOrientationJuncture(gate);
}

export function forceClaimOrientationJuncture(gate: OrientationJunctureGate): symbol {
  const claim = Symbol('orientation-juncture-claim');
  gate.activeClaim = claim;
  return claim;
}

export function releaseOrientationJuncture(
  gate: OrientationJunctureGate,
  claim: symbol,
  result?: { readonly ran: boolean; readonly kickFired: boolean },
): void {
  if (gate.activeClaim !== claim) return;
  gate.activeClaim = undefined;
  if (result?.ran || result?.kickFired) gate.lastResolvedAt = Date.now();
}

export function registerBrunchSessionOrientation(pi: ExtensionAPI, deps: BrunchSessionOrientationDeps): void {
  const debounce = orientationJunctureGate(deps);

  pi.on('session_start', async (event: SessionStartEvent, ctx: ExtensionContext) => {
    if (event.reason === 'startup') {
      // J1 (option-2): dialog + origination + kick. Fires from inside the
      // session-extension binding so ctx.ui is live even in TUI mode.
      await runJuncture(ctx, deps, debounce, {
        trigger: 'entry',
        mode: 'boot',
      });
      return;
    }
    if (event.reason !== 'new' && event.reason !== 'resume') return;
    // J2: post-switch. Dialog + non-continue → live-kick.
    await runJuncture(ctx, deps, debounce, {
      trigger: 'switch',
      mode: 'follow-choice',
    });
  });

  pi.on('session_tree', async (_event: SessionTreeEvent, ctx: ExtensionContext) => {
    await runJuncture(ctx, deps, debounce, {
      trigger: 'tree',
      mode: 'follow-choice',
    });
  });

  pi.on('agent_end', async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (!isEscAbortedAgentEnd(event)) return;
    if (debounce.suppressNextAbortJuncture) {
      // A product flow (J5 mode switch) aborted this turn itself and owns the
      // next dialog; consuming the flag keeps J4 out of its way.
      debounce.suppressNextAbortJuncture = false;
      return;
    }
    await runJuncture(ctx, deps, debounce, {
      trigger: 'abort',
      mode: 'follow-choice',
    });
  });

  pi.registerCommand(BRUNCH_CONSULT_COMMAND, {
    description: 'Consult the session-orientation menu at will',
    handler: async (_args, ctx) => {
      await runJuncture(ctx, deps, debounce, {
        trigger: 'consult',
        mode: 'follow-choice',
      });
    },
  });
}

interface JunctureInvocation {
  readonly trigger: SessionOrientationTrigger;
  readonly mode: OrientationJunctureMode;
}

async function runJuncture(
  ctx: ExtensionContext,
  deps: BrunchSessionOrientationDeps,
  debounce: OrientationJunctureGate,
  invocation: JunctureInvocation,
): Promise<void> {
  const now = Date.now();
  if (debounce.activeClaim !== undefined || now - debounce.lastResolvedAt < JUNCTURE_DEBOUNCE_MS) return;
  const claim = claimOrientationJuncture(debounce);
  if (claim === undefined) return;

  let result: { readonly ran: boolean; readonly kickFired: boolean } | undefined;
  try {
    const kickContext = await deps.resolveKickContext();
    result = await runJunctureForContext({
      ctx,
      trigger: invocation.trigger,
      mode: invocation.mode,
      kick: kickContext,
      onAppendError: (error) => {
        ctx.ui.notify(
          `Session-orientation entry could not be recorded: ${formatErrorMessage(error)}`,
          'warning',
        );
      },
    });
  } finally {
    releaseOrientationJuncture(debounce, claim, result);
  }
}

interface AssistantLikeMessage {
  readonly role?: unknown;
  readonly stopReason?: unknown;
}

function formatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isEscAbortedAgentEnd(event: AgentEndEvent): boolean {
  const tail = tailAssistantMessage(event.messages);
  return tail?.stopReason === 'aborted';
}

function tailAssistantMessage(messages: readonly unknown[]): AssistantLikeMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as AssistantLikeMessage | undefined;
    if (message?.role === 'assistant') return message;
  }
  return undefined;
}
