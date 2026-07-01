/**
 * Session-local elicitation scratchpad — "what still needs asking" as
 * branch-reconstructed session state (D101-L), replacing the persisted
 * spec-global `elicitation_gaps` register (D65-L).
 *
 * Mirrors the `session/runtime-state.ts` fold pattern: one custom entry type,
 * one append helper, one fold function that reconstructs current state from
 * the session branch. Each write appends a full-replacement snapshot
 * (latest-snapshot-wins), never a delta — so branch reconstruction never
 * needs to reduce across mixed add/resolve op shapes.
 *
 * Non-authoritative (I56-L): entries hold obligation / disposition / meta
 * only, never graph truth. Durable truth stays in the graph.
 */

export const BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE = 'brunch.elicitation_scratchpad';

export type ElicitationScratchpadDisposition = 'open' | 'resolved';

export interface ElicitationScratchpadItem {
  id: string;
  obligation: string;
  disposition: ElicitationScratchpadDisposition;
  rationale?: string;
  meta?: Readonly<Record<string, unknown>>;
}

export interface ElicitationScratchpadEntryData {
  schemaVersion: 1;
  items: readonly ElicitationScratchpadItem[];
}

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDisposition(value: unknown): value is ElicitationScratchpadDisposition {
  return value === 'open' || value === 'resolved';
}

export function parseElicitationScratchpadItem(value: unknown): ElicitationScratchpadItem | undefined {
  if (!isRecord(value)) return undefined;
  if (typeof value.id !== 'string' || value.id === '') return undefined;
  if (typeof value.obligation !== 'string' || value.obligation === '') return undefined;
  if (!isDisposition(value.disposition)) return undefined;
  if (value.rationale !== undefined && typeof value.rationale !== 'string') return undefined;
  if (value.meta !== undefined && !isRecord(value.meta)) return undefined;

  return {
    id: value.id,
    obligation: value.obligation,
    disposition: value.disposition,
    ...(value.rationale !== undefined ? { rationale: value.rationale } : {}),
    ...(value.meta !== undefined ? { meta: value.meta } : {}),
  };
}

export function parseElicitationScratchpadEntryData(
  value: unknown,
): ElicitationScratchpadEntryData | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!Array.isArray(value.items)) return undefined;

  const items: ElicitationScratchpadItem[] = [];
  for (const rawItem of value.items) {
    const item = parseElicitationScratchpadItem(rawItem);
    if (!item) return undefined;
    items.push(item);
  }

  return { schemaVersion: 1, items };
}

/**
 * Reconstructs the current scratchpad from the session branch:
 * latest-snapshot-wins over every valid `brunch.elicitation_scratchpad`
 * entry. Invalid entries are ignored, mirroring
 * `latestValidBrunchAgentStateEntryData`.
 */
export function latestElicitationScratchpad(
  entries: readonly CustomEntryLike[],
): readonly ElicitationScratchpadItem[] {
  let latest: readonly ElicitationScratchpadItem[] = [];

  for (const entry of entries) {
    if (entry.type !== 'custom' || entry.customType !== BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE) {
      continue;
    }
    const data = parseElicitationScratchpadEntryData(entry.data);
    if (data) latest = data.items;
  }

  return latest;
}

export interface ElicitationScratchpadEntrySessionManager {
  getEntries(): readonly CustomEntryLike[];
  appendCustomEntry(customType: string, data: ElicitationScratchpadEntryData): void;
}

/** Appends a full-replacement snapshot; `items` becomes the entire current scratchpad. */
export function appendElicitationScratchpadSnapshot(
  sessionManager: ElicitationScratchpadEntrySessionManager,
  items: readonly ElicitationScratchpadItem[],
): void {
  sessionManager.appendCustomEntry(BRUNCH_ELICITATION_SCRATCHPAD_CUSTOM_TYPE, {
    schemaVersion: 1,
    items,
  });
}
