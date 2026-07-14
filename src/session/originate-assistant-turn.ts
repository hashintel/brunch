/**
 * Assistant-turn origination — the one choreography shared by every entry
 * point that may seed-and-kick a session (TUI boot, `session.triggerExchange`
 * RPC).
 *
 * Owns: origin derivation from projected transcript state (conversational
 * message presence — never entry counts, I46-L), seed-content composition
 * (`composeContextSeedContent`), and the seed append. The product fabricates
 * **no** `present_*` exchange (D78-L revised 2026-06-12 — the deterministic
 * offer was a pre-elicitation-gaps fossil): on a 'start' decision the launch
 * path fires the kick turn (`kickTurnMessage` + `triggerTurn`) and the
 * assistant authors the opening live, typically via real `present_*`/
 * `request_*` tool calls.
 *
 * Not a continuity writer: the pre-turn reconciler (D77-L) remains the only
 * writer of worldUpdate/staleness/drain continuity; this seam writes only the
 * seed.
 */

import {
  composeContextSeedContent,
  type SpecPostureSeedInput,
} from '../agents/contexts/seeds/origination.js';
import type { GraphSlice } from '../graph/index.js';
import {
  isContextSeedEntry,
  type TranscriptEntryLike,
} from '../projections/session/continuity-entry-classifier.js';
import { latestElicitationScratchpad } from './elicitation-scratchpad.js';
import { appendPreparedContinuityEntry, type ContinuityEntryAppender } from './prepare-next-turn.js';
import { freshSessionOrientationChoice } from './session-orientation.js';
import { startAssistantTurn, type StartAssistantTurnDecision } from './start-assistant-turn.js';

export interface OriginationReads {
  readonly queryGraph: () => GraphSlice;
}

export type OriginationManager = ContinuityEntryAppender;

export interface OriginateAssistantTurnInput {
  readonly specId: number;
  readonly specName?: string;
  readonly reads: OriginationReads;
  readonly entries: readonly TranscriptEntryLike[];
  /**
   * What an already-conversational session means at this entry point:
   * `resume_debt` for boot (kick only if debt remains), `manual_trigger` for
   * an explicit user-triggered kick.
   */
  readonly resumeOrigin: 'resume_debt' | 'manual_trigger';
  /**
   * Pre-rendered workspace overview for the seed payload
   * (`renderWorkspaceOverviewContext` output). Required: every origination
   * seed carries the workspace section (D78-L revised 2026-06-12).
   */
  readonly workspaceContext: string;
  /**
   * The spec's posture row (D118-L) for the seed's SPEC POSTURE section.
   * Callers with a spec read pass it; the section is omitted when absent or
   * unestablished (`origin: null`), mirroring the seed's omit-rather-than-
   * blank convention.
   */
  readonly posture?: SpecPostureSeedInput;
  readonly manager: OriginationManager;
  /**
   * Bypass the assistant-visible watermark gate on the seed entry. Set for
   * mid-session dialog-triggered kicks (J3/J4/J6) where the graph LSN has
   * not moved but the fresh orientation choice inside the seed must still
   * reach the next provider turn.
   */
  readonly forceSeed?: boolean;
  /**
   * Default true: pre-session callers append seed entries before AgentSession
   * creation so Pi's initial message snapshot includes them. Live session
   * junctures set this false and deliver seed entries through
   * `sendCustomMessage` instead, keeping Pi's persisted transcript and
   * in-memory agent state in sync before the triggering kick.
   */
  readonly appendSeed?: boolean;
}

export interface OriginateAssistantTurnResult {
  readonly decision: StartAssistantTurnDecision;
}

export const BRUNCH_KICK_CUSTOM_TYPE = 'brunch.kick';

export type KickCompletionOutcome =
  | {
      readonly status: 'fired';
      readonly origin: 'new_session' | 'resume_debt' | 'manual_trigger';
    }
  | {
      readonly status: 'skipped';
      readonly reason: 'no_model_available' | 'idle_no_unresolved_debt';
    }
  | {
      readonly status: 'failed';
      readonly origin: 'new_session' | 'resume_debt' | 'manual_trigger';
      readonly error: unknown;
    };

export interface CompleteAssistantKickInput {
  readonly decision: StartAssistantTurnDecision;
  readonly modelAvailable: boolean;
  readonly sendCustomMessage: (
    message: ReturnType<typeof kickTurnMessage>,
    options: { readonly triggerTurn: true },
  ) => Promise<unknown>;
  readonly onOutcome: (outcome: KickCompletionOutcome) => void;
}

/**
 * Completes an origination decision once a live AgentSession exists.
 *
 * The decision seam can append seed entries before the AgentSession is created,
 * but only the live session can trigger the assistant-authored opening turn.
 * This function owns the guard and guarantees one classified outcome for each
 * decision, so launch paths do not silently skip or bury failures in console IO.
 */
export async function completeAssistantKick(
  input: CompleteAssistantKickInput,
): Promise<KickCompletionOutcome> {
  if (input.decision.action === 'idle') {
    const outcome: KickCompletionOutcome = {
      status: 'skipped',
      reason: idleKickSkipReason(input.decision.reason),
    };
    input.onOutcome(outcome);
    return outcome;
  }

  if (!input.modelAvailable) {
    const outcome: KickCompletionOutcome = { status: 'skipped', reason: 'no_model_available' };
    input.onOutcome(outcome);
    return outcome;
  }

  try {
    await input.sendCustomMessage(kickTurnMessage(input.decision.origin), { triggerTurn: true });
    const outcome: KickCompletionOutcome = { status: 'fired', origin: input.decision.origin };
    input.onOutcome(outcome);
    return outcome;
  } catch (error: unknown) {
    const outcome: KickCompletionOutcome = { status: 'failed', origin: input.decision.origin, error };
    input.onOutcome(outcome);
    return outcome;
  }
}

