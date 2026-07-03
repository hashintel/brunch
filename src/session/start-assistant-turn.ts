import { REQUEST_OUTCOME_KEYS } from '../exchanges/projections/request-response.js';
import { projectAssistantVisibleWatermark } from '../projections/session/assistant-visible-watermark.js';
import {
  isContinuityOnlyNonDebtEntry,
  type TranscriptEntryLike,
} from '../projections/session/continuity-entry-classifier.js';
import type { PreparedContinuityEntry } from './prepare-next-turn.js';

export type AssistantTurnOrigin = 'new_session' | 'resume_debt' | 'manual_trigger';

export interface StartAssistantTurnInput {
  readonly specId: number;
  readonly currentLsn: number;
  readonly entries: readonly TranscriptEntryLike[];
  readonly origin: AssistantTurnOrigin;
  /**
   * Composed provider-visible seed body (spec overview + grounding-floor
   * framing) — always `composeContextSeedContent` output in product paths;
   * `originateAssistantTurn` owns the composition.
   */
  readonly seedContent: string;
  /**
   * Bypass the assistant-visible watermark gate on seed emission. Set for
   * mid-session dialog-triggered kicks (session-entry-orientation J3/J4/J6)
   * where the graph LSN has not moved but a fresh orientation directive
   * inside the seed must still reach the next provider turn.
   */
  readonly forceSeed?: boolean;
}

export type StartAssistantTurnDecision =
  | {
      readonly action: 'start';
      readonly origin: AssistantTurnOrigin;
      readonly seedEntries: readonly PreparedContinuityEntry[];
    }
  | {
      readonly action: 'idle';
      readonly reason: 'no_unresolved_debt';
      readonly seedEntries: readonly PreparedContinuityEntry[];
    };

export function startAssistantTurn(input: StartAssistantTurnInput): StartAssistantTurnDecision {
  const seedEntries = contextSeedEntries({
    specId: input.specId,
    currentLsn: input.currentLsn,
    entries: input.entries,
    seedContent: input.seedContent,
    ...(input.forceSeed ? { forceSeed: true } : {}),
  });
  if (
    input.origin === 'new_session' ||
    input.origin === 'manual_trigger' ||
    latestTailOwesAssistant(input.entries)
  ) {
    return { action: 'start', origin: input.origin, seedEntries };
  }
  return { action: 'idle', reason: 'no_unresolved_debt', seedEntries };
}

export function contextSeedEntries(input: {
  readonly specId: number;
  readonly currentLsn: number;
  readonly entries: readonly TranscriptEntryLike[];
  readonly seedContent: string;
  readonly forceSeed?: boolean;
}): readonly PreparedContinuityEntry[] {
  if (!input.forceSeed) {
    const watermark = projectAssistantVisibleWatermark(input.entries, { specId: input.specId });
    if (watermark && watermark.lsn >= input.currentLsn) return [];
  }
  return [
    {
      type: 'custom_message',
      customType: 'brunch.context_seed',
      content: input.seedContent,
      details: { specId: input.specId, snapshotLsn: input.currentLsn },
    },
  ];
}

export function latestTailOwesAssistant(entries: readonly TranscriptEntryLike[]): boolean {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index];
    if (!entry || isContinuityOnlyNonDebtEntry(entry)) continue;
    const message = messageRecord(entry);
    if (message?.role === 'user') return true;
    if (message?.role === 'toolResult') {
      const toolName = typeof message.toolName === 'string' ? message.toolName : '';
      if (toolName.startsWith('request_')) return !isTerminalRequestResult(message);
      if (toolName.startsWith('present_')) return false;
    }
    return false;
  }
  return false;
}

/**
 * Real request_* result envelopes (exchanges/projections) carry their outcome
 * as key presence — `REQUEST_OUTCOME_KEYS` — never a status string field. A
 * request result with none of those keys is still pending.
 */
function isTerminalRequestResult(message: Record<string, unknown>): boolean {
  const details = isRecord(message.details)
    ? message.details
    : isRecord(message.data)
      ? message.data
      : undefined;
  if (!details) return false;
  return REQUEST_OUTCOME_KEYS.some((key) => key in details);
}

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
