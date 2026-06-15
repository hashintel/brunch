import { REQUEST_OUTCOME_KEYS } from '../projections/exchanges/request-choices.js';
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
  readonly strategy?: 'auto' | 'freestyle';
  /**
   * Composed provider-visible seed body (spec overview + grounding-floor
   * framing) — always `composeContextSeedContent` output in product paths;
   * `originateAssistantTurn` owns the composition.
   */
  readonly seedContent: string;
}

export type StartAssistantTurnDecision =
  | {
      readonly action: 'start';
      readonly origin: AssistantTurnOrigin;
      readonly seedEntries: readonly PreparedContinuityEntry[];
    }
  | {
      readonly action: 'idle';
      readonly reason: 'explicit_freestyle' | 'no_unresolved_debt';
      readonly seedEntries: readonly PreparedContinuityEntry[];
    };

export function startAssistantTurn(input: StartAssistantTurnInput): StartAssistantTurnDecision {
  const seedEntries = contextSeedEntries(input);
  if (input.strategy === 'freestyle') {
    return { action: 'idle', reason: 'explicit_freestyle', seedEntries };
  }
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
}): readonly PreparedContinuityEntry[] {
  const watermark = projectAssistantVisibleWatermark(input.entries, { specId: input.specId });
  if (watermark && watermark.lsn >= input.currentLsn) return [];
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
 * Real request_* result envelopes (projections/exchanges) carry their outcome
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
