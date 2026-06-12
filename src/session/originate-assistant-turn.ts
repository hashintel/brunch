/**
 * Assistant-turn origination — the one choreography shared by every entry
 * point that may seed-and-kick a session (TUI boot, `session.triggerExchange`
 * RPC).
 *
 * Owns: origin derivation from projected transcript state (conversational
 * message presence — never entry counts, I46-L), seed-content composition
 * (`composeContextSeedContent`), seed append, and the assistant-originated
 * `present_*` exchange append on a start decision.
 *
 * Not a continuity writer: the pre-turn reconciler (D77-L) remains the only
 * writer of worldUpdate/staleness/drain continuity; this seam writes only the
 * origination artifacts (seed + opening exchange).
 */

import type { SessionManager } from '@earendil-works/pi-coding-agent';

import type { GraphSlice } from '../graph/index.js';
import type { ElicitationGap } from '../graph/schema/elicitation-gaps.js';
import type { TranscriptEntryLike } from '../projections/session/continuity-entry-classifier.js';
import { composeContextSeedContent } from './context-seed.js';
import { appendPreparedContinuityEntry, type ContinuityEntryAppender } from './prepare-next-turn.js';
import { startAssistantTurn, type StartAssistantTurnDecision } from './start-assistant-turn.js';
import {
  nextDeterministicStructuredExchange,
  presentToolResultMessage,
  type PendingStructuredExchange,
} from './structured-exchange-loop.js';

export interface OriginationReads {
  readonly queryGraph: () => GraphSlice;
  readonly getElicitationGaps: () => readonly ElicitationGap[];
}

export type OriginationManager = ContinuityEntryAppender & Pick<SessionManager, 'appendMessage'>;

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
  /** Count of completed structured exchanges, for deterministic exchange selection. */
  readonly exchangeOrdinal: number;
  readonly manager: OriginationManager;
}

export interface OriginateAssistantTurnResult {
  readonly decision: StartAssistantTurnDecision;
  readonly exchange?: PendingStructuredExchange;
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
    }),
  });

  for (const entry of decision.seedEntries) {
    appendPreparedContinuityEntry(input.manager, entry);
  }
  if (decision.action !== 'start') {
    return { decision };
  }

  const exchange = nextDeterministicStructuredExchange(input.exchangeOrdinal);
  input.manager.appendMessage(presentToolResultMessage(exchange));
  return { decision, exchange };
}

function isConversationalMessageEntry(entry: TranscriptEntryLike): boolean {
  return (entry as { type?: unknown }).type === 'message';
}
