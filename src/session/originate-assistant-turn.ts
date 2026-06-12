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

import type { GraphSlice } from '../graph/index.js';
import type { ElicitationGap } from '../graph/schema/elicitation-gaps.js';
import type { TranscriptEntryLike } from '../projections/session/continuity-entry-classifier.js';
import { composeContextSeedContent } from './context-seed.js';
import { appendPreparedContinuityEntry, type ContinuityEntryAppender } from './prepare-next-turn.js';
import { startAssistantTurn, type StartAssistantTurnDecision } from './start-assistant-turn.js';

export interface OriginationReads {
  readonly queryGraph: () => GraphSlice;
  readonly getElicitationGaps: () => readonly ElicitationGap[];
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
  /** Pre-rendered workspace overview for the seed payload (renderWorkspaceContext output). */
  readonly workspaceContext?: string;
  readonly manager: OriginationManager;
}

export interface OriginateAssistantTurnResult {
  readonly decision: StartAssistantTurnDecision;
}

export const BRUNCH_KICK_CUSTOM_TYPE = 'brunch.kick';

/**
 * The turn-trigger payload completing a 'start' origination decision.
 *
 * Origination appends the seed + `present_*` offer to the session manager
 * before the AgentSession exists; nothing about those appends starts an LLM
 * turn. The launch path fires this message via
 * `session.sendCustomMessage(kickTurnMessage(origin), { triggerTurn: true })`
 * after session creation — the FE-857 out-of-band injection surface — so the
 * assistant actually opens the conversation. It is a transcript entry
 * (I47-L), never a fabricated user message (I46-L), and writes no continuity
 * (D77-L: the reconciler remains the only continuity writer).
 */
export function kickTurnMessage(origin: 'new_session' | 'resume_debt' | 'manual_trigger'): {
  customType: typeof BRUNCH_KICK_CUSTOM_TYPE;
  content: string;
  display: boolean;
  details: { origin: string };
} {
  return {
    customType: BRUNCH_KICK_CUSTOM_TYPE,
    content:
      'Session start: a structured exchange offer was just presented to the user. ' +
      'Open the conversation in your own words, grounded in the seeded spec context, ' +
      'leading to the offered question.',
    display: false,
    details: { origin },
  };
}

export function originateAssistantTurn(input: OriginateAssistantTurnInput): OriginateAssistantTurnResult {
  const slice = input.reads.queryGraph();
  // Origin is derived from projected transcript state, not counts or flags
  // (I46/I47): a transcript with no conversational message entries is a new
  // session; anything else takes the caller-named resume decision, which
  // itself dedupes re-kicks (a prior kick's present_* tail owes nothing).
  const decision = startAssistantTurn({
    specId: input.specId,
    currentLsn: slice.lsn,
    entries: input.entries,
    origin: input.entries.some(isConversationalMessageEntry) ? input.resumeOrigin : 'new_session',
    seedContent: composeContextSeedContent({
      specId: input.specId,
      ...(input.specName ? { specName: input.specName } : {}),
      slice,
      gaps: input.reads.getElicitationGaps(),
      ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
    }),
  });

  // Seed only — the product fabricates no present_* offer (D78-L revised
  // 2026-06-12): on a 'start' decision the launch path fires the kick turn
  // and the assistant authors the opening live from the seeded context.
  for (const entry of decision.seedEntries) {
    appendPreparedContinuityEntry(input.manager, entry);
  }
  return { decision };
}

function isConversationalMessageEntry(entry: TranscriptEntryLike): boolean {
  return (entry as { type?: unknown }).type === 'message';
}
