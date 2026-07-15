import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { persistRunMetadata, readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';

export type RunAbandonResult =
  | RunExecutionActiveResult
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'already_abandoned';
      readonly runStatus: 'abandoned';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'terminal_run';
      readonly runStatus: 'run_completed' | 'petri_exported' | 'promotion_prepared';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'abandoned';
      readonly runStatus: 'abandoned';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

const NON_ABANDONABLE_TERMINAL_STATUSES: ReadonlySet<RunMetadata['status']> = new Set([
  'run_completed',
  'petri_exported',
  'promotion_prepared',
]);

export async function abandonRun(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly reason?: string;
  readonly abandonedAt?: string;
}): Promise<RunAbandonResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => abandonRunOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function abandonRunOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly reason?: string;
  readonly abandonedAt?: string;
}): Promise<RunAbandonResult> {
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

  if (metadata.status === 'abandoned') {
    return {
      status: 'already_abandoned',
      runStatus: 'abandoned',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  if (NON_ABANDONABLE_TERMINAL_STATUSES.has(metadata.status)) {
    return {
      status: 'terminal_run',
      runStatus: metadata.status as 'run_completed' | 'petri_exported' | 'promotion_prepared',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const updated: RunMetadata = {
    ...metadata,
    status: 'abandoned',
    abandonedAt: args.abandonedAt ?? new Date().toISOString(),
    ...(args.reason ? { abandonReason: args.reason } : {}),
  };
  const effect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'abandoned',
    runStatus: 'abandoned',
    runId: args.runId,
    metadataPath,
    sideEffects: [effect],
  };
}
