export const BRUNCH_PROCESS_MOVE_CUSTOM_TYPE = 'brunch.process_move';

export const PROCESS_MOVES = [
  'move_to_execution',
  'prepare_execution',
  'compile_plan',
  'execute_plan',
] as const;
export type ProcessMove = (typeof PROCESS_MOVES)[number];

export interface ProcessMoveEntryData {
  readonly schemaVersion: 1;
  readonly move: ProcessMove;
}

interface CustomEntryLike {
  readonly type?: unknown;
  readonly customType?: unknown;
  readonly data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProcessMoveEntryData(value: unknown): ProcessMoveEntryData | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1) return undefined;
  if (typeof value.move !== 'string' || !(PROCESS_MOVES as readonly string[]).includes(value.move))
    return undefined;
  return { schemaVersion: 1, move: value.move as ProcessMove };
}

export function freshProcessMove(
  entries: readonly CustomEntryLike[],
  kickCustomType: string,
): ProcessMove | undefined {
  let lastKick = -1;
  for (let index = entries.length - 1; index >= 0; index--) {
    if (entries[index]!.customType === kickCustomType) {
      lastKick = index;
      break;
    }
  }
  for (let index = entries.length - 1; index > lastKick; index--) {
    const entry = entries[index]!;
    if (entry.type !== 'custom' || entry.customType !== BRUNCH_PROCESS_MOVE_CUSTOM_TYPE) continue;
    const parsed = parseProcessMoveEntryData(entry.data);
    if (parsed) return parsed.move;
  }
  return undefined;
}

export interface ProcessMoveEntryManager {
  appendCustomEntry(customType: string, data: ProcessMoveEntryData): void;
}

export function appendProcessMoveEntry(manager: ProcessMoveEntryManager, move: ProcessMove): void {
  manager.appendCustomEntry(BRUNCH_PROCESS_MOVE_CUSTOM_TYPE, { schemaVersion: 1, move });
}
