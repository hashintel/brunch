import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from './run-execution-authority.js';
import { runDirPath, runMetadataPath, persistRunMetadata, readRunMetadata, type RunMetadata } from './run.js';

export type ReportInitResult =
  | RunExecutionActiveResult
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'source_not_copied';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'reports_initialized';
      readonly runStatus: 'reports_initialized';
      readonly runId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function reportsPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'reports.jsonl');
}

export async function initializeReports(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<ReportInitResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => initializeReportsOwned(args),
    onContended: () => runExecutionActive(args.runId),
  });
}

async function initializeReportsOwned(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<ReportInitResult> {
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

  if (metadata.status !== 'source_copied') {
    return {
      status: 'source_not_copied',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const path = reportsPath(args.cwd, args.runId);
  const updated: RunMetadata = { ...metadata, status: 'reports_initialized', reportsPath: path };
  const event = { event: 'run_ready', runId: args.runId, status: 'reports_initialized' };

  await writeFile(path, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'reports_initialized',
    runStatus: 'reports_initialized',
    runId: args.runId,
    metadataPath,
    reportsPath: path,
    sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }, metadataEffect],
  };
}
