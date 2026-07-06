import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';
import { worktreeDirPath } from './worktree.js';

export type PopulateResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_worktree';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'worktree_populated';
      readonly runStatus: 'worktree_populated';
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly populatedPlanPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function populatedPlanPath(cwd: string, runId: string): string {
  return join(worktreeDirPath(cwd, runId), '.brunch', 'cook', 'plan.yaml');
}

export async function populateWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<PopulateResult> {
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

  const worktreeDir = worktreeDirPath(args.cwd, args.runId);
  if (!(await pathExists(worktreeDir))) {
    return {
      status: 'missing_worktree',
      runStatus: metadata.status,
      runId: args.runId,
      worktreeDir,
      metadataPath,
      sideEffects: [],
    };
  }

  const destination = populatedPlanPath(args.cwd, args.runId);
  const destinationDir = dirname(destination);
  const updated: RunMetadata = {
    ...metadata,
    status: 'worktree_populated',
    worktreeDir,
    populatedPlanPath: destination,
  };

  await mkdir(destinationDir, { recursive: true });
  await writeFile(destination, await readFile(metadata.planPath, 'utf8'), 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'worktree_populated',
    runStatus: 'worktree_populated',
    runId: args.runId,
    worktreeDir,
    metadataPath,
    populatedPlanPath: destination,
    sideEffects: [
      { kind: 'mkdir', path: destinationDir },
      { kind: 'write_file', path: destination, ifExists: 'overwrite' },
      metadataEffect,
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
