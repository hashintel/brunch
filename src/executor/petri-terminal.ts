import type { ExecutorNetEventPayload, ReadyStep } from './orchestrate-topology.js';
import type { RunMetadata } from './run.js';

export type DriveTerminalClassification =
  | {
      readonly event: Extract<ExecutorNetEventPayload, { readonly kind: 'net_completed' }>;
      readonly outcome: {
        readonly status: 'completed';
        readonly runStatus: RunMetadata['status'];
      };
    }
  | {
      readonly event: Extract<ExecutorNetEventPayload, { readonly kind: 'net_halted' | 'net_deadlocked' }>;
      readonly outcome: {
        readonly status: 'halted';
        readonly step: ReadyStep['kind'] | 'abandoned' | 'deadlocked';
        readonly runStatus: RunMetadata['status'];
        readonly reason: string;
      };
    };

export function classifyDriveTerminal(
  args:
    | {
        readonly kind: 'scheduler_exhausted';
        readonly runId: string;
        readonly runStatus: RunMetadata['status'];
        readonly failedSliceIds?: readonly string[];
      }
    | {
        readonly kind: 'step_halted';
        readonly runId: string;
        readonly runStatus: RunMetadata['status'];
        readonly step: ReadyStep['kind'];
        readonly reason: string;
        readonly failedSliceIds?: readonly string[];
      },
): DriveTerminalClassification {
  if (args.kind === 'step_halted') {
    return {
      event: {
        kind: 'net_halted',
        runId: args.runId,
        runStatus: args.runStatus,
        step: args.step,
        reason: args.reason,
        failedSliceIds: args.failedSliceIds ?? [],
      },
      outcome: {
        status: 'halted',
        step: args.step,
        runStatus: args.runStatus,
        reason: args.reason,
      },
    };
  }

  if (args.runStatus === 'abandoned') {
    return {
      event: {
        kind: 'net_halted',
        runId: args.runId,
        runStatus: args.runStatus,
        reason: 'abandoned',
        failedSliceIds: args.failedSliceIds ?? [],
      },
      outcome: {
        status: 'halted',
        step: 'abandoned',
        runStatus: args.runStatus,
        reason: 'abandoned',
      },
    };
  }

  if (args.failedSliceIds?.length) {
    return {
      event: {
        kind: 'net_halted',
        runId: args.runId,
        runStatus: args.runStatus,
        step: 'test_result',
        reason: 'slice_verification_not_passed',
        failedSliceIds: args.failedSliceIds,
      },
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: args.runStatus,
        reason: 'slice_verification_not_passed',
      },
    };
  }

  if (args.runStatus !== 'promotion_prepared') {
    return {
      event: {
        kind: 'net_deadlocked',
        runId: args.runId,
        runStatus: args.runStatus,
        failedSliceIds: args.failedSliceIds ?? [],
      },
      outcome: {
        status: 'halted',
        step: 'deadlocked',
        runStatus: args.runStatus,
        reason: 'petri_deadlocked',
      },
    };
  }

  return {
    event: {
      kind: 'net_completed',
      runId: args.runId,
      runStatus: args.runStatus,
      failedSliceIds: args.failedSliceIds ?? [],
    },
    outcome: {
      status: 'completed',
      runStatus: args.runStatus,
    },
  };
}
