import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { reportsPath } from './cook-report.js';
import { cookRunDir, cookRunMetadataPath, type CookRunMetadata } from './cook-run.js';

export type CookSliceExecutionRequestResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_not_started';
      readonly runStatus: CookRunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_execution_requested';
      readonly runStatus: 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly requestPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'mkdir'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function sliceExecutionRequestPath(cwd: string, runId: string, sliceId: string): string {
  return join(cookRunDir(cwd, runId), 'agent-output', sliceId, 'request.json');
}

export async function requestCookSliceExecution(args: {
  readonly cwd: string;
  readonly runId: string;
}): Promise<CookSliceExecutionRequestResult> {
  const metadataPath = cookRunMetadataPath(args.cwd, args.runId);
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

  if (metadata.status !== 'slice_started' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'slice_not_started',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const requestPath = sliceExecutionRequestPath(args.cwd, args.runId, metadata.activeSliceId);
  const requestDir = join(cookRunDir(args.cwd, args.runId), 'agent-output', metadata.activeSliceId);
  const request = {
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
    action: 'execute_slice',
    status: 'requested',
  };
  const event = {
    event: 'slice_execution_requested',
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: 'slice_execution_requested',
  };
  const updated: CookRunMetadata = {
    ...metadata,
    status: 'slice_execution_requested',
    sliceExecutionRequestPath: requestPath,
  };

  await mkdir(requestDir, { recursive: true });
  await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  await writeFile(metadataPath, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  return {
    status: 'slice_execution_requested',
    runStatus: 'slice_execution_requested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
    metadataPath,
    reportsPath: reportPath,
    requestPath,
    sideEffects: [
      { kind: 'mkdir', path: requestDir },
      { kind: 'write_file', path: requestPath, ifExists: 'overwrite' },
      { kind: 'append_file', path: reportPath },
      { kind: 'write_file', path: metadataPath, ifExists: 'overwrite' },
    ],
  };
}

async function readRunMetadata(path: string): Promise<CookRunMetadata | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as CookRunMetadata;
  } catch {
    return undefined;
  }
}
