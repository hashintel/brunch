import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { AgentRunnerPort, AgentRunnerRuntime } from './execution-ports.js';
import {
  attachIsolatedAttemptOutcome,
  mergeAttemptHistory,
  runIsolatedAgentAttempt,
  type AgentStreamEvent,
} from './isolated-slice-operations.js';
import { readDurableRunTerminal, type PetriTerminalEvent } from './petri-events.js';
import { reportsPath } from './report.js';
import { withRunExecutionAuthority } from './run-execution-authority.js';
import {
  assertSafeSliceId,
  activeSliceRepairCycle,
  activeSliceAttemptNumber,
  runDirPath,
  runMetadataPath,
  persistRunMetadata,
  readRunMetadata,
  sliceArtifactAttemptNumber,
  type RunMetadata,
  type RunMetadataWriteEffect,
} from './run.js';
import { sliceExecutionRequestPath } from './slice-execute.js';
import { MAX_STAGE_ATTEMPTS, sliceRepairProtocol, type SliceRepairStage } from './slice-repair-cycle.js';
import { worktreeDirPath } from './worktree.js';

export type AgentResultIngestResult =
  | {
      readonly status: 'run_execution_active';
      readonly runStatus: RunMetadata['status'] | 'not_started';
      readonly runId: string;
      readonly metadataPath: string;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'petri_terminal_recorded';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly terminal: PetriTerminalEvent;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'attempt_reset_pending';
      readonly runStatus: RunMetadata['status'];
      readonly runId: string;
      readonly metadataPath: string;
      readonly stage: SliceRepairStage;
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
      readonly attempts: number;
      readonly sideEffects: readonly (
        | { readonly kind: 'append_file'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    }
  | {
      readonly status: 'agent_result_ingested';
      readonly runStatus: 'agent_result_ingested';
      readonly runId: string;
      readonly sliceId: string;
      readonly epicId?: string;
      readonly resultPath: string;
      readonly metadataPath: string;
      readonly reportsPath: string;
      readonly sideEffects: readonly (
        | { readonly kind: 'append_file'; readonly path: string }
        | { readonly kind: 'write_file'; readonly path: string; readonly ifExists: 'overwrite' }
      )[];
    };

export function agentResultPath(cwd: string, runId: string, sliceId: string, attempt = 1): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'agent-output', sliceId, `attempt-${attempt}`, 'result.json');
}

export function agentStreamPath(cwd: string, runId: string, sliceId: string, attempt = 1): string {
  assertSafeSliceId(sliceId);
  return join(runDirPath(cwd, runId), 'streams', sliceId, `agent-attempt-${attempt}.jsonl`);
}

