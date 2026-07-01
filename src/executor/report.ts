import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  cookRunDir,
  cookRunMetadataPath,
  persistCookRunMetadata,
  readCookRunMetadata,
  type CookRunMetadata,
} from './run.js';

export type CookReportInitResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'source_not_copied';
      readonly runStatus: CookRunMetadata['status'];
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
  return join(cookRunDir(cwd, runId), 'reports.jsonl');
}

export async function initializeCookReports(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookReportInitResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
  const metadata = await readCookRunMetadata(metadataPath);
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
  const updated: CookRunMetadata = { ...metadata, status: 'reports_initialized', reportsPath: path };
  const event = { event: 'run_ready', runId: args.runId, status: 'reports_initialized' };

  await writeFile(path, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistCookRunMetadata(metadataPath, updated);

  return {
    status: 'reports_initialized',
    runStatus: 'reports_initialized',
    runId: args.runId,
    metadataPath,
    reportsPath: path,
    sideEffects: [{ kind: 'write_file', path, ifExists: 'overwrite' }, metadataEffect],
  };
}
