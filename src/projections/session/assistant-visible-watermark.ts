import {
  watermarkFromEntry,
  type ContinuityWatermark,
  type TranscriptEntryLike,
} from './continuity-entry-classifier.js';

export type AssistantVisibleWatermark = ContinuityWatermark;

export function projectAssistantVisibleWatermark(
  entries: readonly TranscriptEntryLike[],
  options: { readonly specId?: number } = {},
): AssistantVisibleWatermark | null {
  let latest: AssistantVisibleWatermark | null = null;
  const seenSpecs = new Set<number>();

  for (const entry of entries) {
    const watermark = watermarkFromEntry(entry);
    if (!watermark) continue;
    seenSpecs.add(watermark.specId);
    if (options.specId !== undefined && watermark.specId !== options.specId) continue;
    if (latest === null || watermark.lsn > latest.lsn) {
      latest = watermark;
    }
  }

  if (options.specId === undefined && seenSpecs.size > 1) {
    throw new Error('Cannot project assistant-visible watermark across multiple specs without specId.');
  }

  return latest;
}

export function compareWatermarks(a: AssistantVisibleWatermark, b: AssistantVisibleWatermark): number {
  if (a.specId !== b.specId) {
    throw new Error('Cannot compare continuity watermarks from different specs.');
  }
  return a.lsn - b.lsn;
}
