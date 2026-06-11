import {
  compareWatermarks,
  projectAssistantVisibleWatermark,
} from '../projections/session/assistant-visible-watermark.js';
import type { TranscriptEntryLike } from '../projections/session/continuity-entry-classifier.js';
import { stalenessEntriesForMentions, type MentionFact } from './mention-ledger.js';

export interface GraphChangeItem {
  readonly specId: number;
  readonly lsn: number;
  readonly entityId?: string | number;
  readonly kind?: string;
  readonly title?: string;
}

export interface ContinuityDrain {
  readonly kind: 'side_task' | 'reviewer';
  readonly id: string;
  readonly summary: string;
}

export interface PreparedContinuityEntry {
  readonly type: 'custom';
  readonly customType: string;
  readonly data: Record<string, unknown>;
}

export interface PrepareNextTurnInput {
  readonly specId: number;
  readonly currentLsn: number;
  readonly entries: readonly TranscriptEntryLike[];
  readonly changes: readonly GraphChangeItem[];
  readonly drains?: readonly ContinuityDrain[];
  readonly mentions?: readonly MentionFact[];
}

export interface PrepareNextTurnResult {
  readonly watermarkLsn: number;
  readonly currentLsn: number;
  readonly entriesToAppend: readonly PreparedContinuityEntry[];
}

export function prepareNextTurn(input: PrepareNextTurnInput): PrepareNextTurnResult {
  const projected = projectAssistantVisibleWatermark(input.entries, { specId: input.specId });
  const watermark = projected ?? { specId: input.specId, lsn: 0 };
  compareWatermarks(watermark, { specId: input.specId, lsn: input.currentLsn });

  const entriesToAppend: PreparedContinuityEntry[] = [];
  const strictGreater = input.changes
    .filter(
      (change) =>
        change.specId === input.specId && change.lsn > watermark.lsn && change.lsn <= input.currentLsn,
    )
    .sort((a, b) => a.lsn - b.lsn || String(a.entityId ?? '').localeCompare(String(b.entityId ?? '')));

  if (input.currentLsn > watermark.lsn && strictGreater.length > 0) {
    entriesToAppend.push({
      type: 'custom',
      customType: 'worldUpdate',
      data: {
        specId: input.specId,
        currentLsn: input.currentLsn,
        changedSinceLsn: watermark.lsn,
        items: strictGreater.map((change) => ({ ...change })),
      },
    });
  }

  const currentByEntityId = new Map(
    strictGreater.flatMap((change) =>
      change.entityId === undefined ? [] : ([[String(change.entityId), change.lsn]] as const),
    ),
  );
  entriesToAppend.push(...stalenessEntriesForMentions({ mentions: input.mentions ?? [], currentByEntityId }));

  for (const drain of input.drains ?? []) {
    entriesToAppend.push({
      type: 'custom',
      customType: drain.kind === 'side_task' ? 'brunch.side_task_result' : 'brunch.reviewer_drain',
      data: { id: drain.id, summary: drain.summary },
    });
  }

  return { watermarkLsn: watermark.lsn, currentLsn: input.currentLsn, entriesToAppend };
}

export function stampOwnMutationWatermark(options: {
  readonly specId: number;
  readonly lsn: number;
  readonly source: string;
}): PreparedContinuityEntry {
  return {
    type: 'custom',
    customType: 'brunch.own_mutation',
    data: { specId: options.specId, lsn: options.lsn, source: options.source },
  };
}

export async function guardBeforeProviderRequest(options: {
  readonly prepare: () => PrepareNextTurnResult | Promise<PrepareNextTurnResult>;
  readonly append: (entry: PreparedContinuityEntry) => void | Promise<void>;
}): Promise<PrepareNextTurnResult> {
  const first = await options.prepare();
  if (first.entriesToAppend.length === 0) return first;
  for (const entry of first.entriesToAppend) {
    await options.append(entry);
  }
  const second = await options.prepare();
  if (second.entriesToAppend.length > 0) {
    throw new Error('Continuity drift remained after one prepareNextTurn retry.');
  }
  return second;
}
