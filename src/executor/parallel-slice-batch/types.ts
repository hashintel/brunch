import type { AgentRunnerRuntime, ExecutionPorts } from '../execution-ports.js';
import type { AgentStreamEvent, VerifyStreamEvent } from '../isolated-slice-operations.js';
import type { ReadyStep, SchedulerPlan } from '../orchestrate-topology.js';
import type { DriveStepProgress } from '../orchestrate.js';
import type { ExecutorPetriRuntime } from '../petri-runtime.js';
import type { RunMetadata, SliceAttemptHistory } from '../run.js';

export interface ParallelSliceBatchContext {
  readonly cwd: string;
  readonly runId: string;
  readonly ports: ExecutionPorts;
  readonly runtime?: AgentRunnerRuntime;
  readonly signal?: AbortSignal;
  readonly onStepStart?: (
    step: ReadyStep['kind'],
    runStatus: RunMetadata['status'],
    progress: DriveStepProgress,
  ) => void;
  readonly onStepComplete?: (
    step: ReadyStep['kind'],
    runStatus: RunMetadata['status'],
    progress: DriveStepProgress,
  ) => void;
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
}

export type ParallelSliceStep = Extract<ReadyStep, { readonly kind: 'slice_start' }>;

export interface ParallelSliceBatchArgs {
  readonly ctx: ParallelSliceBatchContext;
  readonly state: RunMetadata;
  readonly plan: SchedulerPlan;
  readonly runtime: ExecutorPetriRuntime;
  readonly steps: readonly ParallelSliceStep[];
}

export type ParallelSliceBatchResult =
  | { readonly status: 'completed'; readonly runStatus: RunMetadata['status']; readonly firings: number }
  | {
      readonly status: 'halted';
      readonly runStatus: RunMetadata['status'];
      readonly step: ReadyStep['kind'];
      readonly reason: string;
    };

export interface SliceEffectSuccess {
  readonly status: 'succeeded';
  readonly sliceId: string;
  readonly epicId?: string;
  readonly workspaceDir: string;
  readonly baseSha: string;
  readonly attemptHistory: SliceAttemptHistory;
}

export interface SliceEffectFailure {
  readonly status: 'failed';
  readonly sliceId: string;
  readonly step: ReadyStep['kind'];
  readonly reason: string;
  readonly attemptHistory: SliceAttemptHistory;
}

export type SliceEffectResult = SliceEffectSuccess | SliceEffectFailure;
