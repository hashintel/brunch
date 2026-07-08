import { access, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { prepareLaunch, type LaunchCurrentProjection, type LaunchResult } from './launch.js';
import type { PlanFileProvenance } from './plan-file.js';
import { readRunMetadata, runMetadataPath } from './run.js';

export type RunFreshnessStatus =
  | 'missing_run'
  | 'invalid_plan_path'
  | 'run_plan_missing'
  | 'run_projection_blocked'
  | 'run_provenance_missing'
  | 'run_plan_stale'
  | 'run_fresh';

export type RunFreshnessResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: Exclude<RunFreshnessStatus, 'missing_run'>;
      readonly runStatus: LaunchResult['runStatus'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly planPath: string;
      readonly launch: LaunchResult;
      readonly sideEffects: readonly [];
    };

export async function checkRunFreshness(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly current: LaunchCurrentProjection;
}): Promise<RunFreshnessResult> {
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

  if (metadata.populatedPlanPath) {
    return checkPopulatedRunFreshness({
      runId: args.runId,
      metadataPath,
      planPath: metadata.populatedPlanPath,
      provenancePath:
        metadata.populatedPlanProvenancePath ??
        join(dirname(metadata.populatedPlanPath), 'plan.provenance.json'),
      current: args.current,
    });
  }

  const launch = await prepareLaunch({
    cwd: args.cwd,
    specId: metadata.specId,
    planPath: metadata.planPath,
    current: args.current,
  });

  return {
    status: runFreshnessStatusForLaunch(launch.status),
    runStatus: launch.runStatus,
    runId: args.runId,
    metadataPath,
    planPath: metadata.planPath,
    launch,
    sideEffects: [],
  };
}

async function checkPopulatedRunFreshness(args: {
  readonly runId: string;
  readonly metadataPath: string;
  readonly planPath: string;
  readonly provenancePath: string;
  readonly current: LaunchCurrentProjection;
}): Promise<Exclude<RunFreshnessResult, { readonly status: 'missing_run' }>> {
  if (!(await fileExists(args.planPath))) {
    return populatedResult(args, {
      status: 'missing_plan',
      runStatus: 'not_started',
      planPath: args.planPath,
      sideEffects: [],
    });
  }
  if (args.current.checkStatus === 'blocked') {
    return populatedResult(args, {
      status: 'blocked_projection',
      runStatus: 'not_started',
      planPath: args.planPath,
      current: args.current,
      sideEffects: [],
    });
  }

  const provenance = await readProvenance(args.provenancePath);
  if (!provenance) {
    return populatedResult(args, {
      status: 'missing_provenance',
      runStatus: 'not_started',
      planPath: args.planPath,
      current: args.current,
      sideEffects: [],
    });
  }
  if (!provenanceMatchesCurrent(provenance, args.current)) {
    return populatedResult(args, {
      status: 'stale_plan',
      runStatus: 'not_started',
      planPath: args.planPath,
      current: args.current,
      provenance,
      sideEffects: [],
    });
  }
  return populatedResult(args, {
    status: 'ready',
    runStatus: 'not_started',
    planPath: args.planPath,
    current: args.current,
    provenance,
    sideEffects: [],
  });
}

function populatedResult(
  args: { readonly runId: string; readonly metadataPath: string; readonly planPath: string },
  launch: LaunchResult,
): Exclude<RunFreshnessResult, { readonly status: 'missing_run' }> {
  return {
    status: runFreshnessStatusForLaunch(launch.status),
    runStatus: launch.runStatus,
    runId: args.runId,
    metadataPath: args.metadataPath,
    planPath: args.planPath,
    launch,
    sideEffects: [],
  };
}

function provenanceMatchesCurrent(provenance: PlanFileProvenance, current: LaunchCurrentProjection): boolean {
  return (
    provenance.schemaVersion === 1 &&
    provenance.specId === current.specId &&
    provenance.mode === current.mode &&
    provenance.source.visibility === current.source.visibility &&
    provenance.source.graphLsn === current.source.graphLsn
  );
}

async function readProvenance(path: string): Promise<PlanFileProvenance | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as PlanFileProvenance;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function runFreshnessStatusForLaunch(
  status: LaunchResult['status'],
): Exclude<RunFreshnessStatus, 'missing_run'> {
  switch (status) {
    case 'invalid_plan_path':
      return 'invalid_plan_path';
    case 'missing_plan':
      return 'run_plan_missing';
    case 'blocked_projection':
      return 'run_projection_blocked';
    case 'missing_provenance':
      return 'run_provenance_missing';
    case 'stale_plan':
      return 'run_plan_stale';
    case 'ready':
      return 'run_fresh';
  }
}
