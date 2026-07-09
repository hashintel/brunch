import type { ExecutorNetEvent, ReadyStep } from './orchestrate-topology.js';
import type { RunMetadata } from './run.js';

export type DriveTerminalClassification =
  | {
      readonly event: Extract<ExecutorNetEvent, { readonly kind: 'net_completed' }>;
      readonly outcome: {
        readonly status: 'completed';
        readonly runStatus: RunMetadata['status'];
      };
    }
  | {
      readonly event: Extract<ExecutorNetEvent, { readonly kind: 'net_halted' }>;
      readonly outcome: {
        readonly status: 'halted';
        readonly step: ReadyStep['kind'] | 'abandoned';
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
      }
    | {
        readonly kind: 'step_halted';
        readonly runId: string;
        readonly runStatus: RunMetadata['status'];
        readonly step: ReadyStep['kind'];
        readonly reason: string;
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
      },
      outcome: {
        status: 'halted',
        step: 'abandoned',
        runStatus: args.runStatus,
        reason: 'abandoned',
      },
    };
  }

  return {
    event: {
      kind: 'net_completed',
      runId: args.runId,
      runStatus: args.runStatus,
    },
    outcome: {
      status: 'completed',
      runStatus: args.runStatus,
    },
  };
}
