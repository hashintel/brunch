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
import {
  runOrientationJuncture,
  type JunctureSessionManager,
  type LiveKickDeps,
  type OrientationJunctureMode,
} from './juncture.js';

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
  readonly onOriginationDecision?: LiveKickDeps['onOriginationDecision'];
  readonly onKickOutcome?: LiveKickDeps['onKickOutcome'];
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
    if (event.reason === 'startup') {
      // J1 (option-2): dialog + origination + kick. Fires from inside the
      // session-extension binding so ctx.ui is live even in TUI mode.
      await runJuncture(pi, ctx, deps, debounce, {
        trigger: 'entry',
        mode: 'boot',
      });
      return;
    }
    if (event.reason !== 'new' && event.reason !== 'resume') return;
    // J2: post-switch. Dialog + non-continue → live-kick.
    await runJuncture(pi, ctx, deps, debounce, {
      trigger: 'switch',
      mode: 'follow-choice',
    });
  });

  pi.on('session_tree', async (_event: SessionTreeEvent, ctx: ExtensionContext) => {
    await runJuncture(pi, ctx, deps, debounce, {
      trigger: 'tree',
      mode: 'follow-choice',
    });
  });

  pi.on('agent_end', async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (!isEscAbortedAgentEnd(event)) return;
    await runJuncture(pi, ctx, deps, debounce, {
      trigger: 'abort',
      mode: 'follow-choice',
    });
  });

  pi.registerCommand(BRUNCH_CONSULT_COMMAND, {
    description: 'Consult the session-orientation menu at will',
    handler: async (_args, ctx) => {
      await runJuncture(pi, ctx, deps, debounce, {
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

  const kickContext = await deps.resolveKickContext();

  const result = await runOrientationJuncture({
    hasUI: ctx.hasUI,
    ui: { select: (title, options) => ctx.ui.select(title, options) },
    trigger: invocation.trigger,
    sessionManager,
    mode: invocation.mode,
    ...(kickContext
      ? {
          kick: {
            specId: kickContext.specId,
            ...(kickContext.specName ? { specName: kickContext.specName } : {}),
            reads: kickContext.reads,
            workspaceContext: kickContext.workspaceContext,
            modelAvailable: ctx.modelRegistry.getAvailable().length > 0,
            sendCustomMessage: kickContext.sendCustomMessage,
            ...(kickContext.onOriginationDecision
              ? { onOriginationDecision: kickContext.onOriginationDecision }
              : {}),
            ...(kickContext.onKickOutcome ? { onKickOutcome: kickContext.onKickOutcome } : {}),
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
