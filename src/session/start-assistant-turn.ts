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
}): readonly PreparedContinuityEntry[] {
  const watermark = projectAssistantVisibleWatermark(input.entries, { specId: input.specId });
  if (watermark && watermark.lsn >= input.currentLsn) return [];
  return [
    {
      type: 'custom',
      customType: 'brunch.context_seed',
      data: { specId: input.specId, snapshotLsn: input.currentLsn },
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
      return toolName.startsWith('request_') && responseStatus(message) !== 'answered';
    }
    return false;
  }
  return false;
}

function responseStatus(message: Record<string, unknown>): string | undefined {
  const details = isRecord(message.details)
    ? message.details
    : isRecord(message.data)
      ? message.data
      : undefined;
  return typeof details?.status === 'string' ? details.status : undefined;
}

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
