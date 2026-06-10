export interface ContinuityWatermark {
  readonly specId: number;
  readonly lsn: number;
}

export type ContinuityEntryKind = 'watermark_carrier' | 'continuity_only_non_debt' | 'debt_bearing';

export const WATERMARK_CARRIER_CUSTOM_TYPES = [
  'brunch.context_seed',
  'brunch.graph_overview_snapshot',
  'brunch.own_mutation',
  'worldUpdate',
] as const;

export const CONTINUITY_ONLY_NON_DEBT_CUSTOM_TYPES = [
  'brunch.context_seed',
  'brunch.graph_overview_snapshot',
  'brunch.mention',
  'brunch.mention_staleness_hint',
  'brunch.session_lifecycle',
  'brunch.side_task_result',
  'brunch.reviewer_drain',
  'worldUpdate',
] as const;

const WATERMARK_CARRIER_TYPES = new Set<string>(WATERMARK_CARRIER_CUSTOM_TYPES);
const CONTINUITY_ONLY_NON_DEBT_TYPES = new Set<string>(CONTINUITY_ONLY_NON_DEBT_CUSTOM_TYPES);

export interface TranscriptEntryLike {
  readonly type?: unknown;
  readonly customType?: unknown;
  readonly data?: unknown;
  readonly details?: unknown;
  readonly message?: unknown;
}

export function classifyContinuityEntry(entry: TranscriptEntryLike): ContinuityEntryKind {
  if (isWatermarkCarrier(entry)) return 'watermark_carrier';
  if (isContinuityOnlyNonDebtEntry(entry)) return 'continuity_only_non_debt';
  return 'debt_bearing';
}

export function isWatermarkCarrier(entry: TranscriptEntryLike): boolean {
  const customType = customEntryType(entry);
  return (
    customType !== undefined && WATERMARK_CARRIER_TYPES.has(customType) && watermarkFromEntry(entry) !== null
  );
}

export function isContinuityOnlyNonDebtEntry(entry: TranscriptEntryLike): boolean {
  const customType = customEntryType(entry);
  if (customType !== undefined && CONTINUITY_ONLY_NON_DEBT_TYPES.has(customType)) return true;

  const message = messageRecord(entry);
  if (message?.role === 'toolResult') {
    const toolName = typeof message.toolName === 'string' ? message.toolName : undefined;
    return toolName === 'read_graph';
  }
  return false;
}

export function watermarkFromEntry(entry: TranscriptEntryLike): ContinuityWatermark | null {
  const customType = customEntryType(entry);
  if (customType === undefined || !WATERMARK_CARRIER_TYPES.has(customType)) return null;
  const payload = payloadRecord(entry);
  if (!payload) return null;
  return readWatermark(payload);
}

export function customEntryType(entry: TranscriptEntryLike): string | undefined {
  if (typeof entry.customType === 'string') return entry.customType;
  const message = messageRecord(entry);
  return typeof message?.customType === 'string' ? message.customType : undefined;
}

function payloadRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  if (isRecord(entry.data)) return entry.data;
  if (isRecord(entry.details)) return entry.details;
  const message = messageRecord(entry);
  if (isRecord(message?.data)) return message.data;
  if (isRecord(message?.details)) return message.details;
  return undefined;
}

function readWatermark(payload: Record<string, unknown>): ContinuityWatermark | null {
  const nested = isRecord(payload.watermark) ? payload.watermark : payload;
  const lsn = integerField(nested.lsn) ?? integerField(nested.currentLsn) ?? integerField(nested.snapshotLsn);
  if (lsn === undefined) return null;
  const specId = integerField(nested.specId);
  if (specId === undefined) {
    throw new Error('Continuity watermark carrier must include specId; bare LSN comparison is invalid.');
  }
  return { specId, lsn };
}

function messageRecord(entry: TranscriptEntryLike): Record<string, unknown> | undefined {
  return isRecord(entry.message) ? entry.message : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function integerField(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;
}
