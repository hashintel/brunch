/**
 * Session-orientation juncture orchestrator — the one flow every juncture
 * in the session-entry-orientation decision-flow chart runs when it fires:
 *
 *   dialog → entry → (origination + kick, shaped by juncture mode)
 *
 * Two juncture modes share the seam:
 *
 * - **`'follow-choice'` (J2/J3/J4/J6/J5):** dialog + entry, then live-kick only
 *   when the choice is present and is neither the menu-owned `noKickChoice`
 *   nor an inert `dismissed` (escape/timeout). Origination uses
 *   `resumeOrigin: 'manual_trigger'` (always yields a `start` decision) and
 *   `forceSeed: true` so the fresh orientation directive reaches the next
 *   provider turn even when the graph LSN has not moved.
 *
 * - **`'boot'` (option-2 J1, `session_start` reason `startup`):** dialog is
 *   best-effort — degraded mode (`hasUI: false`) skips it and the boot kick
 *   still fires; an explicit `dismissed` (escape/timeout) suppresses the boot
 *   kick entirely so the session idles inert until the user speaks.
 *   Origination uses `resumeOrigin: 'resume_debt'` so a resumed session with
 *   no unresolved debt correctly idles, and `forceSeed: true` only when a
 *   real orientation choice was recorded (continue and degraded mode respect
 *   the watermark). This is the option-2 replacement for the
 *   pre-session-binding origination call in `brunch-tui.ts`.
 *
 * Never emits present_/request_ tool results — orientation is not an
 * exchange (D37-L).
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionUIContext,
  ModelRegistry,
  SessionManager,
} from '@earendil-works/pi-coding-agent';

import type { TranscriptEntryLike } from '../../../projections/session/continuity-entry-classifier.js';
import {
  completeAssistantKick,
  originateAssistantTurn,
  type KickCompletionOutcome,
  type OriginationManager,
  type OriginationReads,
} from '../../../session/originate-assistant-turn.js';
import {
  appendPreparedContinuityEntry,
  type PreparedContinuityEntry,
} from '../../../session/prepare-next-turn.js';
import {
  type SessionOrientationChoice,
  type SessionOrientationEntrySessionManager,
  type SessionOrientationTrigger,
} from '../../../session/session-orientation.js';
import type { StartAssistantTurnDecision } from '../../../session/start-assistant-turn.js';
import {
  runAndRecordSessionOrientation,
  SESSION_ORIENTATION_MENU,
  type SessionOrientationDialogUi,
  type SessionOrientationMenuDescriptor,
} from './index.js';

export type JunctureSessionManager = SessionOrientationEntrySessionManager &
  OriginationManager & {
    getEntries(): readonly TranscriptEntryLike[];
  };

export type OrientationJunctureMode = 'follow-choice' | 'boot';

export interface RunOrientationJunctureInput {
  readonly hasUI: boolean;
  readonly ui: SessionOrientationDialogUi;
  readonly trigger: SessionOrientationTrigger;
  readonly sessionManager: JunctureSessionManager;
  /**
   * Chart mode. `'follow-choice'` (default) is J2/J3/J4/J6; `'boot'` is
   * option-2 J1. See module header for semantics.
   */
  readonly mode?: OrientationJunctureMode;
  readonly menu?: SessionOrientationMenuDescriptor;
  readonly onAppendError?: (error: unknown) => void;
  /**
   * Live-kick surface. Required when the mode may fire a kick
   * (`'follow-choice'` + a choice other than the menu-owned no-kick choice or
   * `dismissed`, or `'boot'` with anything but a dismissal). Paths that never
   * kick never dereference this, so callers that only need the dialog can
   * omit it.
   */
  readonly kick?: LiveKickDeps;
}

export interface LiveKickDeps {
  readonly specId: number;
  readonly specName?: string;
  readonly reads: OriginationReads;
  readonly workspaceContext: string;
  readonly modelAvailable: boolean;
  /** ExtensionAPI/ReplacedSessionContext-style `sendMessage` handle. */
  readonly sendCustomMessage: (
    message: LiveCustomMessage,
    options?: { readonly triggerTurn?: true },
  ) => Promise<unknown>;
  /**
   * Called with each origination decision — before the kick fires — so
   * callers can mirror it into `.brunch/debug` (D97-L) or drive kick-scoped
   * chrome (F14: `ctx.ui.setWorkingMessage(...)` from `app/brunch-tui.ts`).
   */
  readonly onOriginationDecision?: (
    decision: StartAssistantTurnDecision,
    context: { readonly modelAvailable: boolean },
  ) => Promise<void> | void;
  readonly onKickOutcome?: (
    outcome: KickCompletionOutcome,
    decision: StartAssistantTurnDecision,
  ) => Promise<void> | void;
}

