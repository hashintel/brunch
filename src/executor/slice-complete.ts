import { appendFile } from 'node:fs/promises';

import { readSliceVerificationVerdict } from './report-verdict.js';
import { reportsPath } from './report.js';
import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type SliceCompleteResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'test_result_not_ingested';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_verification_failed';
      readonly runStatus: 'test_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_completed';
      readonly runStatus: 'slice_completed';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export async function completeSlice(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<SliceCompleteResult> {
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

  if (metadata.status !== 'test_result_ingested' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'test_result_not_ingested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const verdict = await readSliceVerificationVerdict({
    reportsPath: reportPath,
    expectedSliceIds: [metadata.activeSliceId],
  });
  if (verdict.status !== 'passed') {
    return {
      status: 'slice_verification_failed',
      runStatus: 'test_result_ingested',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      metadataPath,
      reportsPath: reportPath,
      sideEffects: [],
    };
  }

  const completedSliceIds = Array.from(
    new Set([...(metadata.completedSliceIds ?? []), metadata.activeSliceId]),
  );
  const event = {
    event: 'slice_completed',
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: 'slice_completed',
  };
  const updated: RunMetadata = { ...metadata, status: 'slice_completed', completedSliceIds };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'slice_completed',
    runStatus: 'slice_completed',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}
