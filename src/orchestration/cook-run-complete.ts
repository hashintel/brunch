import { appendFile, readFile, writeFile } from 'node:fs/promises';

import { populatedPlanPath } from './cook-populate.js';
import { reportsPath } from './cook-report.js';
import { cookRunMetadataPath, type CookRunMetadata } from './cook-run.js';

interface PlanSlice {
  readonly id: string;
}
interface CookPlanPayload {
  readonly slices?: readonly PlanSlice[];
}

export type CookRunCompleteResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slices_incomplete';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly completedSliceIds: readonly string[];
      readonly expectedSliceIds: readonly string[];
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

export async function completeCookRun(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookRunCompleteResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata)
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };

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
  const updated: CookRunMetadata = { ...metadata, status: 'run_completed' };
  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  return {
    status: 'run_completed',
    runStatus: 'run_completed',
    runId: args.runId,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [
      { kind: 'append_file', path: reportPath },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}

async function readRunMetadata(path: string): Promise<CookRunMetadata | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CookRunMetadata;
  } catch {
    return undefined;
  }
}

async function readPlan(path: string): Promise<CookPlanPayload> {
  return JSON.parse(await readFile(path, 'utf8')) as CookPlanPayload;
}
