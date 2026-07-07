import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { TestRunnerPort, TestRunUpdate } from './execution-ports.js';
import { reportsPath } from './report.js';
import {
  assertSafeSliceId,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
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
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'test_result_ingested';
      readonly runStatus: 'test_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId: string;
      readonly verdict: 'passed' | 'failed';
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'append_file'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export type VerifyStreamEvent = TestRunUpdate & {
  readonly event: 'verify_stream';
  readonly runId: string;
  readonly epicId: string;
  readonly sliceId: string;
  readonly sequence: number;
};

export function verifyStreamPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'streams', sliceId, 'verify.jsonl');
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

  if (metadata.status !== 'agent_result_ingested' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'agent_result_not_ingested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const worktreeDir = metadata.worktreeDir ?? worktreeDirPath(args.cwd, args.runId);
  const streamPath = verifyStreamPath(args.cwd, args.runId, metadata.activeSliceId);
  let sequence = 0;
  let wroteStream = false;
  const runResult = await args.testRunner.run({
    worktreeDir,
    ...(metadata.verifyTarget ? { verifyTarget: metadata.verifyTarget } : {}),
    signal: args.signal,
    onUpdate: async (update) => {
      const event: VerifyStreamEvent = {
        event: 'verify_stream',
        runId: args.runId,
        epicId: metadata.activeEpicId!,
        sliceId: metadata.activeSliceId!,
        sequence,
        kind: update.kind,
        message: update.message,
      };
      sequence += 1;
      await mkdir(dirname(streamPath), { recursive: true });
      await appendFile(streamPath, `${JSON.stringify(event)}\n`, 'utf8');
      wroteStream = true;
      try {
        args.onVerifyUpdate?.(event);
      } catch {
        // Observer failures never affect verification execution.
      }
    },
  });
  if (runResult.status === 'failed') {
    return {
      status: 'test_run_failed',
      runStatus: 'agent_result_ingested',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      worktreeDir,
      metadataPath,
      message: runResult.message,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const event = {
    event: 'slice_test_result',
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: runResult.verdict,
    exitCode: runResult.exitCode,
    ...(runResult.target ? { target: runResult.target } : {}),
  };
  const updated: RunMetadata = {
    ...metadata,
    status: 'test_result_ingested',
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'test_result_ingested',
    runStatus: 'test_result_ingested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
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
