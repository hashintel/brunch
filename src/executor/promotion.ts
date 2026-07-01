import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GitLandPort } from './execution-ports.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

type PromotionSideEffect =
  | { readonly kind: 'git_commit'; readonly path: string; readonly sha: string }
  | { readonly kind: 'mkdir'; readonly path: string }
  | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' };

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
      readonly sideEffects: readonly PromotionSideEffect[];
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
  const recovered = await recoverPreparedPromotion({
    cwd: args.cwd,
    runId: args.runId,
    metadata,
    metadataPath,
  });
  if (recovered) return recovered;

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
    if (land.commitSha) {
      const path = promotionReportPath(args.cwd, args.runId);
      const dir = dirname(path);
      const report = promotionReport(args.runId, metadata, land.commitSha);
      const updated = promotedRunMetadata(metadata, path, land.commitSha);
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
          { kind: 'mkdir', path: dir },
          { kind: 'write_file', path, ifExists: 'overwrite' },
          metadataEffect,
        ],
      };
    }
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
  const report = promotionReport(args.runId, metadata, land.commitSha);
  const updated = promotedRunMetadata(metadata, path, land.commitSha);
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

function promotionReport(runId: string, metadata: RunMetadata, commitSha: string): object {
  return {
    runId,
    specId: metadata.specId,
    petriPath: metadata.petriPath ?? null,
    reportsPath: metadata.reportsPath ?? null,
    completedSliceIds: metadata.completedSliceIds ?? [],
    land: { status: 'promoted', commitSha },
  };
}

function promotedRunMetadata(metadata: RunMetadata, promotionPath: string, commitSha: string): RunMetadata {
  return {
    ...metadata,
    status: 'promotion_prepared',
    promotionPath,
    promotionCommitSha: commitSha,
  };
}

async function recoverPreparedPromotion(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly metadata: RunMetadata;
  readonly metadataPath: string;
}): Promise<PromotionPrepareResult | undefined> {
  const path = promotionReportPath(args.cwd, args.runId);
  const report = await readPromotionReport(path);
  const commitSha = report?.land?.status === 'promoted' ? report.land.commitSha : undefined;
  if (!commitSha) return undefined;

  const updated: RunMetadata = {
    ...args.metadata,
    status: 'promotion_prepared',
    promotionPath: path,
    promotionCommitSha: commitSha,
  };
  const metadataEffect = await persistRunMetadata(args.metadataPath, updated);
  return {
    status: 'promotion_prepared',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath: args.metadataPath,
    promotionPath: path,
    sideEffects: [metadataEffect],
  };
}

interface PromotionReportPayload {
  readonly land?: { readonly status?: string; readonly commitSha?: string };
}

async function readPromotionReport(path: string): Promise<PromotionReportPayload | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as PromotionReportPayload;
  } catch {
    return undefined;
  }
}

function worktreePathFallback(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'worktree');
}
