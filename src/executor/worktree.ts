import { access, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { GitWorktreePort } from './execution-ports.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type WorktreeCreateResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'worktree_create_failed';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'already_created';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly runDir: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'worktree_created';
      readonly runStatus: 'worktree_created';
      readonly runId: string;
      readonly runDir: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'git_worktree_add'; readonly path: string; readonly ref: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export function worktreeDirPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'worktree');
}

export async function createWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitWorktree: GitWorktreePort;
  readonly signal?: AbortSignal | undefined;
}): Promise<WorktreeCreateResult> {
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

  const runDir = runDirPath(args.cwd, args.runId);
  const worktreeDir = worktreeDirPath(args.cwd, args.runId);

  // Idempotent: if the worktree was already created, do not re-run
  // `git worktree add` (it fails when the directory already exists). The
  // previous mkdir-based path could be safely retried; preserve that.
  if (metadata.worktreeDir && (await hasGitWorktreeMarker(metadata.worktreeDir))) {
    return {
      status: 'already_created',
      runStatus: metadata.status,
      runId: args.runId,
      runDir,
      worktreeDir: metadata.worktreeDir,
      metadataPath,
      sideEffects: [],
    };
  }

  if (
    !metadata.worktreeDir &&
    canRepairWorktreeMetadata(metadata.status) &&
    (await hasGitWorktreeMarker(worktreeDir))
  ) {
    const updated: RunMetadata = { ...metadata, status: 'worktree_created', worktreeDir };
    const metadataEffect = await persistRunMetadata(metadataPath, updated);
    return {
      status: 'worktree_created',
      runStatus: 'worktree_created',
      runId: args.runId,
      runDir,
      worktreeDir,
      metadataPath,
      sideEffects: [metadataEffect],
    };
  }

  const targetWorktreeDir = metadata.worktreeDir ?? worktreeDir;

  if (!canRepairWorktreeMetadata(metadata.status)) {
    return {
      status: 'worktree_create_failed',
      runStatus: metadata.status,
      runId: args.runId,
      worktreeDir: targetWorktreeDir,
      metadataPath,
      message: `run already advanced to ${metadata.status}; refusing to recreate missing or invalid worktree`,
      sideEffects: [],
    };
  }

  // Reaching here means `targetWorktreeDir` has no `.git` worktree marker, so
  // any directory sitting there is stale — an interrupted `git worktree add` or
  // a legacy mkdir workspace. `git worktree add` refuses a non-empty path, so
  // clear it first; otherwise the run wedges with no automatic repair path.
  if (await pathExists(targetWorktreeDir)) {
    await rm(targetWorktreeDir, { recursive: true, force: true });
  }

  const worktreeResult = await args.gitWorktree.create({
    cwd: args.cwd,
    worktreeDir: targetWorktreeDir,
    ref: 'HEAD',
    signal: args.signal,
  });
  if (worktreeResult.status === 'failed') {
    return {
      status: 'worktree_create_failed',
      runStatus: metadata.status,
      runId: args.runId,
      worktreeDir: targetWorktreeDir,
      metadataPath,
      message: worktreeResult.message,
      sideEffects: [],
    };
  }

  const updated: RunMetadata = { ...metadata, status: 'worktree_created', worktreeDir: targetWorktreeDir };
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'worktree_created',
    runStatus: 'worktree_created',
    runId: args.runId,
    runDir,
    worktreeDir: targetWorktreeDir,
    metadataPath,
    sideEffects: [...worktreeResult.sideEffects, metadataEffect],
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

async function hasGitWorktreeMarker(worktreeDir: string): Promise<boolean> {
  return pathExists(join(worktreeDir, '.git'));
}

function canRepairWorktreeMetadata(status: RunMetadata['status']): boolean {
  return status === 'created' || status === 'worktree_created';
}
