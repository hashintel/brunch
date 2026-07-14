import { readFile } from 'node:fs/promises';

import type { GitHostLandIntegrateResult, GitHostLandPort } from './execution-ports.js';
import { promotionReviewBranch } from './promotion.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import {
  readRunMetadata,
  runMetadataPath,
  persistRunMetadata,
  type RunMetadata,
  type WorktreeSubstrateKind,
} from './run.js';

/**
 * Host-mutation authority (FE-1201): constructed only by the product-owned
 * confirm flow, never supplied by the model. Apply re-derives the promoted
 * commit and refuses on any drift, so a stale acceptance is inert.
 */
export interface LandAcceptance {
  readonly promotedCommitSha: string;
}

export type LandingPreflightResult =
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
      readonly status: 'already_landed';
      readonly runStatus: 'landed';
      readonly runId: string;
      readonly metadataPath: string;
      readonly landedSha: string | undefined;
      readonly landedVia: RunMetadata['landedVia'];
      readonly landedTarget: string | undefined;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'preflight_ready';
      readonly runStatus: 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly promotionPath: string;
      readonly worktreeDir: string;
      readonly substrate: WorktreeSubstrateKind;
      readonly runBaseSha: string;
      readonly promotionCommitSha: string;
      readonly reviewBranch: string;
      readonly sideEffects: readonly [];
    };

