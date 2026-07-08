import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import type { VerifyTarget } from './execution-ports.js';
import { prepareLaunch, type LaunchCurrentProjection, type LaunchResult } from './launch.js';

export type WorktreeSubstrateKind = 'git_worktree' | 'empty_dir';

export interface RunMetadata {
  readonly runId: string;
  readonly specId: string;
  readonly planPath: string;
  readonly status:
    | 'created'
    | 'worktree_created'
    | 'worktree_populated'
    | 'source_policy_selected'
    | 'source_copied'
    | 'reports_initialized'
    | 'slice_started'
    | 'slice_execution_requested'
    | 'agent_result_ingested'
    | 'test_result_ingested'
    | 'slice_completed'
    | 'run_completed'
    | 'petri_exported'
    | 'promotion_prepared'
    | 'abandoned';
  readonly worktreeDir?: string;
  readonly substrate?: WorktreeSubstrateKind;
  readonly verifyTarget?: VerifyTarget;
  readonly populatedPlanPath?: string;
  readonly populatedPlanProvenancePath?: string;
  readonly sourcePolicy?: string;
  readonly sourcePolicyPath?: string;
  readonly sourceCopied?: boolean;
  readonly copiedEntries?: readonly string[];
  readonly reportsPath?: string;
  readonly activeSliceId?: string;
  readonly activeEpicId?: string;
  readonly sliceExecutionRequestPath?: string;
  readonly agentResultPath?: string;
  readonly completedSliceIds?: readonly string[];
  readonly petriPath?: string;
  readonly promotionPath?: string;
  readonly promotionBaseSha?: string;
  readonly promotionCommitSha?: string;
  readonly supersedesRunId?: string;
  readonly abandonedAt?: string;
  readonly abandonReason?: string;
}

export type RunCreateResult =
  | {
      readonly status: 'missing_plan';
      readonly runStatus: 'not_started';
      readonly planPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'launch_not_ready';
      readonly runStatus: LaunchResult['runStatus'];
      readonly planPath: string;
      readonly launch: LaunchResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'target_run_exists';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly runDir: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'created';
      readonly runStatus: 'created';
      readonly runId: string;
      readonly runDir: string;
      readonly metadataPath: string;
      readonly planPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

const SAFE_PATH_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Guards identifiers used to build filesystem paths. Values can come from tool
 * parameters or plan files, so `../escape` would let bounded cook side effects
 * read or write outside their intended directory. Reject anything that is not a
 * flat, path-segment-safe identifier.
 */
export function assertSafePathSegment(label: string, value: string): void {
  if (!SAFE_PATH_SEGMENT.test(value) || value.includes('..')) {
    throw new Error(`invalid ${label}: ${JSON.stringify(value)}`);
  }
}

export function assertSafeRunId(runId: string): void {
  assertSafePathSegment('runId', runId);
}

export function assertSafeSliceId(sliceId: string): void {
  assertSafePathSegment('sliceId', sliceId);
}

export function runDirPath(cwd: string, runId: string): string {
  assertSafeRunId(runId);
  return join(cwd, BRUNCH_DIR, 'cook', 'runs', runId);
}

export function runMetadataPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'run.json');
}

export async function readRunMetadata(path: string): Promise<RunMetadata | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as RunMetadata;
  } catch {
    return undefined;
  }
}

export interface RunMetadataWriteEffect {
  readonly kind: 'write_file';
  readonly path: string;
  readonly ifExists: 'overwrite';
}

export async function persistRunMetadata(
  metadataPath: string,
  metadata: RunMetadata,
): Promise<RunMetadataWriteEffect> {
  // Write-temp+rename: concurrent observers must never read a truncated run.json
  // (plain writeFile truncates in place). One-writer-per-cwd excludes temp collisions.
  const tempPath = `${metadataPath}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  try {
    await rename(tempPath, metadataPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
  return { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' };
}

export async function createRun(args: {
  readonly cwd: string;
  readonly specId: string;
  readonly current?: LaunchCurrentProjection;
  readonly runId?: string;
  readonly substrate?: WorktreeSubstrateKind;
  readonly verifyTarget?: VerifyTarget;
}): Promise<RunCreateResult> {
  const runId = args.runId ?? `run-${Date.now().toString(36)}`;
  const runDir = runDirPath(args.cwd, runId);
  const metadataPath = runMetadataPath(args.cwd, runId);
  if (await pathExists(runDir)) {
    return {
      status: 'target_run_exists',
      runStatus: 'not_started',
      runId,
      runDir,
      metadataPath,
      sideEffects: [],
    };
  }

  const launch = await prepareLaunch({
    cwd: args.cwd,
    specId: args.specId,
    ...(args.current === undefined ? {} : { current: args.current }),
  });
  if (launch.status === 'missing_plan') {
    return {
      status: 'missing_plan',
      runStatus: launch.runStatus,
      planPath: launch.planPath,
      sideEffects: launch.sideEffects,
    };
  }
  if (launch.status !== 'ready') {
    return {
      status: 'launch_not_ready',
      runStatus: launch.runStatus,
      planPath: launch.planPath,
      launch,
      sideEffects: [],
    };
  }

  const metadata: RunMetadata = {
    runId,
    specId: args.specId,
    planPath: launch.planPath,
    status: 'created',
    ...(args.substrate ? { substrate: args.substrate } : {}),
    ...(args.verifyTarget ? { verifyTarget: args.verifyTarget } : {}),
  };

  await mkdir(runDir, { recursive: true });
  await persistRunMetadata(metadataPath, metadata);

  return {
    status: 'created',
    runStatus: 'created',
    runId,
    runDir,
    metadataPath,
    planPath: launch.planPath,
    sideEffects: [
      { kind: 'mkdir', path: runDir },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
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