/**
 * The turn-trigger payload completing a 'start' origination decision.
 *
 * Origination appends the seed (only) to the session manager before the
 * AgentSession exists; nothing about that append starts an LLM turn. The
 * launch path fires this message via
 * `session.sendCustomMessage(kickTurnMessage(origin), { triggerTurn: true })`
 * after session creation — the FE-857 out-of-band injection surface — so the
 * assistant actually opens the conversation, authoring any `present_*` offer
 * itself, live (D78-L revised 2026-06-12: the product mints no offer). It is
 * a transcript entry (I47-L), never a fabricated user message (I46-L), and
 * writes no continuity (D77-L: the reconciler remains the only continuity
 * writer).
 *
 * Content varies by origin (F16b, card 4): `resume_debt` — a resumed session
 * — opens with an assessment (graph reading + TODO forecast) grounded in the
 * seeded facts (D101-L/D102-L) *before* elicitation, so the user gets a
 * "where are we" re-entry surface instead of dropping straight back into
 * questions. `new_session` and `manual_trigger` keep the original assistant-
 * authored opening; `manual_trigger` already carries a routing directive via
 * the seed's SESSION ORIENTATION section (`session_orientation`).
 */
export function kickTurnMessage(origin: 'new_session' | 'resume_debt' | 'manual_trigger'): {
  customType: typeof BRUNCH_KICK_CUSTOM_TYPE;
  content: string;
  display: boolean;
  details: { origin: string };
} {
  return {
    customType: BRUNCH_KICK_CUSTOM_TYPE,
    content: kickTurnContent(origin),
    display: false,
    details: { origin },
  };
}

function kickTurnContent(origin: 'new_session' | 'resume_debt' | 'manual_trigger'): string {
  if (origin === 'resume_debt') {
    return (
      'Session resume: the spec context has been re-seeded into the transcript for you. ' +
      'Open with a brief assessment grounded in that seed — a compact reading of what the ' +
      'graph currently expresses (kinds present, notable structure) and a forecast of what ' +
      'looks TODO next — before returning to elicitation. Do not restate raw node/edge ' +
      'listings; read the seed as a whole and orient the user to where we are.'
    );
  }
  return (
    'Session start: the spec context has been seeded into the transcript for you. ' +
    'Open the conversation in your own words, grounded in that seeded context, ' +
    'and lead the user toward the first structured question.'
  );
}

export function originateAssistantTurn(input: OriginateAssistantTurnInput): OriginateAssistantTurnResult {
  const slice = input.reads.queryGraph();
  const freshChoice = freshSessionOrientationChoice(input.entries, BRUNCH_KICK_CUSTOM_TYPE);
  // A dismissed menu is inert: it never routes an opening turn.
  const orientation = freshChoice === 'dismissed' ? undefined : freshChoice;
  // Origin is derived from projected transcript state, not counts or flags
  // (I46/I47): a transcript with no conversational message entries is a new
  // session; anything else takes the caller-named resume decision, which
  // itself dedupes re-kicks (a prior kick's present_* tail owes nothing).
  const origin = input.entries.some(isConversationalMessageEntry) ? input.resumeOrigin : 'new_session';
  // Keep the "never suppress a session's first seed" bypass at origination:
  // this is where origin and context-seed membership are both known. The
  // lower watermark gate only decides whether an already-composed seed should
  // be emitted for the current LSN.
  const shouldForceSeed =
    input.forceSeed || (origin === 'new_session' && !input.entries.some(isContextSeedEntry));
  const decision = startAssistantTurn({
    specId: input.specId,
    currentLsn: slice.lsn,
    entries: input.entries,
    origin,
    ...(shouldForceSeed ? { forceSeed: true } : {}),
    seedContent: composeContextSeedContent({
      specId: input.specId,
      ...(input.specName ? { specName: input.specName } : {}),
      slice,
      scratchpad: latestElicitationScratchpad(input.entries),
      workspaceContext: input.workspaceContext,
      ...(orientation ? { orientation } : {}),
      ...(input.posture ? { posture: input.posture } : {}),
    }),
  });

  // Seed only — the product fabricates no present_* offer (D78-L revised
  // 2026-06-12): on a 'start' decision the launch path fires the kick turn
  // and the assistant authors the opening live from the seeded context.
  if (input.appendSeed ?? true) {
    for (const entry of decision.seedEntries) {
      appendPreparedContinuityEntry(input.manager, entry);
    }
  }
  return { decision };
}

function idleKickSkipReason(
  reason: Extract<StartAssistantTurnDecision, { action: 'idle' }>['reason'],
): Extract<KickCompletionOutcome, { status: 'skipped' }>['reason'] {
  return reason === 'no_unresolved_debt' ? 'idle_no_unresolved_debt' : reason;
}

function isConversationalMessageEntry(entry: TranscriptEntryLike): boolean {
  return (entry as { type?: unknown }).type === 'message';
}
