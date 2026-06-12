import type { SessionManager } from '@earendil-works/pi-coding-agent';

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

/** Ledger-only continuity entry — persisted state, never enters LLM context. */
export interface PreparedLedgerEntry {
  readonly type: 'custom';
  readonly customType: string;
  readonly data: Record<string, unknown>;
}

/**
 * Provider-visible continuity entry — `content` enters LLM context as a user
 * message via pi's `buildSessionContext`; `details` carries the structured
 * payload for projections (watermark, classifier) and is not sent to the LLM.
 */
export interface PreparedMessageEntry {
  readonly type: 'custom_message';
  readonly customType: string;
  readonly content: string;
  readonly details: Record<string, unknown>;
}

export type PreparedContinuityEntry = PreparedLedgerEntry | PreparedMessageEntry;

/**
 * The slice of pi's SessionManager that continuity appends need — projected
 * from the owner so signature drift in pi surfaces as a type error here.
 */
export type ContinuityEntryAppender = Pick<SessionManager, 'appendCustomEntry' | 'appendCustomMessageEntry'>;

/**
 * Route a prepared continuity entry to the SessionManager API matching its
 * carrier: ledger entries → `appendCustomEntry` (model never sees them),
 * message entries → `appendCustomMessageEntry` (content is provider-visible).
 * `display: false` keeps TUI rendering unchanged; chrome treatment of
 * continuity notices is a presentation concern (top line), not carrier truth.
 */
export function appendPreparedContinuityEntry(
  manager: ContinuityEntryAppender,
  entry: PreparedContinuityEntry,
): void {
  if (entry.type === 'custom_message') {
    manager.appendCustomMessageEntry(entry.customType, entry.content, false, entry.details);
    return;
  }
  manager.appendCustomEntry(entry.customType, entry.data);
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
      type: 'custom_message',
      customType: 'worldUpdate',
      content: worldUpdateContent(input.specId, input.currentLsn, watermark.lsn, strictGreater),
      details: {
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
      type: 'custom_message',
      customType: drain.kind === 'side_task' ? 'brunch.side_task_result' : 'brunch.reviewer_drain',
      content:
        drain.kind === 'side_task'
          ? `[Brunch] Side task ${drain.id} completed: ${drain.summary}`
          : `[Brunch] Reviewer ${drain.id} finished: ${drain.summary}`,
      details: { id: drain.id, summary: drain.summary },
    });
  }

  return { watermarkLsn: watermark.lsn, currentLsn: input.currentLsn, entriesToAppend };
}

function worldUpdateContent(
  specId: number,
  currentLsn: number,
  changedSinceLsn: number,
  items: readonly GraphChangeItem[],
): string {
  const lines = items.map((item) => {
    const label = [item.kind, item.title ? `“${item.title}”` : undefined].filter(Boolean).join(' ');
    const entity = item.entityId === undefined ? '' : ` (${String(item.entityId)})`;
    return `- LSN ${item.lsn}: ${label || 'change'}${entity}`;
  });
  return [
    `[Brunch] Graph updated for spec ${specId}: ${items.length} change(s) since LSN ${changedSinceLsn} (now at LSN ${currentLsn}).`,
    ...lines,
  ].join('\n');
}

export function stampOwnMutationWatermark(options: {
  readonly specId: number;
  readonly lsn: number;
  readonly source: string;
}): PreparedLedgerEntry {
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
