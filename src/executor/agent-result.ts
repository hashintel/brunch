import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentRunnerPort } from './execution-ports.js';
import { reportsPath } from './report.js';
import {
  assertSafeSliceId,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  type RunMetadata,
} from './run.js';
import { sliceExecutionRequestPath } from './slice-execute.js';
import { worktreeDirPath } from './worktree.js';

export type AgentResultIngestResult =
  | {
      readonly status: 'missing_run';
      readonly runStatus: 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'slice_not_requested';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'agent_run_failed';
      readonly runStatus: 'slice_execution_requested';
      readonly runId: string;
      readonly sliceId: string;
      readonly worktreeDir: string;
      readonly metadataPath: string;
      readonly message: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'agent_result_ingested';
      readonly runStatus: 'agent_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId: string;
      readonly resultPath: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly [
        { readonly kind: 'append_file'; readonly path: string },
        { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' },
      ];
    };

export function agentResultPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'agent-output', sliceId, 'result.json');
}

export async function ingestAgentResult(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly agentRunner: AgentRunnerPort;
}): Promise<AgentResultIngestResult> {
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

  if (metadata.status !== 'slice_execution_requested' || !metadata.activeSliceId || !metadata.activeEpicId) {
    return {
      status: 'slice_not_requested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const worktreeDir = metadata.worktreeDir ?? worktreeDirPath(args.cwd, args.runId);
  const requestPath =
    metadata.sliceExecutionRequestPath ??
    sliceExecutionRequestPath(args.cwd, args.runId, metadata.activeSliceId);
  const resultPath = agentResultPath(args.cwd, args.runId, metadata.activeSliceId);
  const runResult = await args.agentRunner.run({
    worktreeDir,
    requestPath,
    resultPath,
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
  });
  if (runResult.status === 'failed') {
    return {
      status: 'agent_run_failed',
      runStatus: 'slice_execution_requested',
      runId: args.runId,
      sliceId: metadata.activeSliceId,
      worktreeDir,
      metadataPath,
      message: runResult.message,
      sideEffects: [],
    };
  }

  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const event = {
    event: 'slice_agent_result',
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    status: runResult.status,
    ...(runResult.summary ? { summary: runResult.summary } : {}),
  };
  const updated: RunMetadata = {
    ...metadata,
    status: 'agent_result_ingested',
    agentResultPath: resultPath,
  };

  await appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8');
  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'agent_result_ingested',
    runStatus: 'agent_result_ingested',
    runId: args.runId,
    sliceId: metadata.activeSliceId,
    epicId: metadata.activeEpicId,
    resultPath,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [{ kind: 'append_file', path: reportPath }, metadataEffect],
  };
}
