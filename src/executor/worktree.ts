import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

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
      readonly status: 'worktree_created';
      readonly runStatus: 'worktree_created';
      readonly runId: string;
      readonly runDir: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function worktreeDirPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'worktree');
}

export async function createWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
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
  const updated: RunMetadata = { ...metadata, status: 'worktree_created', worktreeDir };

  await mkdir(worktreeDir, { recursive: true });
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'worktree_created',
    runStatus: 'worktree_created',
    runId: args.runId,
    runDir,
    worktreeDir,
    metadataPath,
    sideEffects: [{ kind: 'mkdir', path: worktreeDir }, metadataEffect],
  };
}
