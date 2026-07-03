/**
 * Session-orientation juncture orchestrator — the one flow every mid-session
 * juncture (session-entry-orientation J2–J6, and eventually option-2 J1)
 * runs when it fires:
 *
 *   dialog → entry → (choice ≠ continue at a no-pending-kick juncture) → live-kick
 *
 * Composition seam: delegates dialog + entry write to
 * `runAndRecordSessionOrientation`, and — when the juncture is not carried
 * by an already-pending kick and the choice is not `continue` — composes
 * `originateAssistantTurn` (with `forceSeed: true`, so a fresh orientation
 * directive reaches the provider even when the graph LSN has not moved)
 * and fires the kick turn via the injected `sendCustomMessage`.
 *
 * Pending-kick junctures (option-2 J1 boot startup, J2 launch-path
 * re-origination) pass `carriesPendingKick: true` — the caller already
 * owns the kick fire, so this seam stops at the dialog + entry write, and
 * the next origination pass folds the fresh choice via
 * `freshSessionOrientationChoice` (`src/session/session-orientation.ts`).
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
import { runAndRecordSessionOrientation, type SessionOrientationDialogUi } from './index.js';

export type JunctureSessionManager = SessionOrientationEntrySessionManager &
  OriginationManager & {
    getEntries(): readonly TranscriptEntryLike[];
  };

export interface RunOrientationJunctureInput {
  readonly hasUI: boolean;
  readonly ui: SessionOrientationDialogUi;
  readonly trigger: SessionOrientationTrigger;
  readonly sessionManager: JunctureSessionManager;
  /**
   * True when the juncture is already followed by a kick the caller owns
   * (option-2 J1 boot startup, J2 launch-path re-origination). At pending-kick
   * junctures this seam stops at dialog + entry; the pending kick's next
   * origination reads the fresh orientation via `freshSessionOrientationChoice`.
   */
  readonly carriesPendingKick: boolean;
  readonly title?: string;
  readonly onAppendError?: (error: unknown) => void;
  /**
   * Live-kick surface. Omitted when `carriesPendingKick` is true; required
   * when non-continue choices at this juncture must fire a live kick
   * (J3/J4/J6, and later J5).
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
  readonly onOutcome?: (outcome: KickCompletionOutcome) => void;
}

export interface RunOrientationJunctureResult {
  readonly ran: boolean;
  readonly choice?: SessionOrientationChoice;
  readonly kickFired: boolean;
}

export async function runOrientationJuncture(
  input: RunOrientationJunctureInput,
): Promise<RunOrientationJunctureResult> {
  const choice = await runAndRecordSessionOrientation({
    hasUI: input.hasUI,
    ui: input.ui,
    trigger: input.trigger,
    manager: input.sessionManager,
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.onAppendError ? { onAppendError: input.onAppendError } : {}),
  });

  if (choice === undefined) return { ran: false, kickFired: false };
  if (input.carriesPendingKick || choice === 'continue' || !input.kick) {
    return { ran: true, choice, kickFired: false };
  }

  await fireLiveKick(input.sessionManager, input.kick);
  return { ran: true, choice, kickFired: true };
}

async function fireLiveKick(sessionManager: JunctureSessionManager, kick: LiveKickDeps): Promise<void> {
  const entries = sessionManager.getEntries();
  // Sanity-only fold — proves the orientation entry that was just appended
  // is the choice the next origination will pick up.
  void freshSessionOrientationChoice(entries, BRUNCH_KICK_CUSTOM_TYPE);

  const origination = originateAssistantTurn({
    specId: kick.specId,
    ...(kick.specName ? { specName: kick.specName } : {}),
    reads: kick.reads,
    entries,
    resumeOrigin: 'manual_trigger',
    workspaceContext: kick.workspaceContext,
    manager: sessionManager,
    forceSeed: true,
  });

  await completeAssistantKick({
    decision: origination.decision,
    modelAvailable: kick.modelAvailable,
    sendCustomMessage: kick.sendCustomMessage,
    onOutcome: (outcome) => kick.onOutcome?.(outcome),
  });
}
