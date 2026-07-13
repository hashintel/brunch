import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { TestRunnerPort } from './execution-ports.js';
import { runIsolatedVerifyAttempt, type VerifyStreamEvent } from './isolated-slice-operations.js';
import { SLICE_ATTEMPT_LIMIT } from './orchestrate-topology.js';
import { reportsPath } from './report.js';
import {
  assertSafeSliceId,
  activeSliceAttemptNumber,
  appendSliceAttemptCycle,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  sliceArtifactAttemptNumber,
  type RunMetadata,
} from './run.js';
import { worktreeDirPath } from './worktree.js';

export type TestResultIngestResult =
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
      readonly status: 'test_result_ingested';
      readonly runStatus: 'test_result_ingested';
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
  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const attemptResult = await runIsolatedVerifyAttempt({
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    worktreeDir,
    streamPath,
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
      ...(attempts === SLICE_ATTEMPT_LIMIT
        ? {
            sliceAttemptHistory: appendSliceAttemptCycle(metadata, metadata.activeSliceId, 'verify', {
              outcome: 'exhausted',
              attempts,
            }),
          }
        : {}),
    });
    return {
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
    };
  }

  const { activeSliceAttempts: _cleared, ...metadataWithoutAttempts } = metadata;
  const updated: RunMetadata = {
    ...metadataWithoutAttempts,
    status: 'test_result_ingested',
    sliceAttemptHistory: appendSliceAttemptCycle(metadata, metadata.activeSliceId, 'verify', {
      outcome: 'succeeded',
      attempts: (metadata.activeSliceAttempts ?? 0) + 1,
    }),
  };

  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'test_result_ingested',
    runStatus: 'test_result_ingested',
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
