import type { LaunchCurrentProjection } from './launch.js';
import { checkRunFreshness, type RunFreshnessResult } from './run-freshness.js';
import { readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

export type RunRetryAction =
  | 'retry_current_step'
  | 'regenerate_plan'
  | 'start_new_run'
  | 'inspect_run'
  | 'abandon_run';

export type RunRetryEligibilityStatus =
  | 'missing_run'
  | 'projection_blocked'
  | 'retry_current_run'
  | 'replan_before_retry'
  | 'start_new_run_required'
  | 'terminal_run';

export type RunRetryEligibilityResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly freshness: Extract<RunFreshnessResult, { readonly status: 'missing_run' }>;
      readonly allowedActions: readonly RunRetryAction[];
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: Exclude<RunRetryEligibilityStatus, 'missing_run'>;
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly freshness: Exclude<RunFreshnessResult, { readonly status: 'missing_run' }>;
      readonly allowedActions: readonly RunRetryAction[];
      readonly sideEffects: readonly [];
    };

const EARLY_REPLANABLE_STATUSES: ReadonlySet<RunMetadata['status']> = new Set([
  'created',
  'worktree_created',
]);

const TERMINAL_STATUSES: ReadonlySet<RunMetadata['status']> = new Set([
  'run_completed',
  'petri_exported',
  'promotion_prepared',
  'landed',
  'abandoned',
]);

export async function assessRunRetryEligibility(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly current: LaunchCurrentProjection;
}): Promise<RunRetryEligibilityResult> {
  const freshness = await checkRunFreshness(args);
  if (freshness.status === 'missing_run') {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath: freshness.metadataPath,
      freshness,
      allowedActions: ['start_new_run'],
      sideEffects: [],
    };
  }

  const metadataPath = runMetadataPath(args.cwd, args.runId);
  const metadata = await readRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      freshness: {
        status: 'missing_run',
        runStatus: 'not_started',
        runId: args.runId,
        metadataPath,
        sideEffects: [],
      },
      allowedActions: ['start_new_run'],
      sideEffects: [],
    };
  }

  if (TERMINAL_STATUSES.has(metadata.status)) {
    return {
      status: 'terminal_run',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      freshness,
      allowedActions: ['inspect_run'],
      sideEffects: [],
    };
  }

  if (freshness.status === 'run_projection_blocked') {
    return {
      status: 'projection_blocked',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      freshness,
      allowedActions: ['inspect_run', 'abandon_run'],
      sideEffects: [],
    };
  }

  if (freshness.status === 'run_fresh') {
    return {
      status: 'retry_current_run',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      freshness,
      allowedActions: ['retry_current_step', 'inspect_run', 'abandon_run'],
      sideEffects: [],
    };
  }

  if (EARLY_REPLANABLE_STATUSES.has(metadata.status)) {
    return {
      status: 'replan_before_retry',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      freshness,
      allowedActions: ['regenerate_plan', 'start_new_run', 'abandon_run'],
      sideEffects: [],
    };
  }

  return {
    status: 'start_new_run_required',
    runStatus: metadata.status,
    runId: args.runId,
    metadataPath,
    freshness,
    allowedActions: ['start_new_run', 'inspect_run', 'abandon_run'],
    sideEffects: [],
  };
}
