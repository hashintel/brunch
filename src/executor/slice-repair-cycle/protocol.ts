import { decideCompletedVerification, type CompletedVerificationIntent } from './decision.js';
import {
  appendSliceStageEpoch,
  assertSliceRepairHistory,
  type ActiveSliceRepairContext,
  type PendingSliceRepair,
  type SliceRepairDiagnostic,
  type SliceRepairHistory,
  type SliceRepairStage,
} from './model.js';
import {
  buildPendingSliceRepair,
  materializePendingSliceRepair,
  validateActiveSliceRepair,
  validatePendingSliceRepair,
  type TrustedPendingRepairState,
} from './repair-context.js';

export type CompletedVerificationResolution =
  | Extract<CompletedVerificationIntent, { readonly kind: 'pass' | 'exhaust' }>
  | (Extract<CompletedVerificationIntent, { readonly kind: 'repair' }> & {
      readonly pending: PendingSliceRepair;
    });

export function completeVerification(args: {
  readonly trusted: TrustedPendingRepairState;
  readonly verdict: 'passed' | 'failed';
  readonly cycle: number;
  readonly verifyArtifactOrdinal: number;
  readonly stageAttempt: number;
  readonly exitCode: number;
  readonly stdout: SliceRepairDiagnostic;
  readonly stderr: SliceRepairDiagnostic;
}): CompletedVerificationResolution {
  assertCompletedVerificationEndpoint(args);
  const intent = decideCompletedVerification({
    verdict: args.verdict,
    cycle: args.cycle,
    policy: args.trusted.policy,
  });
  if (intent.kind !== 'repair') return intent;
  if (!args.trusted.target) throw new Error('repair_target_unavailable');
  return {
    ...intent,
    pending: buildPendingSliceRepair({
      runDir: args.trusted.runDir,
      runId: args.trusted.runId,
      sliceId: args.trusted.sliceId,
      nextCycle: intent.nextCycle,
      sourceCycle: intent.sourceCycle,
      sourceVerifyArtifactOrdinal: args.verifyArtifactOrdinal,
      sourceStageAttempt: args.stageAttempt,
      target: args.trusted.target,
      exitCode: args.exitCode,
      stdout: args.stdout,
      stderr: args.stderr,
    }),
  };
}

export async function materializeRepair(args: {
  readonly trusted: TrustedPendingRepairState;
  readonly pending: PendingSliceRepair;
}): Promise<PendingSliceRepair> {
  return materializePendingSliceRepair(args);
}

export function validateRepairAuthority(args: {
  readonly trusted: TrustedPendingRepairState;
  readonly pending: PendingSliceRepair;
}): void {
  validatePendingSliceRepair(args);
}

export function activateRepair(args: {
  readonly trusted: TrustedPendingRepairState;
  readonly pending: PendingSliceRepair;
}): ActiveSliceRepairContext {
  validatePendingSliceRepair(args);
  if (args.pending.phase !== 'materialized') {
    throw new Error('repair context must be materialized before activation');
  }
  return {
    runId: args.pending.runId,
    sliceId: args.pending.sliceId,
    cycle: args.pending.cycle,
    sourceCycle: args.pending.sourceCycle,
    sourceVerifyArtifactOrdinal: args.pending.sourceVerifyArtifactOrdinal,
    sourceStageAttempt: args.pending.sourceStageAttempt,
    path: args.pending.contextPath,
    digest: args.pending.contextDigest,
    target: args.trusted.target!,
  };
}

export async function validateActiveRepair(args: {
  readonly authority: PendingSliceRepair;
  readonly reference: ActiveSliceRepairContext;
  readonly trusted: TrustedPendingRepairState;
}): Promise<import('./model.js').SliceRepairContext> {
  return validateActiveSliceRepair(args);
}

export function admitStageReset(args: {
  readonly history: SliceRepairHistory;
  readonly sliceId: string;
  readonly cycle: number;
  readonly stage: SliceRepairStage;
  readonly policy: TrustedPendingRepairState['policy'];
}): SliceRepairHistory {
  return appendSliceStageEpoch({
    history: args.history,
    sliceId: args.sliceId,
    cycle: args.cycle,
    epoch: { stage: args.stage, outcome: 'reset', attempts: 0 },
    policy: args.policy,
  });
}

function assertCompletedVerificationEndpoint(args: {
  readonly trusted: TrustedPendingRepairState;
  readonly verdict: 'passed' | 'failed';
  readonly cycle: number;
  readonly verifyArtifactOrdinal: number;
  readonly stageAttempt: number;
}): void {
  assertSliceRepairHistory(args.trusted.history, args.trusted.policy);
  const cycle = args.trusted.history[args.trusted.sliceId]?.at(-1);
  const endpoint = cycle?.epochs.at(-1);
  if (
    cycle?.cycle !== args.cycle ||
    endpoint?.stage !== 'verify' ||
    endpoint.outcome !== 'succeeded' ||
    endpoint.verdict !== args.verdict ||
    endpoint.artifactOrdinalEnd !== args.verifyArtifactOrdinal ||
    endpoint.attempts !== args.stageAttempt
  ) {
    throw new Error('completed verification does not match grouped history endpoint');
  }
}
