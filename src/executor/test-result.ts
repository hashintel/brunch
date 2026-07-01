import { appendFile } from 'node:fs/promises';

import type { TestRunnerPort } from './execution-ports.js';
import { reportsPath } from './report.js';
import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';
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
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export async function ingestTestResult(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly testRunner: TestRunnerPort;
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
  const runResult = await args.testRunner.run({ worktreeDir });
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
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}