export type LiveCustomMessage = {
  readonly customType: string;
  readonly content: string;
  readonly display: boolean;
  readonly details?: unknown;
};

export interface RunOrientationJunctureResult {
  readonly ran: boolean;
  readonly choice?: SessionOrientationChoice;
  readonly kickFired: boolean;
}

/**
 * Defensive dialog timeout used only in RPC mode (C1 verification, chart
 * degraded-mode row). Interactive TUI dialogs are unbounded by design: a
 * user is at the keyboard. In RPC mode the Brunch RPC client is what
 * fulfils `extension_ui_request`/`extension_ui_response`, so a client that
 * fails to answer would block the dialog forever without this guard;
 * `select` returning `undefined` on timeout resolves to the inert
 * `dismissed` per the chart's Choice schema, and the entry rule still
 * writes the resolution.
 */
export const ORIENTATION_RPC_DIALOG_TIMEOUT_MS = 60_000;

type ExtensionMode = ExtensionContext['mode'];

interface OrientationContextLike {
  readonly ui: Pick<ExtensionUIContext, 'select'>;
  readonly mode: ExtensionMode;
  readonly hasUI: boolean;
  readonly modelRegistry: Pick<ModelRegistry, 'getAvailable'>;
  /**
   * Accepts the readonly session-manager shape Pi exposes on
   * `ExtensionContext` — `sessionManagerCanAppend` narrows to the mutable
   * `JunctureSessionManager` shape at runtime before the append fires.
   */
  readonly sessionManager: unknown;
}

export type JunctureContextKick = Omit<LiveKickDeps, 'modelAvailable'>;

export interface RunJunctureForContextInput {
  readonly ctx: OrientationContextLike;
  readonly trigger: SessionOrientationTrigger;
  readonly mode: OrientationJunctureMode;
  readonly kick: JunctureContextKick | undefined;
  readonly menu?: SessionOrientationMenuDescriptor;
  readonly onAppendError: (error: unknown) => void;
}

/**
 * Adapts an extension context into a `runOrientationJuncture` invocation.
 * Shared by the registrar (J1/J2/J3/J4/J6) and the mode-switch command path
 * (J5) so both routes apply the same RPC-timeout guard, the same session-
 * manager appender guard, and the same kick surface plumbing.
 */
export async function runJunctureForContext(
  input: RunJunctureForContextInput,
): Promise<RunOrientationJunctureResult> {
  const { ctx } = input;
  if (ctx.hasUI && !hasAvailableModel(ctx)) return { ran: false, kickFired: false };

  const sessionManager = ctx.sessionManager;
  if (!sessionManagerCanAppend(sessionManager)) {
    input.onAppendError(
      new Error(
        'Session-orientation juncture requires a mutable Pi session manager with appendCustomEntry/getEntries.',
      ),
    );
    return { ran: false, kickFired: false };
  }
  const junctureUi = adaptOrientationUi(ctx);
  const kick = input.kick;
  return runOrientationJuncture({
    hasUI: ctx.hasUI,
    ui: junctureUi,
    trigger: input.trigger,
    sessionManager,
    mode: input.mode,
    ...(input.menu !== undefined ? { menu: input.menu } : {}),
    onAppendError: input.onAppendError,
    ...(kick ? { kick: { ...kick, modelAvailable: ctx.modelRegistry.getAvailable().length > 0 } } : {}),
  });
}

export function adaptOrientationUi(ctx: {
  readonly ui: Pick<ExtensionUIContext, 'select'>;
  readonly mode: ExtensionMode;
}): SessionOrientationDialogUi {
  if (ctx.mode !== 'rpc') {
    return { select: (title, options) => ctx.ui.select(title, options) };
  }
  return {
    select: (title, options) => ctx.ui.select(title, options, { timeout: ORIENTATION_RPC_DIALOG_TIMEOUT_MS }),
  };
}

/**
 * Adapt `pi.sendMessage` (fire-and-forget void return) into the promise-
 * returning `sendCustomMessage` shape `runOrientationJuncture` expects.
 * Used from command handlers (J5) where a live `AgentSession.sendCustomMessage`
 * is not directly reachable; extensions still deliver via the same underlying
 * session queue and honor `triggerTurn: true`.
 */
