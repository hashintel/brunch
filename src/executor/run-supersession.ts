import { access, mkdir, rm } from 'node:fs/promises';
import { dirname } from 'node:path';

import { prepareLaunch, type LaunchCurrentProjection, type LaunchResult } from './launch.js';
import { petriEventsPath } from './petri-events.js';
import { petriPlanSnapshotPath } from './petri-plan-snapshot.js';
import { petriNetPath, petriSdcpnPath, preparePetriObservation } from './petri.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { persistRunMetadata, readRunMetadata, runDirPath, runMetadataPath, type RunMetadata } from './run.js';

export type RunSupersessionResult =
  | RunExecutionActiveResult
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
      readonly sideEffects: readonly (
        | { readonly kind: 'mkdir'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists?: 'overwrite' }
      )[];
    };

export async function createSupersedingRun(args: {
  readonly cwd: string;
  readonly previousRunId: string;
  readonly current: LaunchCurrentProjection;
  readonly runId?: string;
}): Promise<RunSupersessionResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.previousRunId,
    execute: () => createSupersedingRunOwned(args),
    onContended: () => runExecutionActive(args.previousRunId),
  });
}

async function createSupersedingRunOwned(args: {
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
  const runDir = runDirPath(args.cwd, runId);
  const metadataPath = runMetadataPath(args.cwd, runId);
  if (await pathExists(runDir)) {
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

  const metadata: RunMetadata = {
    runId,
    specId: previous.specId,
    planPath: launch.planPath,
    status: 'created',
    supersedesRunId: args.previousRunId,
    ...(previous.substrate ? { substrate: previous.substrate } : {}),
    ...(previous.verifyTarget ? { verifyTarget: previous.verifyTarget } : {}),
    ...(previous.publicPacket ? { publicPacket: previous.publicPacket } : {}),
  };

  const created = await withRunExecutionAuthority({
    cwd: args.cwd,
    runId,
    execute: async () => {
      if (await pathExists(runDir)) return { status: 'exists' as const };
      await mkdir(runDir, { recursive: true });
      const metadataEffect = await persistRunMetadata(metadataPath, metadata);
      try {
        await preparePetriObservation({ cwd: args.cwd, runId });
      } catch (error) {
        await rm(runDir, { recursive: true, force: true });
        throw error;
      }
      return { status: 'created' as const, metadataEffect };
    },
    onContended: () => ({ status: 'active' as const }),
  });
  if (created.status === 'active') return runExecutionActive(runId);
  if (created.status === 'exists') {
    return {
      status: 'target_run_exists',
      runStatus: 'not_started',
      previousRunId: args.previousRunId,
      runId,
      metadataPath,
      sideEffects: [],
    };
  }
  const petriDir = dirname(petriNetPath(args.cwd, runId));

  return {
    status: 'created',
    runStatus: 'created',
    previousRunId: args.previousRunId,
    runId,
    runDir,
    metadataPath,
    planPath: launch.planPath,
    sideEffects: [
      { kind: 'mkdir', path: runDir },
      created.metadataEffect,
      { kind: 'mkdir', path: petriDir },
      { kind: 'write_file', path: petriPlanSnapshotPath(args.cwd, runId) },
      { kind: 'write_file', path: petriNetPath(args.cwd, runId) },
      { kind: 'write_file', path: petriSdcpnPath(args.cwd, runId) },
      { kind: 'write_file', path: petriEventsPath(args.cwd, runId) },
    ],
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
