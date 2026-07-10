import { readFile } from 'node:fs/promises';

import type { AgentStreamEvent } from './agent-result.js';
import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
import {
  compileExecutorTopology,
  projectSchedulerPlan,
  type ExecutorNetEvent,
  type ReadyStep,
  type SchedulerPlan,
  type SchedulerPlanMode,
} from './orchestrate-topology.js';
import { appendPetriEvent } from './petri-events.js';
import {
  petriMarkingLifecycleProvenance,
  type PetriMarkingSnapshot,
  writePetriMarkingSnapshot,
} from './petri-marking.js';
import type { PetriProjection } from './petri-replay.js';
import {
  bindExecutorPetriRuntime,
  materializeExecutorPetriRuntime,
  projectExecutorPetriTransitionHistory,
} from './petri-runtime.js';
import { classifyDriveTerminal } from './petri-terminal.js';
import { populatedPlanPath } from './populate.js';
import { readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';
import type { SourcePolicyKind } from './source-policy.js';
import type { VerifyStreamEvent } from './test-result.js';

export { compileExecutorTopology };
export type { ExecutorNetEvent, ReadyStep, SchedulerPlan, SchedulerPlanMode };

// The driver composes the existing `execute_*` lifecycle steps into a single
// self-advancing run. It owns no side effects of its own: each ReadyStep maps
// to one step function, and the run.json status IS the loop state (D112-L).

export interface RunScheduler {
  /** Pure: given current run facts, return the ready step frontier (`[]` when done). */
  ready(state: RunMetadata, plan: SchedulerPlan | undefined): readonly ReadyStep[];
}

export interface RunFiringPolicy {
  /** Pure: choose which ready steps from the current frontier this drive turn should attempt to fire. */
  select(args: {
    readonly readySteps: readonly ReadyStep[];
    readonly state: RunMetadata;
    readonly plan: SchedulerPlan | undefined;
  }): readonly ReadyStep[];
}

// A set-returning scheduler (length-1 today) leaves room for a future
// PetriScheduler that fires several enabled transitions at once (D112-L,
// geolog-and-petri-execution) without reshaping the driver loop.
export const linearScheduler: RunScheduler = {
  ready(state, plan) {
    const [next] = materializeExecutorPetriRuntime(state, plan).readySteps;
    return next ? [next] : [];
  },
};

export const petriScheduler: RunScheduler = {
  ready(state, plan) {
    return materializeExecutorPetriRuntime(state, plan).readySteps;
  },
};

export const serialFiringPolicy: RunFiringPolicy = {
  select({ readySteps }) {
    return readySteps.slice(0, 1);
  },
};

export const frontierFiringPolicy: RunFiringPolicy = {
  select({ readySteps }) {
    return readySteps;
  },
};

async function emitNetEvent(ctx: DriveContext, event: ExecutorNetEvent): Promise<void> {
  try {
    await appendPetriEvent({ cwd: ctx.cwd, runId: ctx.runId, event });
  } catch {
    // Journal failures never affect the drive.
  }
  try {
    ctx.onNetEvent?.(event);
  } catch {
    // Observer failures never affect the drive.
  }
}

async function persistPetriMarkingSnapshot(ctx: DriveContext, snapshot: PetriMarkingSnapshot): Promise<void> {
  try {
    await writePetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId, snapshot });
  } catch {
    // Marking snapshot failures never affect the drive.
  }
}

async function nextPetriSnapshot(args: {
  readonly currentMarking: Record<string, number>;
  readonly firedTransitionCount: number;
  readonly lifecycleProvenance: ReturnType<typeof petriMarkingLifecycleProvenance>;
  readonly terminalEventKind?: PetriProjection['terminalEventKind'];
  readonly haltedReason?: string;
}): Promise<PetriMarkingSnapshot> {
  return {
    currentMarking: args.currentMarking,
    firedTransitionCount: args.firedTransitionCount,
    lifecycleProvenance: args.lifecycleProvenance,
    ...(args.terminalEventKind === undefined ? {} : { terminalEventKind: args.terminalEventKind }),
    ...(args.haltedReason === undefined ? {} : { haltedReason: args.haltedReason }),
  };
}

function firedTransitionCountForState(state: RunMetadata, plan: SchedulerPlan | undefined): number {
  return projectExecutorPetriTransitionHistory(state, plan)?.transitionIds.length ?? 0;
}

