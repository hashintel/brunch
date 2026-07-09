import { appendFile, readFile } from 'node:fs/promises';

import { readyPlanSliceIds, type SchedulerPlan } from './orchestrate-topology.js';
import { populatedPlanPath } from './populate.js';
import { reportsPath } from './report.js';
import {
  assertSafeSliceId,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  type RunMetadata,
} from './run.js';

interface PlanSlice {
  readonly id: string;
  readonly epic_id: string;
  readonly depends_on?: SchedulerPlan['slices'] extends readonly (infer Slice)[]
    ? Slice extends { readonly depends_on?: infer DependsOn }
      ? DependsOn
      : readonly string[]
    : readonly string[];
}

interface PlanPayload {
  readonly slices?: readonly PlanSlice[];
}

export type SliceStartResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'reports_not_initialized';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'no_slice';
      readonly runStatus: 'reports_initialized' | 'slice_completed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_started';
      readonly runStatus: 'slice_started';
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

export async function startSlice(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly sliceId?: string;
}): Promise<SliceStartResult> {
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

  // A run is ready for a slice once reports are initialized (first slice) or
  // after a previous slice has completed (subsequent slices).
  if (metadata.status !== 'reports_initialized' && metadata.status !== 'slice_completed') {
    return {
      status: 'reports_not_initialized',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const plan = await readPlan(metadata.populatedPlanPath ?? populatedPlanPath(args.cwd, args.runId));
  const readySliceIds = new Set(readyPlanSliceIds(plan, metadata.completedSliceIds ?? []));
  const slice = args.sliceId
    ? readySliceIds.has(args.sliceId)
      ? plan.slices?.find((candidate) => candidate.id === args.sliceId)
      : undefined
    : plan.slices?.find((candidate) => readySliceIds.has(candidate.id));

  if (!slice) {
    return {
      status: 'no_slice',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      sideEffects: [],
    };
  }
  assertSafeSliceId(slice.id);

  const event = {
    event: 'slice_started',
    runId: args.runId,
    epicId: slice.epic_id,
    sliceId: slice.id,
    status: 'slice_started',
  };
  const updated: RunMetadata = {
    ...metadata,
    status: 'slice_started',
    activeSliceId: slice.id,
    activeEpicId: slice.epic_id,
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'slice_started',
    runStatus: 'slice_started',
    runId: args.runId,
    sliceId: slice.id,
    epicId: slice.epic_id,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}

async function readPlan(path: string): Promise<PlanPayload> {
  return JSON.parse(await readFile(path, 'utf8')) as PlanPayload;
}
