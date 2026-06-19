import {
  customEntryType,
  isContinuityOnlyNonDebtEntry,
  type TranscriptEntryLike,
} from './continuity-entry-classifier.js';

export const CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE = 'brunch.capture_sweep_watermark';

const DIGEST_CUSTOM_TYPES = new Set<string>([
  'brunch.acquisition_digest',
  'brunch.capture_digest',
  'brunch.digest',
]);

export interface CaptureSweepWatermark {
  readonly customType: typeof CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE;
  readonly sweptAt: string;
}

export interface CaptureSweepWindowProjection {
  /** The latest transcript-backed marker entry position, or null when no sweep has completed. */
  readonly watermarkEntryIndex: number | null;
  /** Entries after the latest marker that the capture sweep must consume. */
  readonly conversationalTail: readonly TranscriptEntryLike[];
}

export interface CaptureSweepAdvanceResult {
  readonly marker: CaptureSweepWatermark | null;
  readonly conversationalTail: readonly TranscriptEntryLike[];
}

export function projectCaptureSweepWindow(
  entries: readonly TranscriptEntryLike[],
): CaptureSweepWindowProjection {
  const watermarkEntryIndex = latestSweepWatermarkEntryIndex(entries);
  const tailStart = watermarkEntryIndex === null ? 0 : watermarkEntryIndex + 1;
  const conversationalTail = entries.slice(tailStart).filter(isSweepConversationalEntry);
  return { watermarkEntryIndex, conversationalTail };
}

export function prepareCaptureSweepAdvance(
  entries: readonly TranscriptEntryLike[],
  options: { readonly now?: () => Date } = {},
): CaptureSweepAdvanceResult {
  const window = projectCaptureSweepWindow(entries);
  if (window.conversationalTail.length === 0) {
    return { marker: null, conversationalTail: [] };
  }
  return {
    marker: {
      customType: CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE,
      sweptAt: (options.now ?? (() => new Date()))().toISOString(),
    },
    conversationalTail: window.conversationalTail,
  };
}

export function isCaptureSweepWatermarkEntry(entry: TranscriptEntryLike): boolean {
  return customEntryType(entry) === CAPTURE_SWEEP_WATERMARK_CUSTOM_TYPE;
}

export function isSweepConversationalEntry(entry: TranscriptEntryLike): boolean {
  if (isCaptureSweepWatermarkEntry(entry)) return false;

  const customType = customEntryType(entry);
  if (customType !== undefined && DIGEST_CUSTOM_TYPES.has(customType)) return true;
  if (isContinuityOnlyNonDebtEntry(entry)) return false;

  const message = messageRecord(entry);
  if (!message) return false;
  const role = typeof message.role === 'string' ? message.role : undefined;
  if (role === 'user' || role === 'assistant') return true;
  if (role === 'toolResult') {
    const toolName = typeof message.toolName === 'string' ? message.toolName : '';
    return toolName.startsWith('request_');
  }
  return false;
}

function latestSweepWatermarkEntryIndex(entries: readonly TranscriptEntryLike[]): number | null {
  for (let index = entries.length - 1; index >= 0; index--) {
    if (isCaptureSweepWatermarkEntry(entries[index]!)) return index;
  }
  return null;
}

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
