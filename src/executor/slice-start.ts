import { appendFile, readFile } from 'node:fs/promises';

import { populatedPlanPath } from './populate.js';
import { reportsPath } from './report.js';
import {
  cookRunMetadataPath,
  persistCookRunMetadata,
  readCookRunMetadata,
  type CookRunMetadata,
} from './run.js';

interface PlanSlice {
  readonly id: string;
  readonly epic_id: string;
}

interface CookPlanPayload {
  readonly slices?: readonly PlanSlice[];
}

export type CookSliceStartResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'reports_not_initialized';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'no_slice';
      readonly runStatus: 'reports_initialized';
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

export async function startCookSlice(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly sliceId?: string;
}): Promise<CookSliceStartResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
  const metadata = await readCookRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  if (metadata.status !== 'reports_initialized') {
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
  const slice = args.sliceId
    ? plan.slices?.find((candidate) => candidate.id === args.sliceId)
    : plan.slices?.[0];

  if (!slice) {
    return {
      status: 'no_slice',
      runStatus: 'reports_initialized',
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      sideEffects: [],
    };
  }

  const event = {
    event: 'slice_started',
    runId: args.runId,
    epicId: slice.epic_id,
    sliceId: slice.id,
    status: 'slice_started',
  };
  const updated: CookRunMetadata = {
    ...metadata,
    status: 'slice_started',
    activeSliceId: slice.id,
    activeEpicId: slice.epic_id,
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistCookRunMetadata(metadataPath, updated);

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

async function readPlan(path: string): Promise<CookPlanPayload> {
  return JSON.parse(await readFile(path, 'utf8')) as CookPlanPayload;
}
