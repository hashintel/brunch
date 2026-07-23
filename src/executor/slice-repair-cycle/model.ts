export type SliceRepairStage = 'agent' | 'verify';

export interface SliceRepairPolicy {
  readonly maxRepairCycles: number;
  readonly maxStageAttempts: number;
}

export interface SliceStageEpoch {
  readonly stage: SliceRepairStage;
  readonly outcome: 'succeeded' | 'exhausted' | 'reset';
  readonly attempts: number;
  readonly artifactOrdinalStart?: number;
  readonly artifactOrdinalEnd?: number;
  readonly verdict?: 'passed' | 'failed';
}

export interface SliceRepairCycleRecord {
  readonly cycle: number;
  readonly epochs: readonly SliceStageEpoch[];
}

export type SliceRepairHistory = Readonly<Record<string, readonly SliceRepairCycleRecord[]>>;

export interface SliceRepairHistoryDelta {
  readonly sliceId: string;
  readonly cycle: number;
  readonly epoch: SliceStageEpoch;
}

export interface SliceRepairTarget {
  readonly command: string;
  readonly args: readonly string[];
}

export interface SliceRepairDiagnostic {
  readonly text: string;
  readonly utf8Bytes: number;
  readonly truncated: boolean;
}

export interface SliceRepairContext {
  readonly version: 1;
  readonly runId: string;
  readonly sliceId: string;
  readonly cycle: number;
  readonly source: {
    readonly cycle: number;
    readonly verifyArtifactOrdinal: number;
    readonly stageAttempt: number;
  };
  readonly target: SliceRepairTarget;
  readonly targetDigest: string;
  readonly diagnostic: {
    readonly exitCode: number;
    readonly stdout: SliceRepairDiagnostic;
    readonly stderr: SliceRepairDiagnostic;
  };
}

export interface PendingSliceRepair {
  readonly phase: 'pending' | 'materialized';
  readonly runId: string;
  readonly sliceId: string;
  readonly cycle: number;
  readonly sourceCycle: number;
  readonly sourceVerifyArtifactOrdinal: number;
  readonly sourceStageAttempt: number;
  readonly contextPath: string;
  readonly contextDigest: string;
  /** Exact canonical UTF-8 payload. Durable authority stores these bytes before materialization. */
  readonly contextBytes: string;
}

export interface ActiveSliceRepairContext {
  readonly runId: string;
  readonly sliceId: string;
  readonly cycle: number;
  readonly sourceCycle: number;
  readonly sourceVerifyArtifactOrdinal: number;
  readonly sourceStageAttempt: number;
  readonly path: string;
  readonly digest: string;
  readonly target: SliceRepairTarget;
}

export const DEFAULT_SLICE_REPAIR_POLICY: SliceRepairPolicy = {
  maxRepairCycles: 3,
  maxStageAttempts: 3,
};

export function assertSliceRepairPolicy(policy: SliceRepairPolicy): void {
  assertPositiveInteger('maxRepairCycles', policy.maxRepairCycles);
  assertPositiveInteger('maxStageAttempts', policy.maxStageAttempts);
}

export function assertSliceRepairHistory(
  history: SliceRepairHistory | undefined,
  policy: SliceRepairPolicy,
): void {
  assertSliceRepairPolicy(policy);
  for (const [sliceId, cycles] of Object.entries(history ?? {})) {
    if (!isSafeIdentity(sliceId) || !Array.isArray(cycles) || cycles.length === 0) {
      throw new Error('invalid slice repair history');
    }
    let lastArtifactOrdinal: Record<SliceRepairStage, number> = { agent: 0, verify: 0 };
    for (const [index, cycle] of cycles.entries()) {
      if (cycle.cycle !== index + 1 || cycle.cycle > policy.maxRepairCycles) {
        throw new Error(`non-contiguous repair cycles for ${sliceId}`);
      }
      if (!Array.isArray(cycle.epochs) || cycle.epochs.length === 0) {
        throw new Error(`invalid repair epochs for ${sliceId}`);
      }
      validateCycle(sliceId, cycle, lastArtifactOrdinal, index < cycles.length - 1, policy);
      for (const epoch of cycle.epochs) {
        if (epoch.outcome !== 'reset') {
          lastArtifactOrdinal = {
            ...lastArtifactOrdinal,
            [epoch.stage]: epoch.artifactOrdinalEnd!,
          };
        }
      }
    }
  }
}

