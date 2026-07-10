export interface PetriProjection {
  readonly claimedTransitionIds?: readonly string[];
  readonly currentMarking: Record<string, number>;
  readonly firedTransitionCount: number;
  readonly terminalEventKind?: 'net_completed' | 'net_halted' | 'net_deadlocked';
  readonly haltedReason?: string;
}

export function parsePetriProjection(value: unknown): PetriProjection | undefined {
  if (!isRecord(value) || !isRecord(value.currentMarking)) return undefined;
  if (
    typeof value.firedTransitionCount !== 'number' ||
    !Number.isInteger(value.firedTransitionCount) ||
    value.firedTransitionCount < 0
  ) {
    return undefined;
  }

  const currentMarking: Record<string, number> = {};
  for (const [placeId, count] of Object.entries(value.currentMarking)) {
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 0) return undefined;
    if (count > 0) currentMarking[placeId] = count;
  }

  const claimedTransitionIds = value.claimedTransitionIds;
  if (claimedTransitionIds !== undefined && !isStringArray(claimedTransitionIds)) return undefined;

  const terminalEventKind =
    value.terminalEventKind === 'net_completed' ||
    value.terminalEventKind === 'net_halted' ||
    value.terminalEventKind === 'net_deadlocked'
      ? value.terminalEventKind
      : undefined;
  if (value.terminalEventKind !== undefined && terminalEventKind === undefined) return undefined;

  const haltedReason = typeof value.haltedReason === 'string' ? value.haltedReason : undefined;
  if (value.haltedReason !== undefined && haltedReason === undefined) return undefined;
  if (terminalEventKind === 'net_halted' && haltedReason === undefined) return undefined;
  if (terminalEventKind !== 'net_halted' && haltedReason !== undefined) return undefined;

  return {
    ...(claimedTransitionIds === undefined ? {} : { claimedTransitionIds }),
    currentMarking,
    firedTransitionCount: value.firedTransitionCount,
    ...(terminalEventKind === undefined ? {} : { terminalEventKind }),
    ...(haltedReason === undefined ? {} : { haltedReason }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}