export interface DriveContext {
  readonly cwd: string;
  readonly runId: string;
  readonly ports: ExecutionPorts;
  readonly sourcePolicy?: SourcePolicyKind;
  readonly runtime?: AgentRunnerRuntime;
  readonly signal?: AbortSignal;
  /** Fired before each ready step starts (observer hook; errors are swallowed). */
  readonly onStepStart?: (
    step: ReadyStep['kind'],
    runStatus: RunMetadata['status'],
    progress: DriveStepProgress,
  ) => void;
  /** Fired after each step that advanced run.json (observer hook; errors are swallowed). */
  readonly onStepComplete?: (
    step: ReadyStep['kind'],
    runStatus: RunMetadata['status'],
    progress: DriveStepProgress,
  ) => void;
  /** Fired when the sealed worker emits normalized stream events during agent_result. */
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
  /** Fired when the verify runner emits normalized stream events during test_result. */
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
  /** Fired when the executor runtime emits Petri-shaped transition or terminal facts. */
  readonly onNetEvent?: (event: ExecutorNetEvent) => void;
}

export interface DriveStepProgress {
  readonly phase: 'started' | 'completed';
  readonly step: ReadyStep;
  readonly fromStatus: RunMetadata['status'];
  readonly runStatus: RunMetadata['status'];
  readonly activeEpicId?: string;
  readonly activeSliceId?: string;
  readonly completedSliceIds: readonly string[];
}

export type DriveOutcome =
  | { readonly status: 'completed'; readonly runStatus: RunMetadata['status'] }
  | {
      readonly status: 'halted';
      readonly step: ReadyStep['kind'] | 'abandoned';
      readonly runStatus: RunMetadata['status'];
      readonly reason: string;
    }
  | { readonly status: 'missing_run'; readonly runId: string };

interface StepResult {
  readonly status: string;
  readonly runStatus: RunMetadata['status'] | 'not_started';
}

/**
 * Drive a run to `promotion_prepared` (run-local land) by repeatedly executing the
 * scheduler's ready step. Host promotion/land stays out of scope: the scheduler
 * reports no ready step once the run reaches `promotion_prepared`.
 */
