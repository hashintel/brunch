import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TestRunnerPort } from './execution-ports.js';
import {
  attachIsolatedAttemptOutcome,
  mergeAttemptHistory,
  runIsolatedVerifyAttempt,
  type VerifyStreamEvent,
} from './isolated-slice-operations.js';
import { reportsPath } from './report.js';
import { withRunExecutionAuthority } from './run-execution-authority.js';
import {
  assertSafeSliceId,
  activeSliceRepairCycle,
  activeSliceAttemptNumber,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  sliceArtifactAttemptNumber,
  type RunMetadata,
} from './run.js';
import { MAX_STAGE_ATTEMPTS, sliceRepairProtocol, type PendingSliceRepair } from './slice-repair-cycle.js';
import { worktreeDirPath } from './worktree.js';

export type TestResultIngestResult =
  | {
      readonly status: 'run_execution_active';
      readonly runStatus: RunMetadata['status'] | 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'agent_result_not_ingested';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'test_run_failed';
      readonly runStatus: 'agent_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly attempts: number;
      readonly sideEffects: readonly (
        | { readonly kind: 'append_file'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    }
  | {
      readonly status: 'test_result_ingested' | 'slice_repair_requested';
      readonly runStatus: 'test_result_ingested' | 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId?: string;
      readonly verdict: 'passed' | 'failed';
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'append_file'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export function verifyStreamPath(cwd: string, runId: string, sliceId: string, attempt = 1): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'streams', sliceId, `verify-attempt-${attempt}.jsonl`);
}

export async function ingestTestResult(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly testRunner: TestRunnerPort;
  readonly signal?: AbortSignal | undefined;
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
}): Promise<TestResultIngestResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => ingestTestResultOwned(args),
    onContended: async () => {
      const metadataPath = runMetadataPath(args.cwd, args.runId);
      return {
        status: 'run_execution_active',
        runStatus: (await readRunMetadata(metadataPath))?.status ?? 'not_started',
        runId: args.runId,
        metadataPath,
        sideEffects: [],
      };
    },
  });
}