export type LandingApplyResult =
  | RunExecutionActiveResult
  | Exclude<LandingPreflightResult, { readonly status: 'preflight_ready' }>
  | {
      readonly status: 'acceptance_stale';
      readonly runId: string;
      readonly acceptedCommitSha: string;
      readonly promotionCommitSha: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'target_required';
      readonly runId: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'landing_refused';
      readonly runId: string;
      readonly reason:
        | Extract<GitHostLandIntegrateResult, { status: 'refused' }>['reason']
        | 'occupied_target'
        | 'target_aliases_run'
        | 'target_inside_run'
        | 'ref_moved';
      readonly paths?: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'landing_conflict';
      readonly runId: string;
      readonly conflictedPaths: readonly string[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'landing_failed';
      readonly runId: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'landed';
      readonly runStatus: 'landed';
      readonly runId: string;
      readonly via: NonNullable<RunMetadata['landedVia']>;
      readonly landedSha: string;
      readonly landedTarget: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly (
        | {
            readonly kind: 'host_branch_advance';
            readonly path: string;
            readonly branch: string;
            readonly sha: string;
          }
        | {
            readonly kind: 'git_materialize';
            readonly path: string;
            readonly branch: string;
            readonly sha: string;
          }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export async function preflightLanding(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<LandingPreflightResult> {
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
  if (metadata.status === 'landed') {
    return {
      status: 'already_landed',
      runStatus: 'landed',
      runId: args.runId,
      metadataPath,
      landedSha: metadata.landedSha,
      landedVia: metadata.landedVia,
      landedTarget: metadata.landedTarget,
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
  const notFound = (message: string): LandingPreflightResult => ({
    status: 'promotion_not_found',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath,
    promotionPath,
    message,
    sideEffects: [],
  });

  const report = await readPromotionReport(promotionPath);
  const reportCommitSha = report?.promotion?.status === 'promoted' ? report.promotion.commitSha : undefined;
  const reportReviewBranch =
    report?.promotion?.status === 'promoted' ? report.promotion.reviewBranch : undefined;
  if (!reportCommitSha) return notFound('promotion report is missing promoted land commitSha');
  if (reportCommitSha !== metadata.promotionCommitSha) {
    return notFound('run metadata promotionCommitSha does not match promotion report land commitSha');
  }
  const reviewBranch = promotionReviewBranch(args.runId);
  if (
    !metadata.promotionBranch ||
    metadata.promotionBranch !== reviewBranch ||
    reportReviewBranch !== metadata.promotionBranch
  ) {
    return notFound('run metadata promotionBranch does not match the promotion report reviewBranch');
  }
  if (!metadata.worktreeDir) return notFound('run metadata is missing worktreeDir');
  if (!metadata.runBaseSha) return notFound('run metadata is missing runBaseSha');

  return {
    status: 'preflight_ready',
    runStatus: 'promotion_prepared',
    runId: args.runId,
    metadataPath,
    promotionPath,
    worktreeDir: metadata.worktreeDir,
    substrate: metadata.substrate === 'empty_dir' ? 'empty_dir' : 'git_worktree',
    runBaseSha: metadata.runBaseSha,
    promotionCommitSha: metadata.promotionCommitSha,
    reviewBranch,
    sideEffects: [],
  };
}

export async function applyLanding(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly acceptance: LandAcceptance;
  readonly targetDir?: string;
  readonly gitHostLand: GitHostLandPort;
}): Promise<LandingApplyResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => applyLandingOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function applyLandingOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly acceptance: LandAcceptance;
  readonly targetDir?: string;
  readonly gitHostLand: GitHostLandPort;
}): Promise<LandingApplyResult> {
  const preflight = await preflightLanding(args);
  if (preflight.status !== 'preflight_ready') return preflight;
  if (preflight.promotionCommitSha !== args.acceptance.promotedCommitSha) {
    return {
      status: 'acceptance_stale',
      runId: args.runId,
      acceptedCommitSha: args.acceptance.promotedCommitSha,
      promotionCommitSha: preflight.promotionCommitSha,
      sideEffects: [],
    };
  }

  const message = `brunch: land ${args.runId}`;
  if (preflight.substrate === 'empty_dir') {
    if (!args.targetDir) {
      return {
        status: 'target_required',
        runId: args.runId,
        message: 'an empty_dir run lands into a target directory; none was provided',
        sideEffects: [],
      };
    }
    const materialized = await args.gitHostLand.materialize({
      runWorktreeDir: preflight.worktreeDir,
      reviewRef: preflight.reviewBranch,
      expectedTipSha: preflight.promotionCommitSha,
      targetDir: args.targetDir,
      branch: 'main',
      message,
    });
    if (materialized.status === 'refused') {
      return {
        status: 'landing_refused',
        runId: args.runId,
        reason: materialized.reason,
        sideEffects: [],
      };
    }
    if (materialized.status === 'failed') {
      return { status: 'landing_failed', runId: args.runId, message: materialized.message, sideEffects: [] };
    }
    return recordLanding({
      cwd: args.cwd,
      runId: args.runId,
      metadataPath: preflight.metadataPath,
      via: 'materialized',
      landedSha: materialized.landedSha,
      landedTarget: materialized.targetDir,
      portEffects: materialized.sideEffects,
    });
  }

  const integrated = await args.gitHostLand.integrate({
    hostDir: args.cwd,
    reviewRef: preflight.reviewBranch,
    expectedTipSha: preflight.promotionCommitSha,
    message,
  });
  if (integrated.status === 'refused') {
    return {
      status: 'landing_refused',
      runId: args.runId,
      reason: integrated.reason,
      ...(integrated.paths === undefined ? {} : { paths: integrated.paths }),
      sideEffects: [],
    };
  }
  if (integrated.status === 'conflict') {
    return {
      status: 'landing_conflict',
      runId: args.runId,
      conflictedPaths: integrated.conflictedPaths,
      sideEffects: [],
    };
  }
  if (integrated.status === 'failed') {
    return { status: 'landing_failed', runId: args.runId, message: integrated.message, sideEffects: [] };
  }
  return recordLanding({
    cwd: args.cwd,
    runId: args.runId,
    metadataPath: preflight.metadataPath,
    via: integrated.via,
    landedSha: integrated.landedSha,
    landedTarget: args.cwd,
    portEffects: integrated.sideEffects,
  });
}

async function recordLanding(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly metadataPath: string;
  readonly via: NonNullable<RunMetadata['landedVia']>;
  readonly landedSha: string;
  readonly landedTarget: string;
  readonly portEffects: readonly (
    | {
        readonly kind: 'host_branch_advance';
        readonly path: string;
        readonly branch: string;
        readonly sha: string;
      }
    | {
        readonly kind: 'git_materialize';
        readonly path: string;
        readonly branch: string;
        readonly sha: string;
      }
  )[];
}): Promise<LandingApplyResult> {
  const metadata = await readRunMetadata(args.metadataPath);
  if (!metadata) {
    return {
      status: 'landing_failed',
      runId: args.runId,
      message: 'run metadata disappeared while landing',
      sideEffects: [],
    };
  }
  const updated: RunMetadata = {
    ...metadata,
    status: 'landed',
    landedSha: args.landedSha,
    landedVia: args.via,
    landedTarget: args.landedTarget,
    landedAt: new Date().toISOString(),
  };
  const metadataEffect = await persistRunMetadata(args.metadataPath, updated);
  return {
    status: 'landed',
    runStatus: 'landed',
    runId: args.runId,
    via: args.via,
    landedSha: args.landedSha,
    landedTarget: args.landedTarget,
    metadataPath: args.metadataPath,
    sideEffects: [...args.portEffects, metadataEffect],
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