export async function drive(
  ctx: DriveContext,
  scheduler: RunScheduler = linearScheduler,
  firingPolicy: RunFiringPolicy = serialFiringPolicy,
  options: { readonly maxFirings?: number } = {},
): Promise<DriveOutcome> {
  const metadataPath = runMetadataPath(ctx.cwd, ctx.runId);
  let firedTransitions = 0;
  // ceiling: coarse halt detection — a step that leaves run.json's status
  // unchanged is treated as stuck. Replace with per-step outcome classification
  // if steps gain retry/abort semantics beyond advance-or-hold.
  for (;;) {
    const state = await readRunMetadata(metadataPath);
    if (!state) return { status: 'missing_run', runId: ctx.runId };
    if (options.maxFirings !== undefined && firedTransitions >= options.maxFirings) {
      return { status: 'completed', runStatus: state.status };
    }

    const plan = await planForScheduler(ctx.cwd, state);
    const readySteps = scheduler.ready(state, plan);
    const selectedSteps = firingPolicy.select({ readySteps, state, plan });
    if (selectedSteps.length === 0) {
      const runtime = materializeExecutorPetriRuntime(state, plan);
      const terminal = classifyDriveTerminal({
        kind: 'scheduler_exhausted',
        runId: ctx.runId,
        runStatus: state.status,
      });
      await emitNetEvent(ctx, terminal.event);
      await persistPetriMarkingSnapshot(
        ctx,
        await nextPetriSnapshot({
          currentMarking: runtime.currentMarking,
          firedTransitionCount: firedTransitionCountForState(state, plan),
          lifecycleProvenance: petriMarkingLifecycleProvenance(state),
          terminalEventKind: terminal.event.kind,
          ...(terminal.event.kind === 'net_halted' ? { haltedReason: terminal.event.reason } : {}),
        }),
      );
      return terminal.outcome;
    }

    for (const selectedStep of selectedSteps) {
      const currentState = await readRunMetadata(metadataPath);
      if (!currentState) return { status: 'missing_run', runId: ctx.runId };
      const currentPlan = await planForScheduler(ctx.cwd, currentState);
      const currentReadySteps = scheduler.ready(currentState, currentPlan);
      const next = currentReadySteps.find((candidate) => readyStepsEqual(candidate, selectedStep));
      if (!next) continue;

      try {
        ctx.onStepStart?.(
          next.kind,
          currentState.status,
          progressForStep('started', next, currentState, currentState.status),
        );
      } catch {
        // Observer failures never affect the drive.
      }

      const boundRuntime = bindExecutorPetriRuntime(
        materializeExecutorPetriRuntime(currentState, currentPlan),
        ctx,
      );
      const boundTransition = boundRuntime.transitionForReadyStep(next);
      const result = boundTransition ? await boundTransition.execute() : await neverBoundReadyStep(next);
      if (result.runStatus === currentState.status) {
        const terminal = classifyDriveTerminal({
          kind: 'step_halted',
          runId: ctx.runId,
          runStatus: currentState.status,
          step: next.kind,
          reason: result.status,
        });
        await emitNetEvent(ctx, terminal.event);
        await persistPetriMarkingSnapshot(
          ctx,
          await nextPetriSnapshot({
            currentMarking: boundRuntime.runtime.currentMarking,
            firedTransitionCount: firedTransitionCountForState(currentState, currentPlan),
            lifecycleProvenance: petriMarkingLifecycleProvenance(currentState),
            terminalEventKind: terminal.event.kind,
            ...(terminal.event.kind === 'net_halted' ? { haltedReason: terminal.event.reason } : {}),
          }),
        );
        return terminal.outcome;
      }
      if (result.runStatus !== 'not_started') {
        const transition = boundTransition?.transition;
        if (transition) {
          firedTransitions += 1;
          await emitNetEvent(ctx, {
            kind: 'transition_fired',
            runId: ctx.runId,
            runStatus: result.runStatus,
            transitionId: transition.id,
            subnetId: transition.subnetId,
            ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
            step: next.kind,
            contract: transition.contract,
            consumed: transition.inputArcs.map((arc) => arc.placeId),
            produced: transition.outputArcs.map((arc) => arc.placeId),
            fromStatus: currentState.status,
            toStatus: result.runStatus,
          });
          const nextState = await readRunMetadata(metadataPath);
          if (nextState) {
            const nextPlan = await planForScheduler(ctx.cwd, nextState);
            const nextRuntime = materializeExecutorPetriRuntime(nextState, nextPlan);
            await persistPetriMarkingSnapshot(
              ctx,
              await nextPetriSnapshot({
                currentMarking: nextRuntime.currentMarking,
                firedTransitionCount: firedTransitionCountForState(nextState, nextPlan),
                lifecycleProvenance: petriMarkingLifecycleProvenance(nextState),
              }),
            );
          }
        }
        try {
          ctx.onStepComplete?.(
            next.kind,
            result.runStatus,
            progressForStep('completed', next, currentState, result.runStatus),
          );
        } catch {
          // Observer failures never affect the drive.
        }
      }
    }
  }
}

function readyStepsEqual(left: ReadyStep, right: ReadyStep): boolean {
  if (left.kind !== right.kind) return false;
  return 'sliceId' in left && 'sliceId' in right ? left.sliceId === right.sliceId : true;
}

function progressForStep(
  phase: DriveStepProgress['phase'],
  step: ReadyStep,
  state: RunMetadata,
  runStatus: RunMetadata['status'],
): DriveStepProgress {
  return {
    phase,
    step,
    fromStatus: state.status,
    runStatus,
    ...(state.activeEpicId ? { activeEpicId: state.activeEpicId } : {}),
    ...(state.activeSliceId ? { activeSliceId: state.activeSliceId } : {}),
    completedSliceIds: state.completedSliceIds ?? [],
  };
}

async function planForScheduler(cwd: string, state: RunMetadata): Promise<SchedulerPlan | undefined> {
  const path = state.populatedPlanPath
    ? state.populatedPlanPath
    : state.status === 'reports_initialized' || state.status === 'slice_completed'
      ? populatedPlanPath(cwd, state.runId)
      : undefined;
  if (!path) return undefined;
  return projectSchedulerPlan(JSON.parse(await readFile(path, 'utf8')));
}

async function neverBoundReadyStep(step: ReadyStep): Promise<StepResult> {
  throw new Error(`missing bound Petri transition for ready step ${step.kind}`);
}
