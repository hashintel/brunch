import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GitRunPromotionPort } from './execution-ports.js';
import { readSliceVerificationVerdict } from './report-verdict.js';
import { reportsPath } from './report.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

type PromotionSideEffect =
  | { readonly kind: 'git_commit'; readonly path: string; readonly sha: string }
  | { readonly kind: 'git_ref_create'; readonly path: string; readonly ref: string; readonly sha: string }
  | { readonly kind: 'mkdir'; readonly path: string }
  | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' };

export type PromotionPrepareResult =
  | RunExecutionActiveResult
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
      readonly status: 'verification_failed';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly failedSliceIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'verification_missing';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly missingSliceIds: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'promotion_failed';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly PromotionSideEffect[];
    }
  | {
      readonly status: 'promotion_no_changes';
      readonly runStatus: 'petri_exported';
      readonly runId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly PromotionSideEffect[];
    }
  | {
      readonly status: 'promotion_prepared';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly promotionBranch: string;
      readonly sideEffects: readonly PromotionSideEffect[];
    };

export function promotionReportPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'promotion', 'promotion.json');
}

export function promotionReviewBranch(runId: string): string {
  return `brunch/review/${runId}`;
}

export async function preparePromotion(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitRunPromotion: GitRunPromotionPort;
}): Promise<PromotionPrepareResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => preparePromotionOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function preparePromotionOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitRunPromotion: GitRunPromotionPort;
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

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const verification = await readSliceVerificationVerdict({
    reportsPath: reportPath,
    expectedSliceIds: metadata.completedSliceIds ?? [],
  });
  if (verification.status === 'failed') {
    return {
      status: 'verification_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      failedSliceIds: verification.failedSliceIds,
      sideEffects: [],
    };
  }
  if (verification.status === 'missing') {
    return {
      status: 'verification_missing',
      runStatus: 'petri_exported',
      runId: args.runId,
      metadataPath,
      reportsPath: reportPath,
      missingSliceIds: verification.missingSliceIds,
      sideEffects: [],
    };
  }

  const recovered = await recoverPreparedPromotion({
    cwd: args.cwd,
    gitRunPromotion: args.gitRunPromotion,
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

  // The durable run-origin base recorded at worktree creation is the only
  // promotion baseline: the promoted range is runBaseSha..tip, so a clean
  // fully-integrated run still promotes (no_changes means tip == run base).
  const runBaseSha = metadata.runBaseSha;
  if (!runBaseSha) {
    return {
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: 'run is missing runBaseSha',
      sideEffects: [],
    };
  }
  const reviewBranch = promotionReviewBranch(args.runId);

  const promoted = await args.gitRunPromotion.promote({
    worktreeDir,
    message: `promote ${args.runId}`,
    baseSha: runBaseSha,
    reviewBranch,
  });
  if (promoted.status === 'failed') {
    return {
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: promoted.message,
      sideEffects: promoted.sideEffects,
    };
  }
  if (promoted.status === 'no_changes') {
    return {
      status: 'promotion_no_changes',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: promoted.message,
      sideEffects: [],
    };
  }

  const path = promotionReportPath(args.cwd, args.runId);
  const dir = dirname(path);
  const report = promotionReport(args.runId, metadata, promoted.commitSha, promoted.reviewBranch);
  const updated = promotedRunMetadata(metadata, path, promoted.commitSha, promoted.reviewBranch);
  await mkdir(dir, { recursive: true });
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);
  return {
    status: 'promotion_prepared',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath,
    promotionPath: path,
    promotionBranch: promoted.reviewBranch,
    sideEffects: [
      ...promoted.sideEffects,
      { kind: 'mkdir', path: dir },
      { kind: 'write_file', path, ifExists: 'overwrite' },
      metadataEffect,
    ],
  };
}

function promotionReport(
  runId: string,
  metadata: RunMetadata,
  commitSha: string,
  reviewBranch: string,
): object {
  return {
    runId,
    specId: metadata.specId,
    petriPath: metadata.petriPath ?? null,
    reportsPath: metadata.reportsPath ?? null,
    completedSliceIds: metadata.completedSliceIds ?? [],
    promotion: { status: 'promoted', commitSha, reviewBranch },
  };
}

function promotedRunMetadata(
  metadata: RunMetadata,
  promotionPath: string,
  commitSha: string,
  promotionBranch: string,
): RunMetadata {
  return {
    ...metadata,
    status: 'promotion_prepared',
    promotionPath,
    promotionCommitSha: commitSha,
    promotionBranch,
  };
}

async function recoverPreparedPromotion(args: {
  readonly cwd: string;
  readonly gitRunPromotion: GitRunPromotionPort;
  readonly runId: string;
  readonly metadata: RunMetadata;
  readonly metadataPath: string;
}): Promise<PromotionPrepareResult | undefined> {
  const path = promotionReportPath(args.cwd, args.runId);
  const report = await readPromotionReport(path);
  const commitSha = report?.promotion?.status === 'promoted' ? report.promotion.commitSha : undefined;
  const reviewBranch = report?.promotion?.status === 'promoted' ? report.promotion.reviewBranch : undefined;
  if (!commitSha || reviewBranch !== promotionReviewBranch(args.runId)) return undefined;
  if (args.metadata.promotionBranch && args.metadata.promotionBranch !== reviewBranch) return undefined;
  if (!args.metadata.worktreeDir) return undefined;

  const head = await args.gitRunPromotion.currentHead({ worktreeDir: args.metadata.worktreeDir });
  if (head.status !== 'ok' || head.commitSha !== commitSha) return undefined;
  const ref = await args.gitRunPromotion.resolveRef({
    worktreeDir: args.metadata.worktreeDir,
    ref: reviewBranch,
  });
  if (ref.status !== 'ok' || ref.commitSha !== commitSha) return undefined;

  const updated: RunMetadata = {
    ...args.metadata,
    status: 'promotion_prepared',
    promotionPath: path,
    promotionCommitSha: commitSha,
    promotionBranch: reviewBranch,
  };
  const metadataEffect = await persistRunMetadata(args.metadataPath, updated);
  return {
    status: 'promotion_prepared',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath: args.metadataPath,
    promotionPath: path,
    promotionBranch: reviewBranch,
    sideEffects: [metadataEffect],
  };
}

interface PromotionReportPayload {
  readonly promotion?: {
    readonly status?: string;
    readonly commitSha?: string;
    readonly reviewBranch?: string;
  };
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