export async function ingestAgentResult(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly agentRunner: AgentRunnerPort;
  readonly runtime?: AgentRunnerRuntime;
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
}): Promise<AgentResultIngestResult> {
  return withRunExecutionAuthority({
    cwd: args.cwd,
    runId: args.runId,
    execute: () => ingestAgentResultOwned(args),
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

async function ingestAgentResultOwned(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly agentRunner: AgentRunnerPort;
  readonly runtime?: AgentRunnerRuntime;
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
}): Promise<AgentResultIngestResult> {
  const metadataPath = runMetadataPath(args.cwd, args.runId);
  let metadata = await readRunMetadata(metadataPath);
  if (!metadata) {
    return {
      status: 'missing_run',
      runStatus: 'not_started',
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }

  const terminal = await readDurableRunTerminal(args);
  if (terminal) {
    return {
      status: 'petri_terminal_recorded',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      terminal,
      sideEffects: [],
    };
  }

  if (metadata.activeSliceAttemptReset) {
    return {
      status: 'attempt_reset_pending',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      stage: metadata.activeSliceAttemptReset.stage,
      sideEffects: [],
    };
  }

  if (metadata.status !== 'slice_execution_requested' || !metadata.activeSliceId) {
    return {
      status: 'slice_not_requested',
      runStatus: metadata.status,
      runId: args.runId,
      metadataPath,
      sideEffects: [],
    };
  }
  const sliceId = metadata.activeSliceId;

  let repairActivationEffect: RunMetadataWriteEffect | undefined;
  if (metadata.pendingSliceRepair) {
    const trusted = {
      runDir: runDirPath(args.cwd, args.runId),
      runId: args.runId,
      sliceId,
      target: metadata.verifyTarget!,
      policy: sliceRepairProtocol.policy,
      history: metadata.sliceRepairHistory!,
    };
    const pending = await sliceRepairProtocol.materializeRepair({
      pending: metadata.pendingSliceRepair,
      trusted,
    });
    const activeSliceRepairContext = sliceRepairProtocol.activateRepair({
      pending,
      trusted,
    });
    const { pendingSliceRepair: _pendingSliceRepair, ...withoutPendingRepair } = metadata;
    metadata = {
      ...withoutPendingRepair,
      activeSliceRepairContext,
      activeSliceRepairAuthority: pending,
    };
    repairActivationEffect = await persistRunMetadata(metadataPath, metadata);
  }

  const worktreeDir =
    metadata.activeSliceWorkspaceDir ?? metadata.worktreeDir ?? worktreeDirPath(args.cwd, args.runId);
  const requestPath =
    metadata.sliceExecutionRequestPath ?? sliceExecutionRequestPath(args.cwd, args.runId, sliceId);
  const artifactAttempt = sliceArtifactAttemptNumber(metadata, sliceId, 'agent');
  const cycle = activeSliceRepairCycle(metadata);
  const resultPath = agentResultPath(args.cwd, args.runId, sliceId, artifactAttempt);
  const streamPath = agentStreamPath(args.cwd, args.runId, sliceId, artifactAttempt);
  const reportPath = metadata.reportsPath ?? reportsPath(args.cwd, args.runId);
  const attemptResult = await runIsolatedAgentAttempt({
    runId: args.runId,
    sliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    worktreeDir,
    requestPath,
    resultPath,
    streamPath,
    cycle,
    attempt: activeSliceAttemptNumber(metadata),
    artifactAttempt,
    ...(metadata.activeSliceRepairContext === undefined
      ? {}
      : {
          repairContext: metadata.activeSliceRepairContext,
          repairContextAuthority: {
            pending: metadata.activeSliceRepairAuthority!,
            runDir: runDirPath(args.cwd, args.runId),
            target: metadata.verifyTarget!,
            history: metadata.sliceRepairHistory!,
          },
        }),
    agentRunner: args.agentRunner,
    ...(args.runtime ? { runtime: args.runtime } : {}),
    recordReport: (event) => appendFile(reportPath, `${JSON.stringify(event)}\n`, 'utf8'),
    ...(args.onAgentUpdate ? { onUpdate: args.onAgentUpdate } : {}),
  });
  const runResult = attemptResult.result;
  const wroteStream = attemptResult.wroteStream;
  if (runResult.status === 'failed') {
    const attempts = activeSliceAttemptNumber(metadata);
    const metadataEffect = await persistRunMetadata(metadataPath, {
      ...metadata,
      activeSliceAttempts: attempts,
      ...(attempts === MAX_STAGE_ATTEMPTS
        ? {
            sliceRepairHistory: mergeAttemptHistory(
              metadata.sliceRepairHistory,
              attemptResult.outcome.historyDelta,
            ),
          }
        : {}),
    });
    return attachIsolatedAttemptOutcome(
      {
        status: 'agent_run_failed',
        runStatus: 'slice_execution_requested',
        runId: args.runId,
        sliceId,
        worktreeDir,
        metadataPath,
        message: runResult.message,
        attempts,
        sideEffects: [
          ...(repairActivationEffect ? [repairActivationEffect] : []),
          ...(wroteStream ? [{ kind: 'append_file' as const, path: streamPath }] : []),
          metadataEffect,
        ],
      },
      attemptResult.outcome,
    );
  }

  const { activeSliceAttempts: _cleared, ...metadataWithoutAttempts } = metadata;
  const updated: RunMetadata = {
    ...metadataWithoutAttempts,
    status: 'agent_result_ingested',
    agentResultPath: resultPath,
    sliceRepairHistory: mergeAttemptHistory(metadata.sliceRepairHistory, attemptResult.outcome.historyDelta),
  };

  const metadataEffect = await persistRunMetadata(metadataPath, updated);

  return {
    status: 'agent_result_ingested',
    runStatus: 'agent_result_ingested',
    runId: args.runId,
    sliceId,
    ...(metadata.activeEpicId === undefined ? {} : { epicId: metadata.activeEpicId }),
    resultPath,
    metadataPath,
    reportsPath: reportPath,
    sideEffects: [
      ...(repairActivationEffect ? [repairActivationEffect] : []),
      ...(wroteStream ? [{ kind: 'append_file' as const, path: streamPath }] : []),
      { kind: 'append_file', path: reportPath },
      metadataEffect,
    ],
  };
}
