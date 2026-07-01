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
      readonly status: 'worktree_created';
      readonly runStatus: 'worktree_created';
      readonly runId: string;
      readonly runDir: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'git_worktree_add'; readonly path: string; readonly ref: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function worktreeDirPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'worktree');
}

export async function createWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitWorktree: GitWorktreePort;
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
  const worktreeResult = await args.gitWorktree.create({ cwd: args.cwd, worktreeDir, ref: 'HEAD' });
  if (worktreeResult.status === 'failed') {
    return {
      status: 'worktree_create_failed',
      runStatus: metadata.status,
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: worktreeResult.message,
      sideEffects: [],
    };
  }

  const updated: RunMetadata = { ...metadata, status: 'worktree_created', worktreeDir };
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'worktree_created',
    runStatus: 'worktree_created',
    runId: args.runId,
    runDir,
    worktreeDir,
    metadataPath,
    sideEffects: [...worktreeResult.sideEffects, metadataEffect],
  };
}
