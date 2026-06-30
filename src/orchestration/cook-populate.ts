import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { cookRunMetadataPath, type CookRunMetadata } from './cook-run.js';
import { cookWorktreeDir } from './cook-worktree.js';

export type CookPopulateResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_worktree';
      readonly runStatus: CookRunMetadata['status'];
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
  return join(cookWorktreeDir(cwd, runId), '.brunch', 'cook', 'plan.yaml');
}

export async function populateCookWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookPopulateResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
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

  const worktreeDir = cookWorktreeDir(args.cwd, args.runId);
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
  const updated: CookRunMetadata = {
    ...metadata,
    status: 'worktree_populated',
    worktreeDir,
    populatedPlanPath: destination,
  };

  await mkdir(destinationDir, { recursive: true });
  await writeFile(destination, await readFile(metadata.planPath, 'utf8'), 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

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
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}

async function readRunMetadata(path: string): Promise<CookRunMetadata | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CookRunMetadata;
  } catch {
    return undefined;
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
