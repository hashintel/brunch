import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { AgentRunnerPort, AgentRunnerRuntime, AgentRunUpdate } from './execution-ports.js';
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
      readonly sideEffects: readonly (
        | { readonly kind: 'append_file'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export function agentResultPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'agent-output', sliceId, 'result.json');
}

export interface AgentStreamEvent extends AgentRunUpdate {
  readonly event: 'agent_stream';
  readonly runId: string;
  readonly epicId: string;
  readonly sliceId: string;
  readonly sequence: number;
}

export function agentStreamPath(cwd: string, runId: string, sliceId: string): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'streams', sliceId, 'agent.jsonl');
}

export async function ingestAgentResult(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly agentRunner: AgentRunnerPort;
  readonly runtime?: AgentRunnerRuntime;
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
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
  const streamPath = agentStreamPath(args.cwd, args.runId, metadata.activeSliceId);
  let sequence = 0;
  let wroteStream = false;
  const runResult = await args.agentRunner.run({
    worktreeDir,
    requestPath,
    resultPath,
    runId: args.runId,
    epicId: metadata.activeEpicId,
    sliceId: metadata.activeSliceId,
    ...(args.runtime ? { runtime: args.runtime } : {}),
    onUpdate: async (update) => {
      const event: AgentStreamEvent = {
        event: 'agent_stream',
        runId: args.runId,
        epicId: metadata.activeEpicId!,
        sliceId: metadata.activeSliceId!,
        sequence: sequence,
        kind: update.kind,
        message: update.message,
      };
      sequence += 1;
      await mkdir(dirname(streamPath), { recursive: true });
      await appendFile(streamPath, `${JSON.stringify(event)}\n`, 'utf8');
      wroteStream = true;
      try {
        args.onAgentUpdate?.(event);
      } catch {
        // Observer failures never affect worker execution.
      }
    },
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
    sideEffects: [
      ...(wroteStream ? [{ kind: 'append_file' as const, path: streamPath }] : []),
      { kind: 'append_file', path: reportPath },
      metadataEffect,
    ],
  };
}
