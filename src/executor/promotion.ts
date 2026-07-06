import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GitLandPort } from './execution-ports.js';
import { readSliceVerificationVerdict } from './report-verdict.js';
import { reportsPath } from './report.js';
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
    gitLand: args.gitLand,
    runId: args.runId,
    metadata,
    metadataPath,
  });
  if (recovered) return recovered;
  const hasPromotionReport = Boolean(await readPromotionReport(promotionReportPath(args.cwd, args.runId)));

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

  const preparedAttempt = await preparePromotionAttempt({
    gitLand: args.gitLand,
    metadata,
    metadataPath,
    worktreeDir,
    persistBaseSha: !hasPromotionReport,
  });
  if (preparedAttempt.status === 'failed') {
    return {
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: preparedAttempt.message,
      sideEffects: [],
    };
  }
  const promotionMetadata = preparedAttempt.metadata;

  const land = await args.gitLand.promote({ worktreeDir, message: `promote ${args.runId}` });
  if (land.status === 'failed') {
    return {
      status: 'promotion_failed',
      runStatus: 'petri_exported',
      runId: args.runId,
      worktreeDir,
      metadataPath,
      message: land.message,
      sideEffects: preparedAttempt.sideEffects,
    };
  }
  if (land.status === 'no_changes') {
    if (land.commitSha && land.commitSha !== promotionMetadata.promotionBaseSha) {
      const path = promotionReportPath(args.cwd, args.runId);
      const dir = dirname(path);
      const report = promotionReport(args.runId, promotionMetadata, land.commitSha);
      const updated = promotedRunMetadata(promotionMetadata, path, land.commitSha);
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
          ...preparedAttempt.sideEffects,
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
      sideEffects: preparedAttempt.sideEffects,
    };
  }

  const path = promotionReportPath(args.cwd, args.runId);
  const dir = dirname(path);
  const report = promotionReport(args.runId, promotionMetadata, land.commitSha);
  const updated = promotedRunMetadata(promotionMetadata, path, land.commitSha);
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
      ...preparedAttempt.sideEffects,
      ...land.sideEffects,
      { kind: 'mkdir', path: dir },
      { kind: 'write_file', path, ifExists: 'overwrite' },
      metadataEffect,
    ],
  };
}

type PromotionAttemptPrepareResult =
  | {
      readonly status: 'prepared';
      readonly metadata: RunMetadata;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'prepared';
      readonly metadata: RunMetadata;
      readonly sideEffects: readonly [
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    }
  | {
      readonly status: 'failed';
      readonly message: string;
    };

async function preparePromotionAttempt(args: {
  readonly gitLand: GitLandPort;
  readonly metadata: RunMetadata;
  readonly metadataPath: string;
  readonly worktreeDir: string;
  readonly persistBaseSha: boolean;
}): Promise<PromotionAttemptPrepareResult> {
  if (args.metadata.promotionBaseSha) {
    return { status: 'prepared', metadata: args.metadata, sideEffects: [] };
  }
  if (!args.persistBaseSha) {
    return { status: 'prepared', metadata: args.metadata, sideEffects: [] };
  }
  const head = await args.gitLand.currentHead({ worktreeDir: args.worktreeDir });
  if (head.status === 'failed') return { status: 'failed', message: head.message };
  const metadata = { ...args.metadata, promotionBaseSha: head.commitSha };
  const metadataEffect = await persistRunMetadata(args.metadataPath, metadata);
  return { status: 'prepared', metadata, sideEffects: [metadataEffect] };
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
  readonly gitLand: GitLandPort;
  readonly runId: string;
  readonly metadata: RunMetadata;
  readonly metadataPath: string;
}): Promise<PromotionPrepareResult | undefined> {
  const path = promotionReportPath(args.cwd, args.runId);
  const report = await readPromotionReport(path);
  const commitSha = report?.land?.status === 'promoted' ? report.land.commitSha : undefined;
  if (!commitSha) return undefined;
  if (!args.metadata.worktreeDir) return undefined;

  const head = await args.gitLand.currentHead({ worktreeDir: args.metadata.worktreeDir });
  if (head.status !== 'ok' || head.commitSha !== commitSha) return undefined;

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
