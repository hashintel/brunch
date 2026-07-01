import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  cookRunDir,
  cookRunMetadataPath,
  persistCookRunMetadata,
  readCookRunMetadata,
  type CookRunMetadata,
} from './run.js';

export type CookWorktreeCreateResult =
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

export function cookWorktreeDir(cwd: string, runId: string): string {
  return join(cookRunDir(cwd, runId), 'worktree');
}

export async function createCookWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookWorktreeCreateResult> {
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

  const runDir = cookRunDir(args.cwd, args.runId);
  const worktreeDir = cookWorktreeDir(args.cwd, args.runId);
  const updated: CookRunMetadata = { ...metadata, status: 'worktree_created', worktreeDir };

  await mkdir(worktreeDir, { recursive: true });
  const metadataEffect = await persistCookRunMetadata(metadataPath, updated);

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
