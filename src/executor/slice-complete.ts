import { appendFile } from 'node:fs/promises';

import type { GitSliceIntegrationPort } from './execution-ports.js';
import { sliceCompletionReport } from './isolated-slice-operations.js';
import { reportsPath } from './report.js';
import { withRunExecutionAuthority } from './run-execution-authority.js';
import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';
import { integrateSlice, type SliceIntegrationResult } from './slice-integration.js';

export type SliceCompleteResult =
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
      readonly status: 'test_result_not_ingested';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_completed';
      readonly runStatus: 'slice_completed';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId?: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export interface StandaloneSliceCompleteResult {
  readonly result: SliceCompleteResult | SliceIntegrationResult;
  readonly sideEffects: readonly { readonly kind: string }[];
}

export async function completeStandaloneSlice(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
}): Promise<StandaloneSliceCompleteResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: async () => {
      const integration = await integrateSlice(args);
      const completion =
        integration.status === 'slice_integrated' || integration.status === 'slice_not_ready'
          ? await completeSlice(args)
          : undefined;
      return {
        result: completion ?? integration,
        sideEffects: completion
          ? [...integration.sideEffects, ...completion.sideEffects]
          : integration.sideEffects,
      };
    },
    onContended: async () => {
      const metadataPath = runMetadataPath(args.cwd, args.runId);
      return {
        result: {
          status: 'run_execution_active',
          runStatus: (await readRunMetadata(metadataPath))?.status ?? 'not_started',
          runId: args.runId,
          metadataPath,
          sideEffects: [],
        },
        sideEffects: [],
      };
    },
  });
}

export async function completeSlice(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<SliceCompleteResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => completeSliceOwned(args),
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

async function completeSliceOwned(args: {
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

  if (metadata.status !== 'slice_integrated' || !metadata.activeSliceId) {
    return {
      status: 'test_result_not_ingested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const completedSliceIds = Array.from(
    new Set([...(metadata.completedSliceIds ?? []), metadata.activeSliceId]),
  );
  const event = sliceCompletionReport({
    runId: args.runId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    sliceId: metadata.activeSliceId,
  });
  const updated: RunMetadata = { ...metadata, status: 'slice_completed', completedSliceIds };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'slice_completed',
    runStatus: 'slice_completed',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}
