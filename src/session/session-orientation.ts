/**
 * Session orientation — the deterministic, product-owned choice dialog that
 * routes an assistant-originated kick turn without spending a model turn
 * asking (session-entry-orientation frontier, decision-flow chart §Choice
 * schema).
 *
 * Mirrors `elicitation-scratchpad.ts`'s fold pattern: one custom entry type,
 * one append helper, one fold function reconstructing the latest choice from
 * the session branch. Unlike the scratchpad, orientation entries are a
 * historical log (one per juncture resolution), not a replace-in-place
 * snapshot — so the fold here returns the *latest* entry, and a staleness
 * helper additionally checks it against the last-fired kick so a choice
 * recorded before an earlier kick never re-routes a later one.
 *
 * Not an exchange (D37-L): this module never emits present_ or request_
 * tool results. The dialog is product chrome, and the entry is ledger-only
 * (`appendCustomEntry`), never provider-visible.
 */

export const BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE = 'brunch.session_orientation';

/** Canonical choice ids (decision-flow chart §Choice schema — single source). */
export type SessionOrientationChoice =
  | 'continue'
  | 'elicit_decisions'
  | 'elicit_examples'
  | 'propose_intent'
  | 'propose_design'
  | 'propose_oracle'
  | 'ingest'
  | 'proceed'
  | 'backfill'
  | 'design_first'
  | 'oracle_first'
  | 'project_plan';

export const SESSION_ORIENTATION_CHOICES: readonly SessionOrientationChoice[] = [
  'continue',
  'elicit_decisions',
  'elicit_examples',
  'propose_intent',
  'propose_design',
  'propose_oracle',
  'ingest',
  'proceed',
  'backfill',
  'design_first',
  'oracle_first',
  'project_plan',
];

/** Which juncture (decision-flow chart J1-J6) produced the resolution. */
export type SessionOrientationTrigger = 'entry' | 'switch' | 'tree' | 'abort' | 'mode-switch' | 'consult';

export interface SessionOrientationEntryData {
  readonly schemaVersion: 1;
  readonly choice: SessionOrientationChoice;
  readonly trigger: SessionOrientationTrigger;
}

interface CustomEntryLike {
  type?: unknown;
  customType?: unknown;
  data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isChoice(value: unknown): value is SessionOrientationChoice {
  return typeof value === 'string' && (SESSION_ORIENTATION_CHOICES as readonly string[]).includes(value);
}

const TRIGGERS: readonly SessionOrientationTrigger[] = [
  'entry',
  'switch',
  'tree',
  'abort',
  'mode-switch',
  'consult',
];

function isTrigger(value: unknown): value is SessionOrientationTrigger {
  return typeof value === 'string' && (TRIGGERS as readonly string[]).includes(value);
}

export function parseSessionOrientationEntryData(value: unknown): SessionOrientationEntryData | undefined {
  if (!isRecord(value)) return undefined;
  if (value.schemaVersion !== 1) return undefined;
  if (!isChoice(value.choice)) return undefined;
  if (!isTrigger(value.trigger)) return undefined;
  return { schemaVersion: 1, choice: value.choice, trigger: value.trigger };
}

export interface LatestSessionOrientation {
  readonly data: SessionOrientationEntryData;
  /** Index of the entry within the provided entries array (branch position). */
  readonly index: number;
}

/**
 * Reconstructs the latest resolved orientation entry from the session
 * branch. Invalid entries and entries of other custom types are ignored
 * (mirrors `latestElicitationScratchpad`).
 */
export function latestSessionOrientation(
  entries: readonly CustomEntryLike[],
): LatestSessionOrientation | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    if (entry.type !== 'custom' || entry.customType !== BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE) continue;
    const data = parseSessionOrientationEntryData(entry.data);
    if (data) return { data, index };
  }
  return undefined;
}

/**
 * The latest orientation choice, but only when it is fresh relative to the
 * last-fired kick (`brunch.kick` custom_message entry): a choice recorded
 * before an earlier kick fired must never re-route a later kick's seed
 * (chart §Kick-composition endpoint consumption rule).
 */
export function freshSessionOrientationChoice(
  entries: readonly CustomEntryLike[],
  kickCustomType: string,
): SessionOrientationChoice | undefined {
  const latest = latestSessionOrientation(entries);
  if (!latest) return undefined;

  const lastKickIndex = lastIndexOfCustomType(entries, kickCustomType);
  if (lastKickIndex !== undefined && lastKickIndex >= latest.index) return undefined;

  return latest.data.choice;
}

function lastIndexOfCustomType(entries: readonly CustomEntryLike[], customType: string): number | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    if (entry.customType === customType) return index;
  }
  return undefined;
}

export interface SessionOrientationEntrySessionManager {
  appendCustomEntry(customType: string, data: SessionOrientationEntryData): void;
}

/** Appends one orientation resolution to the branch (append-only log, never a snapshot). */
export function appendSessionOrientationEntry(
  sessionManager: SessionOrientationEntrySessionManager,
  resolution: { readonly choice: SessionOrientationChoice; readonly trigger: SessionOrientationTrigger },
): void {
  sessionManager.appendCustomEntry(BRUNCH_SESSION_ORIENTATION_CUSTOM_TYPE, {
    schemaVersion: 1,
    choice: resolution.choice,
    trigger: resolution.trigger,
  });
}
