import { appendFile, readFile } from 'node:fs/promises';

import { populatedPlanPath } from './populate.js';
import { reportsPath } from './report.js';
import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

interface PlanSlice {
  readonly id: string;
}
interface PlanPayload {
  readonly slices?: readonly PlanSlice[];
}

export type RunCompleteResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slices_incomplete';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly completedSliceIds: readonly string[];
      readonly expectedSliceIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'already_completed';
      readonly runStatus: 'run_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_completed';
      readonly runStatus: 'run_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export async function completeRun(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<RunCompleteResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata)
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };

  if (metadata.status === 'run_completed') {
    return {
      status: 'already_completed',
      runStatus: 'run_completed',
      runId: args.runId,
      metadataPath,
      reportsPath: metadata.reportsPath ?? reportsPath(args.cwd, args.runId),
      sideEffects: [],
    };
  }

  const plan = await readPlan(metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId));
  const expectedSliceIds = (plan.slices ?? []).map((slice) => slice.id);
  const completedSliceIds = metadata.completedSliceIds ?? [];
  const complete = expectedSliceIds.every((id) => completedSliceIds.includes(id));
  if (!complete) {
    return {
      status: 'slices_incomplete',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      completedSliceIds,
      expectedSliceIds,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const event = { event: 'run_completed', runId: args.runId, status: 'run_completed' };
  const updated: RunMetadata = { ...metadata, status: 'run_completed' };
  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'run_completed',
    runStatus: 'run_completed',
    runId: args.runId,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}

async function readPlan(path: string): Promise<PlanPayload> {
  return JSON.parse(await readFile(path, 'utf8')) as PlanPayload;
}