export function sendCustomMessageViaExtensionApi(pi: ExtensionAPI): LiveKickDeps['sendCustomMessage'] {
  return (message, options) => {
    pi.sendMessage(message, options);
    return Promise.resolve();
  };
}

function hasAvailableModel(ctx: Pick<OrientationContextLike, 'modelRegistry'>): boolean {
  return ctx.modelRegistry.getAvailable().length > 0;
}

function sessionManagerCanAppend(sessionManager: unknown): sessionManager is JunctureSessionManager {
  const candidate = sessionManager as Partial<SessionManager> | undefined;
  return typeof candidate?.appendCustomEntry === 'function' && typeof candidate.getEntries === 'function';
}

export async function runOrientationJuncture(
  input: RunOrientationJunctureInput,
): Promise<RunOrientationJunctureResult> {
  const mode = input.mode ?? 'follow-choice';
  const menu = input.menu ?? SESSION_ORIENTATION_MENU;

  const orientation = input.hasUI
    ? await runAndRecordSessionOrientation({
        hasUI: true,
        ui: input.ui,
        trigger: input.trigger,
        manager: input.sessionManager,
        menu,
        ...(input.onAppendError ? { onAppendError: input.onAppendError } : {}),
      })
    : undefined;

  const choice = orientation?.choice;
  const dialogRan = orientation !== undefined;
  const directedChoiceFailedToPersist =
    orientation !== undefined &&
    !orientation.recorded &&
    choice !== 'dismissed' &&
    choice !== menu.noKickChoice;

  if (mode === 'follow-choice') {
    if (
      !dialogRan ||
      directedChoiceFailedToPersist ||
      choice === undefined ||
      choice === 'dismissed' ||
      choice === menu.noKickChoice ||
      !input.kick
    ) {
      return { ran: dialogRan, ...(choice !== undefined ? { choice } : {}), kickFired: false };
    }
    await originateAndKick(input.sessionManager, input.kick, {
      resumeOrigin: 'manual_trigger',
      forceSeed: true,
    });
    return { ran: true, choice, kickFired: true };
  }

  // mode === 'boot': originate+kick (respecting resume-debt idle) unless the
  // user dismissed the menu — dismissal means "stay inert until I speak".
  // A fresh seed is forced only when a real orientation choice needing a kick
  // was recorded.
  if (!input.kick || directedChoiceFailedToPersist || choice === 'dismissed') {
    return { ran: dialogRan, ...(choice !== undefined ? { choice } : {}), kickFired: false };
  }
  const forceSeed = choice !== undefined && choice !== menu.noKickChoice;
  await originateAndKick(input.sessionManager, input.kick, {
    resumeOrigin: 'resume_debt',
    forceSeed,
  });
  return { ran: dialogRan, ...(choice !== undefined ? { choice } : {}), kickFired: true };
}

interface OriginateAndKickOptions {
  readonly resumeOrigin: 'manual_trigger' | 'resume_debt';
  readonly forceSeed: boolean;
}

async function originateAndKick(
  sessionManager: JunctureSessionManager,
  kick: LiveKickDeps,
  options: OriginateAndKickOptions,
): Promise<void> {
  const entries = sessionManager.getEntries();
  const origination = originateAssistantTurn({
    specId: kick.specId,
    ...(kick.specName ? { specName: kick.specName } : {}),
    reads: kick.reads,
    entries,
    resumeOrigin: options.resumeOrigin,
    workspaceContext: kick.workspaceContext,
    manager: sessionManager,
    appendSeed: false,
    ...(options.forceSeed ? { forceSeed: true } : {}),
  });

  await deliverSeedEntries(sessionManager, kick, origination.decision.seedEntries);

  if (kick.onOriginationDecision) {
    await kick.onOriginationDecision(origination.decision, { modelAvailable: kick.modelAvailable });
  }

  await completeAssistantKick({
    decision: origination.decision,
    modelAvailable: kick.modelAvailable,
    sendCustomMessage: kick.sendCustomMessage,
    onOutcome: (outcome) => {
      if (kick.onKickOutcome) void kick.onKickOutcome(outcome, origination.decision);
    },
  });
}

async function deliverSeedEntries(
  sessionManager: JunctureSessionManager,
  kick: LiveKickDeps,
  entries: readonly PreparedContinuityEntry[],
): Promise<void> {
  for (const entry of entries) {
    if (entry.type === 'custom_message') {
      await kick.sendCustomMessage({
        customType: entry.customType,
        content: entry.content,
        display: false,
        details: entry.details,
      });
      continue;
    }
    appendPreparedContinuityEntry(sessionManager, entry);
  }
}
