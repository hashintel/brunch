import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { petriPlanSnapshotPath } from './petri-plan-snapshot.js';
import { planProvenancePath } from './plan-file.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';
import { worktreeDirPath } from './worktree.js';

export type PopulateResult =
  | RunExecutionActiveResult
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
      readonly sideEffects: readonly (
        | { readonly kind: 'mkdir'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export function populatedPlanPath(cwd: string, runId: string): string {
  return join(worktreeDirPath(cwd, runId), '.brunch', 'cook', 'plan.yaml');
}

export function populatedPlanProvenancePath(cwd: string, runId: string): string {
  return join(worktreeDirPath(cwd, runId), '.brunch', 'cook', 'plan.provenance.json');
}

export async function populateWorktree(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<PopulateResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => populateWorktreeOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function populateWorktreeOwned(args: {
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
  const provenanceDestination = populatedPlanProvenancePath(args.cwd, args.runId);
  const destinationDir = dirname(destination);
  const provenance = await optionalReadFile(planProvenancePath(args.cwd, metadata.specId));
  const updated: RunMetadata = {
    ...metadata,
    status: 'worktree_populated',
    worktreeDir,
    populatedPlanPath: destination,
    ...(provenance === undefined ? {} : { populatedPlanProvenancePath: provenanceDestination }),
  };

  await mkdir(destinationDir, { recursive: true });
  const frozenPlan = await optionalReadFile(petriPlanSnapshotPath(args.cwd, args.runId));
  await writeFile(destination, frozenPlan ?? (await readFile(metadata.planPath, 'utf8')), 'utf8');
  if (provenance !== undefined) {
    await writeFile(provenanceDestination, provenance, 'utf8');
  }
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
      ...(provenance === undefined
        ? []
        : [{ kind: 'write_file' as const, path: provenanceDestination, ifExists: 'overwrite' as const }]),
      metadataEffect,
    ],
  };
}

async function optionalReadFile(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return undefined;
    }
    throw error;
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