export function appendSliceStageEpoch(args: {
  readonly history: SliceRepairHistory | undefined;
  readonly sliceId: string;
  readonly cycle: number;
  readonly epoch: SliceStageEpoch;
  readonly policy: SliceRepairPolicy;
}): SliceRepairHistory {
  assertSliceRepairHistory(args.history, args.policy);
  const cycles = [...(args.history?.[args.sliceId] ?? [])];
  const expectedCycle = cycles.length === 0 ? 1 : cycles.at(-1)!.cycle;
  if (args.cycle !== expectedCycle && args.cycle !== expectedCycle + 1) {
    throw new Error(`non-contiguous repair cycle append for ${args.sliceId}`);
  }
  if (args.cycle === expectedCycle + 1) {
    if (cycleVerdict(cycles.at(-1)) !== 'failed') {
      throw new Error(`repair cycle ${args.cycle} does not follow a failed verdict`);
    }
    cycles.push({ cycle: args.cycle, epochs: [args.epoch] });
  } else if (cycles.length === 0) {
    cycles.push({ cycle: 1, epochs: [args.epoch] });
  } else {
    cycles[cycles.length - 1] = {
      cycle: args.cycle,
      epochs: [...cycles.at(-1)!.epochs, args.epoch],
    };
  }
  const next = { ...args.history, [args.sliceId]: cycles };
  assertSliceRepairHistory(next, args.policy);
  return next;
}

export function mergeSliceRepairHistory(
  left: SliceRepairHistory | undefined,
  right: SliceRepairHistory,
  policy: SliceRepairPolicy,
): SliceRepairHistory {
  let merged = left ?? {};
  assertSliceRepairHistory(merged, policy);
  assertSliceRepairHistory(right, policy);
  for (const [sliceId, cycles] of Object.entries(right)) {
    for (const cycle of cycles) {
      for (const epoch of cycle.epochs) {
        merged = appendSliceStageEpoch({
          history: merged,
          sliceId,
          cycle: cycle.cycle,
          epoch,
          policy,
        });
      }
    }
  }
  return merged;
}

export function currentRepairCycle(history: SliceRepairHistory | undefined, sliceId: string): number {
  return history?.[sliceId]?.at(-1)?.cycle ?? 1;
}

export function nextArtifactOrdinal(
  history: SliceRepairHistory | undefined,
  sliceId: string,
  stage: SliceRepairStage,
  policy: SliceRepairPolicy,
): number {
  assertSliceRepairHistory(history, policy);
  const endpoint = (history?.[sliceId] ?? []).reduce(
    (latest, cycle) =>
      cycle.epochs.reduce(
        (cycleLatest, epoch) =>
          epoch.stage === stage && epoch.outcome !== 'reset'
            ? Math.max(cycleLatest, epoch.artifactOrdinalEnd!)
            : cycleLatest,
        latest,
      ),
    0,
  );
  return endpoint + 1;
}

export function cycleVerdict(cycle: SliceRepairCycleRecord | undefined): 'passed' | 'failed' | undefined {
  return [...(cycle?.epochs ?? [])]
    .reverse()
    .find((epoch) => epoch.stage === 'verify' && epoch.verdict !== undefined)?.verdict;
}

