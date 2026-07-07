import { prepareLaunch, type LaunchCurrentProjection, type LaunchResult } from './launch.js';
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
