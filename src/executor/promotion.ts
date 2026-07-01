import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GitLandPort } from './execution-ports.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type PromotionPrepareResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_not_promotable';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'promotion_failed';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'promotion_no_changes';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'promotion_prepared';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'git_commit'; readonly path: string; readonly sha: string },
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function promotionReportPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'promotion', 'promotion.json');
}

export async function preparePromotion(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitLand: GitLandPort;
}): Promise<PromotionPrepareResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata)
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  if (metadata.status !== 'petri_exported')
    return {
      status: 'run_not_promotable',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  const worktreeDir = metadata.worktreeDir;
  if (!worktreeDir) {
    return {
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir: worktreeDir ?? worktreePathFallback(args.cwd, args.runId),
      metadataPath,
      message: 'run is missing worktreeDir',
      sideEffects: [],
    };
  }

  const land = await args.gitLand.promote({ worktreeDir, message: `promote ${args.runId}` });
  if (land.status === 'failed') {
    return {
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: land.message,
      sideEffects: [],
    };
  }
  if (land.status === 'no_changes') {
    return {
      status: 'promotion_no_changes',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: land.message,
      sideEffects: [],
    };
  }

  const path = promotionReportPath(args.cwd, args.runId);
  const dir = dirname(path);
  const report = {
    runId: args.runId,
    specId: metadata.specId,
    petriPath: metadata.petriPath ?? null,
    reportsPath: metadata.reportsPath ?? null,
    completedSliceIds: metadata.completedSliceIds ?? [],
    land: { status: 'promoted', commitSha: land.commitSha },
  };
  const updated: RunMetadata = {
    ...metadata,
    status: 'promotion_prepared',
    promotionPath: path,
    promotionCommitSha: land.commitSha,
  };
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);
  return {
    status: 'promotion_prepared',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath,
    promotionPath: path,
    sideEffects: [
      ...land.sideEffects,
      { kind: 'mkdir', path: dir },
      { kind: 'write_file', path, ifExists: 'overwrite' },
      metadataEffect,
    ],
  };
}

function worktreePathFallback(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'worktree');
}