function validateCycle(
  sliceId: string,
  cycle: SliceRepairCycleRecord,
  priorArtifactOrdinal: Record<SliceRepairStage, number>,
  requiresFailedVerdict: boolean,
  policy: SliceRepairPolicy,
): void {
  let phase: SliceRepairStage = 'agent';
  let previous: SliceStageEpoch | undefined;
  let verdictCount = 0;
  let stageEndpoint = { ...priorArtifactOrdinal };
  for (const [index, epoch] of cycle.epochs.entries()) {
    if (!isEpoch(epoch)) throw new Error(`invalid repair epoch for ${sliceId}`);
    if (epoch.stage !== phase) throw new Error(`illegal agent/verify ordering for ${sliceId}`);
    if (epoch.outcome === 'reset') {
      if (
        epoch.attempts !== 0 ||
        epoch.artifactOrdinalStart !== undefined ||
        epoch.artifactOrdinalEnd !== undefined ||
        epoch.verdict !== undefined ||
        previous?.stage !== epoch.stage ||
        previous.outcome !== 'exhausted'
      ) {
        throw new Error(`reset without same-stage exhaustion for ${sliceId}`);
      }
    } else {
      if (
        !Number.isInteger(epoch.attempts) ||
        epoch.attempts < 1 ||
        epoch.artifactOrdinalStart === undefined ||
        epoch.artifactOrdinalEnd === undefined ||
        !Number.isInteger(epoch.artifactOrdinalStart) ||
        !Number.isInteger(epoch.artifactOrdinalEnd) ||
        epoch.attempts > policy.maxStageAttempts ||
        (epoch.outcome === 'exhausted' && epoch.attempts !== policy.maxStageAttempts) ||
        epoch.artifactOrdinalStart <= stageEndpoint[epoch.stage] ||
        epoch.artifactOrdinalEnd !== epoch.artifactOrdinalStart + epoch.attempts - 1
      ) {
        throw new Error(`overlapping or invalid artifact range for ${sliceId}`);
      }
      stageEndpoint = { ...stageEndpoint, [epoch.stage]: epoch.artifactOrdinalEnd };
      if (epoch.outcome === 'exhausted' && epoch.verdict !== undefined) {
        throw new Error(`exhaustion cannot carry a verdict for ${sliceId}`);
      }
      if (epoch.stage === 'agent' && epoch.verdict !== undefined) {
        throw new Error(`agent epoch cannot carry a verdict for ${sliceId}`);
      }
      if (epoch.stage === 'verify' && epoch.outcome === 'succeeded') {
        if (epoch.verdict === undefined) throw new Error(`verify success requires verdict for ${sliceId}`);
        verdictCount += 1;
        if (verdictCount > 1 || index !== cycle.epochs.length - 1) {
          throw new Error(`repair cycle has multiple or non-final verdicts for ${sliceId}`);
        }
      }
      if (epoch.stage === 'agent' && epoch.outcome === 'succeeded') phase = 'verify';
    }
    if (previous?.outcome === 'exhausted' && epoch.outcome !== 'reset') {
      throw new Error(`exhaustion must be followed by reset for ${sliceId}`);
    }
    if (previous?.outcome === 'reset' && epoch.outcome === 'reset') {
      throw new Error(`consecutive resets are invalid for ${sliceId}`);
    }
    previous = epoch;
  }
  if (requiresFailedVerdict && cycleVerdict(cycle) !== 'failed') {
    throw new Error(`repair cycle ${cycle.cycle} must end in a failed verdict`);
  }
}

function isEpoch(value: unknown): value is SliceStageEpoch {
  if (!isRecord(value)) return false;
  return (
    (value.stage === 'agent' || value.stage === 'verify') &&
    (value.outcome === 'succeeded' || value.outcome === 'exhausted' || value.outcome === 'reset') &&
    typeof value.attempts === 'number' &&
    (value.artifactOrdinalStart === undefined || typeof value.artifactOrdinalStart === 'number') &&
    (value.artifactOrdinalEnd === undefined || typeof value.artifactOrdinalEnd === 'number') &&
    (value.verdict === undefined || value.verdict === 'passed' || value.verdict === 'failed')
  );
}

function assertPositiveInteger(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) throw new Error(`invalid ${label}`);
}

function isSafeIdentity(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && !value.includes('..');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
