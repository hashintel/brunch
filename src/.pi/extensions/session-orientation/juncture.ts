/**
 * Session-orientation juncture orchestrator — the one flow every juncture
 * in the session-entry-orientation decision-flow chart runs when it fires:
 *
 *   dialog → entry → (origination + kick, shaped by juncture mode)
 *
 * Two juncture modes share the seam:
 *
 * - **`'follow-choice'` (J2/J3/J4/J6):** dialog + entry, then live-kick only
 *   when the choice is neither `continue` nor missing. Origination uses
 *   `resumeOrigin: 'manual_trigger'` (always yields a `start` decision) and
 *   `forceSeed: true` so the fresh orientation directive reaches the next
 *   provider turn even when the graph LSN has not moved.
 *
 * - **`'boot'` (option-2 J1, `session_start` reason `startup`):** dialog is
 *   best-effort — degraded mode (`hasUI: false`) skips it but the boot kick
 *   still fires; origination uses `resumeOrigin: 'resume_debt'` so a resumed
 *   session with no unresolved debt correctly idles, and `forceSeed: true`
 *   only when a real orientation choice was recorded (escape/continue and
 *   degraded mode respect the watermark). This is the option-2 replacement
 *   for the pre-session-binding origination call in `brunch-tui.ts`.
 *
 * Never emits present_/request_ tool results — orientation is not an
 * exchange (D37-L).
 */

import type { TranscriptEntryLike } from '../../../projections/session/continuity-entry-classifier.js';
import {
  BRUNCH_KICK_CUSTOM_TYPE,
  completeAssistantKick,
  kickTurnMessage,
  originateAssistantTurn,
  type KickCompletionOutcome,
  type OriginationManager,
  type OriginationReads,
} from '../../../session/originate-assistant-turn.js';
import {
  freshSessionOrientationChoice,
  type SessionOrientationChoice,
  type SessionOrientationEntrySessionManager,
  type SessionOrientationTrigger,
} from '../../../session/session-orientation.js';
import type { StartAssistantTurnDecision } from '../../../session/start-assistant-turn.js';
import { runAndRecordSessionOrientation, type SessionOrientationDialogUi } from './index.js';

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
  readonly title?: string;
  readonly onAppendError?: (error: unknown) => void;
  /**
   * Live-kick surface. Required when the mode may fire a kick
   * (`'follow-choice'` + non-continue choice, or `'boot'` unconditionally).
   * `'follow-choice'` with a `continue`/undefined choice never dereferences
   * this, so callers that only need the dialog can omit it.
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
    message: ReturnType<typeof kickTurnMessage>,
    options: { readonly triggerTurn: true },
  ) => Promise<unknown>;
  /**
   * Called with each origination decision — before the kick fires — so
   * callers can mirror it into `.brunch/debug` (D97-L) or drive kick-status
   * chrome (`setStatus(BRUNCH_KICK_ACTIVITY_STATUS_KEY, ...)`).
   */
  readonly onOriginationDecision?: (decision: StartAssistantTurnDecision) => Promise<void> | void;
  readonly onKickOutcome?: (
    outcome: KickCompletionOutcome,
    decision: StartAssistantTurnDecision,
  ) => Promise<void> | void;
}

export interface RunOrientationJunctureResult {
  readonly ran: boolean;
  readonly choice?: SessionOrientationChoice;
  readonly kickFired: boolean;
}

export async function runOrientationJuncture(
  input: RunOrientationJunctureInput,
): Promise<RunOrientationJunctureResult> {
  const mode = input.mode ?? 'follow-choice';

  const choice = input.hasUI
    ? await runAndRecordSessionOrientation({
        hasUI: true,
        ui: input.ui,
        trigger: input.trigger,
        manager: input.sessionManager,
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.onAppendError ? { onAppendError: input.onAppendError } : {}),
      })
    : undefined;

  const dialogRan = choice !== undefined;

  if (mode === 'follow-choice') {
    if (!dialogRan || choice === 'continue' || !input.kick) {
      return { ran: dialogRan, ...(choice !== undefined ? { choice } : {}), kickFired: false };
    }
    await originateAndKick(input.sessionManager, input.kick, {
      resumeOrigin: 'manual_trigger',
      forceSeed: true,
    });
    return { ran: true, choice, kickFired: true };
  }

  // mode === 'boot': always originate+kick (respecting resume-debt idle),
  // forcing a fresh seed only when a real orientation choice was recorded.
  if (!input.kick) {
    return { ran: dialogRan, ...(choice !== undefined ? { choice } : {}), kickFired: false };
  }
  const forceSeed = choice !== undefined && choice !== 'continue';
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
  // Sanity-only fold — proves the orientation entry just appended is what
  // the next origination will pick up.
  void freshSessionOrientationChoice(entries, BRUNCH_KICK_CUSTOM_TYPE);

  const origination = originateAssistantTurn({
    specId: kick.specId,
    ...(kick.specName ? { specName: kick.specName } : {}),
    reads: kick.reads,
    entries,
    resumeOrigin: options.resumeOrigin,
    workspaceContext: kick.workspaceContext,
    manager: sessionManager,
    ...(options.forceSeed ? { forceSeed: true } : {}),
  });

  if (kick.onOriginationDecision) await kick.onOriginationDecision(origination.decision);

  await completeAssistantKick({
    decision: origination.decision,
    modelAvailable: kick.modelAvailable,
    sendCustomMessage: kick.sendCustomMessage,
    onOutcome: (outcome) => {
      if (kick.onKickOutcome) void kick.onKickOutcome(outcome, origination.decision);
    },
  });
}
