import { readFile } from 'node:fs/promises';

import type { GitHostPromotionPort, GitHostPromotionPreflightPort } from './execution-ports.js';
import { readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

export type HostPromotionPreflightResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'run_not_promoted';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'promotion_not_found';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'preflight_failed';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly worktreeDir: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'preflight_ready';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly worktreeDir: string;
      readonly baseSha: string;
      readonly promotionCommitSha: string;
      readonly changedFiles: readonly string[];
      readonly patchSummary: string;
      readonly sideEffects: readonly [];
    };

export type HostPromotionApplyResult =
  | Exclude<HostPromotionPreflightResult, { readonly status: 'preflight_ready' }>
  | {
      readonly status: 'needs_acceptance';
      readonly runId: string;
      readonly acceptedCommitSha: string | undefined;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'acceptance_mismatch';
      readonly runId: string;
      readonly acceptedCommitSha: string;
      readonly promotionCommitSha: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'apply_failed';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly promotionCommitSha: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'applied';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly promotionCommitSha: string;
      readonly changedFiles: readonly string[];
      readonly sideEffects: readonly [
        {
          readonly kind: 'host_worktree_apply';
          readonly path: string;
          readonly changedFiles: readonly string[];
        },
      ];
    };

export async function preflightHostPromotion(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitHostPromotion: GitHostPromotionPreflightPort;
}): Promise<HostPromotionPreflightResult> {
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

  if (metadata.status !== 'promotion_prepared' || !metadata.promotionCommitSha || !metadata.promotionPath) {
    return {
      status: 'run_not_promoted',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const promotionPath = metadata.promotionPath;
  const report = await readPromotionReport(promotionPath);
  const reportCommitSha = report?.land?.status === 'promoted' ? report.land.commitSha : undefined;
  if (!reportCommitSha) {
    return promotionNotFound(
      args.runId,
      metadataPath,
      promotionPath,
      'promotion report is missing promoted land commitSha',
    );
  }
  if (reportCommitSha !== metadata.promotionCommitSha) {
    return promotionNotFound(
      args.runId,
      metadataPath,
      promotionPath,
      'run metadata promotionCommitSha does not match promotion report land commitSha',
    );
  }
  if (!metadata.worktreeDir) {
    return promotionNotFound(args.runId, metadataPath, promotionPath, 'run metadata is missing worktreeDir');
  }

  const preflight = await args.gitHostPromotion.preflight({
    cwd: args.cwd,
    worktreeDir: metadata.worktreeDir,
    commitSha: metadata.promotionCommitSha,
  });
  if (preflight.status === 'failed') {
    return {
      status: 'preflight_failed',
      runStatus: 'promotion_prepared',
      runId: args.runId,
      metadataPath,
      promotionPath,
      worktreeDir: metadata.worktreeDir,
      message: preflight.message,
      sideEffects: [],
    };
  }

  return {
    status: 'preflight_ready',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath,
    promotionPath,
    worktreeDir: metadata.worktreeDir,
    baseSha: preflight.baseSha,
    promotionCommitSha: preflight.commitSha,
    changedFiles: preflight.changedFiles,
    patchSummary: preflight.patchSummary,
    sideEffects: [],
  };
}

export async function applyHostPromotion(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly acceptedCommitSha?: string;
  readonly gitHostPromotion: GitHostPromotionPort;
}): Promise<HostPromotionApplyResult> {
  if (!args.acceptedCommitSha) {
    return {
      status: 'needs_acceptance',
      runId: args.runId,
      acceptedCommitSha: args.acceptedCommitSha,
      sideEffects: [],
    };
  }

  const preflight = await preflightHostPromotion(args);
  if (preflight.status !== 'preflight_ready') return preflight;
  if (preflight.promotionCommitSha !== args.acceptedCommitSha) {
    return {
      status: 'acceptance_mismatch',
      runId: args.runId,
      acceptedCommitSha: args.acceptedCommitSha,
      promotionCommitSha: preflight.promotionCommitSha,
      sideEffects: [],
    };
  }

  const apply = await args.gitHostPromotion.apply({
    cwd: args.cwd,
    worktreeDir: preflight.worktreeDir,
    baseSha: preflight.baseSha,
    commitSha: preflight.promotionCommitSha,
    changedFiles: preflight.changedFiles,
  });
  if (apply.status === 'failed') {
    return {
      status: 'apply_failed',
      runStatus: 'promotion_prepared',
      runId: args.runId,
      promotionCommitSha: preflight.promotionCommitSha,
      message: apply.message,
      sideEffects: [],
    };
  }

  return {
    status: 'applied',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    promotionCommitSha: preflight.promotionCommitSha,
    changedFiles: apply.changedFiles,
    sideEffects: [{ kind: 'host_worktree_apply', path: args.cwd, changedFiles: apply.changedFiles }],
  };
}

function promotionNotFound(
  runId: string,
  metadataPath: string,
  promotionPath: string,
  message: string,
): HostPromotionPreflightResult {
  return {
    status: 'promotion_not_found',
    runStatus: 'promotion_prepared',
    runId,
    metadataPath,
    promotionPath,
    message,
    sideEffects: [],
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
