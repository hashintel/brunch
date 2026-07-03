/**
 * Pi extension registrar wiring the session-orientation dialog to every
 * mid-session juncture in the session-entry-orientation decision-flow chart:
 *
 *  - J2: `pi.on('session_start')` for reasons `new`/`resume` (post-switch);
 *        guarded off for reasons `startup` (option-2 J1 boot wiring lives in
 *        the launch path, not this registrar — deferred slice), `reload`
 *        (extension reload; J8 guard), and `fork` (blocked upstream by
 *        `commands/policy.ts`; J7 guard).
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
 * Debounce: coinciding junctures (esc-abort immediately followed by a tree
 * jump, or double-fire from a compaction-retry `agent_end`) collapse to a
 * single dialog by suppressing any juncture whose event falls inside a
 * short window after the last resolution. The window is a `ceiling:` —
 * upgrade to a proper per-session state machine if the trigger set grows
 * past the current five.
 */

import type {
  AgentEndEvent,
  ExtensionAPI,
  ExtensionContext,
  SessionManager,
  SessionStartEvent,
  SessionTreeEvent,
} from '@earendil-works/pi-coding-agent';

import type { OriginationReads } from '../../../session/originate-assistant-turn.js';
import type { SessionOrientationTrigger } from '../../../session/session-orientation.js';
import { runOrientationJuncture, type JunctureSessionManager, type LiveKickDeps } from './juncture.js';

export interface BrunchSessionOrientationDeps {
  /**
   * Resolve the currently-bound workspace's kick surface. Returns
   * `undefined` when no workspace is bound (defensive; the extension
   * simply no-ops).
   */
  readonly resolveKickContext: () => Promise<KickContext | undefined> | KickContext | undefined;
}

/**
 * Kick surface resolved per-invocation. `modelAvailable` is filled in by the
 * registrar from `ctx.modelRegistry.getAvailable().length > 0` so the
 * caller never has to close over `services` (which does not exist yet at
 * extension-factory construction time in the current TUI boot path).
 */
export interface KickContext {
  readonly specId: number;
  readonly specName?: string;
  readonly reads: OriginationReads;
  readonly workspaceContext: string;
  readonly sendCustomMessage: LiveKickDeps['sendCustomMessage'];
}

// ceiling: 750ms wall-clock debounce for coinciding junctures. Upgrade to a
// per-session juncture state machine if we grow past 5 triggers or need
// juncture-specific debounce policies.
const JUNCTURE_DEBOUNCE_MS = 750;

interface DebounceState {
  lastResolvedAt: number;
}

export const BRUNCH_CONSULT_COMMAND = 'brunch:consult';

export function registerBrunchSessionOrientation(pi: ExtensionAPI, deps: BrunchSessionOrientationDeps): void {
  const debounce: DebounceState = { lastResolvedAt: 0 };

  pi.on('session_start', async (event: SessionStartEvent, ctx: ExtensionContext) => {
    if (event.reason !== 'new' && event.reason !== 'resume') return;
    // J2: launch-path may or may not re-originate on session switch. The
    // dialog runs unconditionally; a fresh choice is folded into whatever
    // origination path is active next, and only fires a live kick if none
    // is pending (carriesPendingKick=false).
    await runJuncture(pi, ctx, deps, debounce, {
      trigger: 'switch',
      carriesPendingKick: false,
    });
  });

  pi.on('session_tree', async (_event: SessionTreeEvent, ctx: ExtensionContext) => {
    await runJuncture(pi, ctx, deps, debounce, {
      trigger: 'tree',
      carriesPendingKick: false,
    });
  });

  pi.on('agent_end', async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (!isEscAbortedAgentEnd(event)) return;
    await runJuncture(pi, ctx, deps, debounce, {
      trigger: 'abort',
      carriesPendingKick: false,
    });
  });

  pi.registerCommand(BRUNCH_CONSULT_COMMAND, {
    description: 'Consult the session-orientation menu at will',
    handler: async (_args, ctx) => {
      await runJuncture(pi, ctx, deps, debounce, {
        trigger: 'consult',
        carriesPendingKick: false,
      });
    },
  });
}

interface JunctureInvocation {
  readonly trigger: SessionOrientationTrigger;
  readonly carriesPendingKick: boolean;
}

async function runJuncture(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  deps: BrunchSessionOrientationDeps,
  debounce: DebounceState,
  invocation: JunctureInvocation,
): Promise<void> {
  const now = Date.now();
  if (now - debounce.lastResolvedAt < JUNCTURE_DEBOUNCE_MS) return;

  const sessionManager = ctx.sessionManager as unknown as JunctureSessionManager;
  if (!sessionManagerCanAppend(sessionManager)) return;

  const kickContext = invocation.carriesPendingKick ? undefined : await deps.resolveKickContext();

  const result = await runOrientationJuncture({
    hasUI: ctx.hasUI,
    ui: { select: (title, options) => ctx.ui.select(title, options) },
    trigger: invocation.trigger,
    sessionManager,
    carriesPendingKick: invocation.carriesPendingKick,
    ...(kickContext
      ? {
          kick: {
            specId: kickContext.specId,
            ...(kickContext.specName ? { specName: kickContext.specName } : {}),
            reads: kickContext.reads,
            workspaceContext: kickContext.workspaceContext,
            modelAvailable: ctx.modelRegistry.getAvailable().length > 0,
            sendCustomMessage: kickContext.sendCustomMessage,
          },
        }
      : {}),
  });

  // Reference retained for future outcome telemetry / debug-cache mirror.
  void pi;
  if (result.ran) debounce.lastResolvedAt = Date.now();
}

interface AssistantLikeMessage {
  readonly role?: unknown;
  readonly stopReason?: unknown;
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

function sessionManagerCanAppend(sessionManager: unknown): sessionManager is JunctureSessionManager {
  const candidate = sessionManager as Partial<SessionManager> | undefined;
  return typeof candidate?.appendCustomEntry === 'function' && typeof candidate.getEntries === 'function';
}
