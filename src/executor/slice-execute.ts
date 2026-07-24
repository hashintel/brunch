import { appendFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { GitSliceIntegrationPort } from './execution-ports.js';
import { prepareIsolatedSlice, readSliceRequestContext } from './isolated-slice-operations.js';
import { reportsPath } from './report.js';
import { withRunExecutionAuthority } from './run-execution-authority.js';
import {
  assertSafeSliceId,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  type RunMetadata,
} from './run.js';
import { sliceWorkspacePath } from './slice-workspace.js';

export type SliceExecutionRequestResult =
  | {
      readonly status: 'run_execution_active';
      readonly runStatus: RunMetadata['status'] | 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_workspace_failed';
      readonly runStatus: 'slice_started';
      readonly runId: string;
      readonly sliceId: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_not_started';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'plan_slice_invalid';
      readonly runStatus: 'slice_started';
      readonly runId: string;
      readonly sliceId: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_execution_requested';
      readonly runStatus: 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId?: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly requestPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'git_worktree_add'; readonly path: string; readonly ref: string }
        | { readonly kind: 'mkdir'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
        | { readonly kind: 'append_file'; readonly path: string }
      )[];
    };

export function sliceExecutionRequestPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'agent-output', sliceId, 'request.json');
}

export async function requestSliceExecution(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
}): Promise<SliceExecutionRequestResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => requestSliceExecutionOwned(args),
    onContended: async () => {
      const metadataPath = runMetadataPath(args.cwd, args.runId);
      return {
        status: 'run_execution_active',
        runStatus: (await readRunMetadata(metadataPath))?.status ?? 'not_started',
        runId: args.runId,
        metadataPath,
        sideEffects: [],
      };
    },
  });
}

async function requestSliceExecutionOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly gitSliceIntegration: GitSliceIntegrationPort;
}): Promise<SliceExecutionRequestResult> {
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

  if (metadata.status !== 'slice_started' || !metadata.activeSliceId) {
    return {
      status: 'slice_not_started',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }
  assertSafeSliceId(metadata.activeSliceId);

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const runWorktreeDir = metadata.worktreeDir;
  if (!runWorktreeDir) {
    return {
      status: 'slice_workspace_failed',
      runStatus: 'slice_started',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      message: 'run worktree is unavailable',
      sideEffects: [],
    };
  }
  const sliceWorktreeDir = sliceWorkspacePath(args.cwd, args.runId, metadata.activeSliceId);
  const requestPath = sliceExecutionRequestPath(args.cwd, args.runId, metadata.activeSliceId);
  const sliceResult = await readSliceRequestContext({
    cwd: args.cwd,
    runId: args.runId,
    ...(metadata.populatedPlanPath ? { populatedPlanPath: metadata.populatedPlanPath } : {}),
    ...(metadata.publicPacket ? { publicPacket: metadata.publicPacket } : {}),
    sliceId: metadata.activeSliceId,
  });
  if (sliceResult.status === 'invalid') {
    return {
      status: 'plan_slice_invalid',
      runStatus: 'slice_started',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      metadataPath,
      message: sliceResult.message,
      sideEffects: [],
    };
  }
  const workspace = await prepareIsolatedSlice({
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    runWorktreeDir,
    sliceWorktreeDir,
    requestPath,
    requestContext: sliceResult.requestContext,
    ...(sliceResult.publicPacket ? { publicPacket: sliceResult.publicPacket } : {}),
    gitSliceIntegration: args.gitSliceIntegration,
    recordReport: (event) => appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8'),
  });
  if (workspace.status === 'failed') {
    return {
      status: 'slice_workspace_failed',
      runStatus: 'slice_started',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      message: workspace.message,
      sideEffects: [],
    };
  }
  const requestDir = dirname(requestPath);
  const updated: RunMetadata = {
    ...metadata,
    status: 'slice_execution_requested',
    activeSliceWorkspaceDir: sliceWorktreeDir,
    activeSliceBaseSha: workspace.baseSha,
    sliceExecutionRequestPath: requestPath,
  };

  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'slice_execution_requested',
    runStatus: 'slice_execution_requested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    metadataPath,
    reportsPath: reportPath,
    requestPath,
    sideEffects: [
      ...workspace.sideEffects,
      { kind: 'mkdir', path: requestDir },
      { kind: 'write_file', path: requestPath, ifExists: 'overwrite' },
      { kind: 'append_file', path: reportPath },
      metadataEffect,
    ],
  };
}