async function ingestTestResultOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly testRunner: TestRunnerPort;
  readonly signal?: AbortSignal | undefined;
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
}): Promise<TestResultIngestResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  if (metadata.pendingSliceRepair) {
    const pendingSliceRepair = await sliceRepairProtocol.materializeRepair({
      pending: metadata.pendingSliceRepair,
      trusted: {
        runDir: runDirPath(args.cwd, args.runId),
        runId: args.runId,
        sliceId: metadata.activeSliceId!,
        target: metadata.verifyTarget!,
        policy: sliceRepairProtocol.policy,
        history: metadata.sliceRepairHistory!,
      },
    });
    const updated: RunMetadata = {
      ...metadata,
      status: 'slice_execution_requested',
      pendingSliceRepair,
    };
    const metadataEffect = await persistRunMetadata(metadataPath, updated);
    return {
      status: 'slice_repair_requested',
      runStatus: 'slice_execution_requested',
      runId: args.runId,
      sliceId: metadata.activeSliceId!,
      ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
      verdict: 'failed',
      worktreeDir:
        metadata.activeSliceWorkspaceDir ?? metadata.worktreeDir ?? worktreeDirPath(args.cwd, args.runId),
      metadataPath,
      reportsPath: metadata.reportsPath ?? reportsPath(args.cwd, args.runId),
      sideEffects: [metadataEffect],
    };
  }

  if (metadata.status !== 'agent_result_ingested' || !metadata.activeSliceId) {
    return {
      status: 'agent_result_not_ingested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const worktreeDir =
    metadata.activeSliceWorkspaceDir ?? metadata.worktreeDir ?? worktreeDirPath(args.cwd, args.runId);
  const streamPath = verifyStreamPath(
    args.cwd,
    args.runId,
    metadata.activeSliceId,
    sliceArtifactAttemptNumber(metadata, metadata.activeSliceId, 'verify'),
  );
  const cycle = activeSliceRepairCycle(metadata);
  const artifactAttempt = sliceArtifactAttemptNumber(metadata, metadata.activeSliceId, 'verify');
  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const attemptResult = await runIsolatedVerifyAttempt({
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    worktreeDir,
    streamPath,
    cycle,
    attempt: activeSliceAttemptNumber(metadata),
    artifactAttempt,
    testRunner: args.testRunner,
    ...(metadata.verifyTarget ? { verifyTarget: metadata.verifyTarget } : {}),
    ...(args.signal ? { signal: args.signal } : {}),
    recordReport: (event) => appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8'),
    ...(args.onVerifyUpdate ? { onUpdate: args.onVerifyUpdate } : {}),
  });
  const runResult = attemptResult.result;
  const wroteStream = attemptResult.wroteStream;
  if (runResult.status === 'failed') {
    const attempts = activeSliceAttemptNumber(metadata);
    const metadataEffect = await persistRunMetadata(metadataPath, {
      ...metadata,
      activeSliceAttempts: attempts,
      ...(attempts === MAX_STAGE_ATTEMPTS
        ? {
            sliceRepairHistory: mergeAttemptHistory(
              metadata.sliceRepairHistory,
              attemptResult.outcome.historyDelta,
            ),
          }
        : {}),
    });
    return attachIsolatedAttemptOutcome(
      {
        status: 'test_run_failed',
        runStatus: 'agent_result_ingested',
        runId: args.runId,
        sliceId: metadata.activeSliceId,
        worktreeDir,
        metadataPath,
        message: runResult.message,
        attempts,
        sideEffects: [
          ...(wroteStream ? [{ kind: 'append_file' as const, path: streamPath }] : []),
          metadataEffect,
        ],
      },
      attemptResult.outcome,
    );
  }

  // ceiling: the external verifier can finish before this first durable pending
  // descriptor write; close with a claimed-effect receipt if split-process
  // crash recovery must cover that pre-pending window.
  const { activeSliceAttempts: _cleared, ...metadataWithoutAttempts } = metadata;
  const sliceRepairHistory = mergeAttemptHistory(
    metadata.sliceRepairHistory,
    attemptResult.outcome.historyDelta,
  );
  const trustedRepairState = {
    runDir: runDirPath(args.cwd, args.runId),
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.verifyTarget === undefined ? {} : { target: metadata.verifyTarget }),
    policy: sliceRepairProtocol.policy,
    history: sliceRepairHistory,
  };
  const decision = sliceRepairProtocol.completeVerification({
    trusted: trustedRepairState,
    verdict: runResult.verdict,
    cycle,
    verifyArtifactOrdinal: artifactAttempt,
    stageAttempt: activeSliceAttemptNumber(metadata),
    exitCode: runResult.exitCode,
    stdout: attemptResult.diagnostics.stdout,
    stderr: attemptResult.diagnostics.stderr,
  });
  let pendingRepair: PendingSliceRepair | undefined;
  let updated: RunMetadata;
  if (decision.kind === 'repair') {
    pendingRepair = decision.pending;
    const {
      activeSliceRepairContext: _activeSliceRepairContext,
      activeSliceRepairAuthority: _activeSliceRepairAuthority,
      ...metadataWithoutActiveRepair
    } = metadataWithoutAttempts;
    const pendingState: RunMetadata = {
      ...metadataWithoutActiveRepair,
      status: 'agent_result_ingested',
      sliceRepairHistory,
      pendingSliceRepair: pendingRepair,
    };
    await persistRunMetadata(metadataPath, pendingState);
    const materialized = await sliceRepairProtocol.materializeRepair({
      pending: pendingRepair,
      trusted: trustedRepairState,
    });
    updated = {
      ...pendingState,
      status: 'slice_execution_requested',
      pendingSliceRepair: materialized,
    };
  } else {
    const failedSliceIds =
      decision.kind === 'exhaust'
        ? [...new Set([...(metadata.failedSliceIds ?? []), metadata.activeSliceId])]
        : metadata.failedSliceIds;
    updated = {
      ...clearFailedActiveSlice(metadataWithoutAttempts, decision.kind === 'exhaust' ? 'failed' : 'passed'),
      status: 'test_result_ingested',
      sliceRepairHistory,
      ...(failedSliceIds === undefined ? {} : { failedSliceIds }),
    };
  }

  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: decision.kind === 'repair' ? 'slice_repair_requested' : 'test_result_ingested',
    runStatus: updated.status as 'test_result_ingested' | 'slice_execution_requested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    verdict: runResult.verdict,
    worktreeDir,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [
      ...(wroteStream ? [{ kind: 'append_file' as const, path: streamPath }] : []),
      { kind: 'append_file', path: reportPath },
      metadataEffect,
    ],
  };
}

function clearFailedActiveSlice(metadata: RunMetadata, verdict: 'passed' | 'failed'): RunMetadata {
  const {
    pendingSliceRepair: _pendingSliceRepair,
    activeSliceRepairContext: _activeSliceRepairContext,
    activeSliceRepairAuthority: _activeSliceRepairAuthority,
    ...withoutRepair
  } = metadata;
  if (verdict === 'passed') return withoutRepair;
  const {
    activeSliceId: _activeSliceId,
    activeEpicId: _activeEpicId,
    activeSliceWorkspaceDir: _activeSliceWorkspaceDir,
    activeSliceBaseSha: _activeSliceBaseSha,
    ...cleared
  } = withoutRepair;
  return cleared;
}
