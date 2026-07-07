import { mkdir } from 'node:fs/promises';

import { prepareLaunch, type LaunchCurrentProjection, type LaunchResult } from './launch.js';
import { persistRunMetadata, readRunMetadata, runDirPath, runMetadataPath, type RunMetadata } from './run.js';

export type RunSupersessionResult =
  | {
      readonly status: 'missing_previous_run';
      readonly runStatus: 'not_started';
      readonly previousRunId: string;
      readonly previousMetadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'target_run_exists';
      readonly runStatus: 'not_started';
      readonly previousRunId: string;
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'launch_not_ready';
      readonly runStatus: LaunchResult['runStatus'];
      readonly previousRunId: string;
      readonly planPath: string;
      readonly launch: LaunchResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'created';
      readonly runStatus: 'created';
      readonly previousRunId: string;
      readonly runId: string;
      readonly runDir: string;
      readonly metadataPath: string;
      readonly planPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export async function createSupersedingRun(args: {
  readonly cwd: string;
  readonly previousRunId: string;
  readonly current: LaunchCurrentProjection;
  readonly runId?: string;
}): Promise<RunSupersessionResult> {
  const previousMetadataPath = runMetadataPath(args.cwd, args.previousRunId);
  const previous = await readRunMetadata(previousMetadataPath);
  if (!previous) {
    return {
      status: 'missing_previous_run',
      runStatus: 'not_started',
      previousRunId: args.previousRunId,
      previousMetadataPath,
      sideEffects: [],
    };
  }

  const runId = args.runId ?? `run-${Date.now().toString(36)}`;
  const metadataPath = runMetadataPath(args.cwd, runId);
  if (await readRunMetadata(metadataPath)) {
    return {
      status: 'target_run_exists',
      runStatus: 'not_started',
      previousRunId: args.previousRunId,
      runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const launch = await prepareLaunch({
    cwd: args.cwd,
    specId: previous.specId,
    current: args.current,
  });
  if (launch.status !== 'ready') {
    return {
      status: 'launch_not_ready',
      runStatus: launch.runStatus,
      previousRunId: args.previousRunId,
      planPath: launch.planPath,
      launch,
      sideEffects: [],
    };
  }

  const runDir = runDirPath(args.cwd, runId);
  const metadata: RunMetadata = {
    runId,
    specId: previous.specId,
    planPath: launch.planPath,
    status: 'created',
    supersedesRunId: args.previousRunId,
  };

  await mkdir(runDir, { recursive: true });
  const metadataEffect = await persistRunMetadata(metadataPath, metadata);

  return {
    status: 'created',
    runStatus: 'created',
    previousRunId: args.previousRunId,
    runId,
    runDir,
    metadataPath,
    planPath: launch.planPath,
    sideEffects: [{ kind: 'mkdir', path: runDir }, metadataEffect],
  };
}
