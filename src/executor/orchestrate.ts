import type { AgentStreamEvent } from './agent-result.js';
import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
import {
  attemptExhaustedTransitionId,
  attemptRetryTransitionId,
  attemptResetTransitionId,
  compileExecutorTopology,
  SLICE_ATTEMPT_LIMIT,
  type ExecutorNetEvent,
  type ReadyStep,
  type SchedulerPlan,
  type SchedulerPlanMode,
} from './orchestrate-topology.js';
import { appendPetriEvent } from './petri-events.js';
import {
  petriMarkingLifecycleProvenance,
  petriMarkingSnapshotMatchesRunMetadata,
  readPetriMarkingSnapshot,
  type PetriMarkingSnapshot,
  writePetriMarkingSnapshot,
} from './petri-marking.js';
import type { PetriProjection } from './petri-replay.js';
import { readPetriRuntimePlan } from './petri-runtime-plan.js';
import {
  bindExecutorPetriRuntime,
  materializeExecutorPetriRuntime,
  projectExecutorPetriTransitionHistory,
  type ExecutorPetriRuntime,
} from './petri-runtime.js';
import { classifyDriveTerminal } from './petri-terminal.js';
import { PetriObservationInputError, preparePetriObservation } from './petri.js';
import {
  appendSliceAttemptCycle,
  persistRunMetadata,
  readRunMetadata,
  runMetadataPath,
  type RunMetadata,
} from './run.js';
import type { SourcePolicyKind } from './source-policy.js';
import type { VerifyStreamEvent } from './test-result.js';

export { compileExecutorTopology };
export type { ExecutorNetEvent, ReadyStep, SchedulerPlan, SchedulerPlanMode };

// The driver composes the existing `execute_*` lifecycle steps into a single
// self-advancing run. It owns no side effects of its own: each ReadyStep maps
// to one step function, and the run.json status IS the loop state (D112-L).

export interface RunScheduler {
  /** Pure: given current run facts, return the ready step frontier (`[]` when done). */
  ready(
    state: RunMetadata,
    plan: SchedulerPlan | undefined,
    runtime?: ExecutorPetriRuntime,
  ): readonly ReadyStep[];
}

export interface RunFiringPolicy {
  /** Pure: choose which ready steps from the current frontier this drive turn should attempt to fire. */
  select(args: {
    readonly readySteps: readonly ReadyStep[];
    readonly readyRuntime?: Pick<ExecutorPetriRuntime, 'currentMarking'> & {
      readonly enabledTransitions: readonly ReturnType<ExecutorPetriRuntime['transitionForReadyStep']>[];
    };
    readonly state: RunMetadata;
    readonly plan: SchedulerPlan | undefined;
  }): readonly ReadyStep[];
}

// A set-returning scheduler (length-1 today) leaves room for a future
// PetriScheduler that fires several enabled transitions at once (D112-L,
// geolog-and-petri-execution) without reshaping the driver loop.
export const linearScheduler: RunScheduler = {
  ready(state, plan, runtime) {
    const [next] = (runtime ?? materializeExecutorPetriRuntime(state, plan)).readySteps;
    return next ? [next] : [];
  },
};

export const petriScheduler: RunScheduler = {
  ready(state, plan, runtime) {
    return (runtime ?? materializeExecutorPetriRuntime(state, plan)).readySteps;
  },
};

export const serialFiringPolicy: RunFiringPolicy = {
  select({ readySteps }) {
    return readySteps.slice(0, 1);
  },
};

export const frontierFiringPolicy: RunFiringPolicy = {
  select({ readySteps, readyRuntime }) {
    if (!readyRuntime) return readySteps;
    const claimedInputs = new Map<string, number>();
    const selectedSteps: ReadyStep[] = [];
    for (const transition of readyRuntime.enabledTransitions) {
      if (!transition) continue;
      const canClaim = transition.inputArcs.every((arc) => {
        const claimed = claimedInputs.get(arc.placeId) ?? 0;
        return claimed + arc.weight <= (readyRuntime.currentMarking[arc.placeId] ?? 0);
      });
      if (!canClaim) continue;
      for (const arc of transition.inputArcs) {
        claimedInputs.set(arc.placeId, (claimedInputs.get(arc.placeId) ?? 0) + arc.weight);
      }
      selectedSteps.push(transition.step);
    }
    return selectedSteps;
  },
};

// Fail closed (FE-1190): an unjournaled event reaches no hint surface and the
// drive halts, keeping the journal a truthful prefix of run facts.
// ceiling: retry after a journal-failure halt resumes from run.json without
// backfilling the lost event; gate retry on journal-vs-lifecycle counts if
// gapped journals show up.
async function emitNetEvent(
  ctx: Pick<DriveContext, 'cwd' | 'runId'>,
  event: ExecutorNetEvent,
): Promise<{ readonly journaled: boolean }> {
  try {
    await appendPetriEvent({ cwd: ctx.cwd, runId: ctx.runId, event });
  } catch {
    return { journaled: false };
  }
  return { journaled: true };
}

// An unjournaled terminal must not read as completed; an already-halted
// terminal keeps its root-cause reason.
function journalFailureOutcome(terminal: ReturnType<typeof classifyDriveTerminal>): DriveOutcome {
  if (terminal.outcome.status === 'halted') return terminal.outcome;
  return {
    status: 'halted',
    step: 'terminal',
    runStatus: terminal.outcome.runStatus,
    reason: 'petri_journal_append_failed',
  };
}

async function persistPetriMarkingSnapshot(
  ctx: Pick<DriveContext, 'cwd' | 'runId'>,
  snapshot: PetriMarkingSnapshot,
): Promise<void> {
  try {
    await writePetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId, snapshot });
  } catch {
    // Marking snapshot failures never affect the drive.
  }
}

async function nextPetriSnapshot(args: {
  readonly claimedTransitionIds?: readonly string[];
  readonly currentMarking: Record<string, number>;
  readonly firedTransitionCount: number;
  readonly lifecycleProvenance: ReturnType<typeof petriMarkingLifecycleProvenance>;
  readonly terminalEventKind?: PetriProjection['terminalEventKind'];
  readonly haltedReason?: string;
}): Promise<PetriMarkingSnapshot> {
  return {
    ...(args.claimedTransitionIds === undefined ? {} : { claimedTransitionIds: args.claimedTransitionIds }),
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

function schedulerPlanRequiredStep(state: RunMetadata): ReadyStep['kind'] | undefined {
  switch (state.status) {
    case 'reports_initialized':
    case 'slice_completed':
      return 'slice_start';
    case 'slice_started':
      return 'slice_execute';
    case 'slice_execution_requested':
      return 'agent_result';
    case 'agent_result_ingested':
      return 'test_result';
    case 'test_result_ingested':
      return 'slice_integrate';
    case 'slice_integrated':
      return 'slice_complete';
    default:
      return undefined;
  }
}

function petriInputRequiredStep(state: RunMetadata): ReadyStep['kind'] | undefined {
  switch (state.status) {
    case 'created':
      return 'worktree_create';
    case 'worktree_created':
      return 'populate';
    case 'worktree_populated':
      return 'source_policy';
    case 'source_policy_selected':
      return 'source_copy';
    case 'source_copied':
      return 'report_init';
    case 'reports_initialized':
    case 'slice_completed':
      return 'slice_start';
    case 'slice_started':
      return 'slice_execute';
    case 'slice_execution_requested':
      return 'agent_result';
    case 'agent_result_ingested':
      return 'test_result';
    case 'test_result_ingested':
      return 'slice_integrate';
    case 'slice_integrated':
      return 'slice_complete';
    case 'run_completed':
      return 'petri_export';
    case 'petri_exported':
    case 'promotion_prepared':
      return 'promotion';
    case 'abandoned':
      return undefined;
  }
}

async function materializeDriveRuntime(args: {
  readonly ctx: Pick<DriveContext, 'cwd' | 'runId'>;
  readonly state: RunMetadata;
  readonly plan: SchedulerPlan | undefined;
}): Promise<{ readonly runtime: ExecutorPetriRuntime } | { readonly outcome: DriveOutcome }> {
  try {
    return { runtime: materializeExecutorPetriRuntime(args.state, args.plan) };
  } catch {
    const step = petriInputRequiredStep(args.state);
    if (!step) {
      if (args.state.status === 'abandoned') {
        const terminal = classifyDriveTerminal({
          kind: 'scheduler_exhausted',
          runId: args.ctx.runId,
          runStatus: args.state.status,
        });
        await emitNetEvent(args.ctx, terminal.event);
        return { outcome: terminal.outcome };
      }
      throw new Error(`unexpected Petri materialization failure for run status ${args.state.status}`);
    }
    const terminal = classifyDriveTerminal({
      kind: 'step_halted',
      runId: args.ctx.runId,
      runStatus: args.state.status,
      step,
      reason: 'petri_input_unreadable',
    });
    await emitNetEvent(args.ctx, terminal.event);
    return { outcome: terminal.outcome };
  }
}

function snapshotAlreadyCapturesTerminal(args: {
  readonly snapshot: PetriMarkingSnapshot | undefined;
  readonly state: RunMetadata;
  readonly runtime: ExecutorPetriRuntime;
  readonly plan: SchedulerPlan | undefined;
  readonly terminal: ReturnType<typeof classifyDriveTerminal>;
}): boolean {
  const { snapshot, state, runtime, plan, terminal } = args;
  if (!snapshot || !petriMarkingSnapshotMatchesRunMetadata(snapshot, state)) return false;
  if (snapshot.firedTransitionCount !== firedTransitionCountForState(state, plan)) return false;
  if (!petriMarkingsEqual(snapshot.currentMarking, runtime.currentMarking)) return false;
  if (snapshot.terminalEventKind !== terminal.event.kind) return false;
  return terminal.event.kind !== 'net_halted' || snapshot.haltedReason === terminal.event.reason;
}

export type DriveOutcome =
  | { readonly status: 'completed'; readonly runStatus: RunMetadata['status'] }
  | {
      readonly status: 'halted';
      // 'terminal' marks a net terminal fact that could not be durably journaled.
      readonly step: ReadyStep['kind'] | 'abandoned' | 'deadlocked' | 'terminal';
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
  let observationPreparationAttempted = false;
  // ceiling: coarse halt detection — a step that leaves run.json's status
  // unchanged is treated as stuck. Replace with per-step outcome classification
  // if steps gain retry/abort semantics beyond advance-or-hold.
  for (;;) {
    const state = await readRunMetadata(metadataPath);
    if (!state) return { status: 'missing_run', runId: ctx.runId };
    if (options.maxFirings !== undefined && firedTransitions >= options.maxFirings) {
      return { status: 'completed', runStatus: state.status };
    }

    let plan = await readPetriRuntimePlan(ctx.cwd, state);
    const requiredPlanStep = schedulerPlanRequiredStep(state);
    const observationPreparationStep =
      state.status === 'created'
        ? 'worktree_create'
        : state.status === 'worktree_created'
          ? 'populate'
          : undefined;
    if (plan === undefined && requiredPlanStep) {
      const terminal = classifyDriveTerminal({
        kind: 'step_halted',
        runId: ctx.runId,
        runStatus: state.status,
        step: requiredPlanStep,
        reason: 'scheduler_plan_unreadable',
      });
      await emitNetEvent(ctx, terminal.event);
      return terminal.outcome;
    }
    if (!observationPreparationAttempted && plan !== undefined && observationPreparationStep !== undefined) {
      observationPreparationAttempted = true;
      try {
        plan = await preparePetriObservation({ cwd: ctx.cwd, runId: ctx.runId });
      } catch (error) {
        const terminal = classifyDriveTerminal({
          kind: 'step_halted',
          runId: ctx.runId,
          runStatus: state.status,
          step: observationPreparationStep,
          reason:
            error instanceof PetriObservationInputError
              ? 'petri_input_unreadable'
              : 'petrinaut_observation_unavailable',
        });
        await emitNetEvent(ctx, terminal.event);
        return terminal.outcome;
      }
    }
    if (state.activeSliceAttemptReset && state.activeSliceId && plan) {
      const reset = await applyPendingAttemptReset(ctx, state, plan);
      if (!reset.applied) return reset.outcome;
      continue;
    }
    const runtimeResult = await materializeDriveRuntime({ ctx, state, plan });
    if ('outcome' in runtimeResult) {
      return runtimeResult.outcome;
    }
    const runtime = runtimeResult.runtime;
    const readySteps = scheduler.ready(state, plan, runtime);
    const selectedSteps =
      (await readClaimedReadySteps(ctx, state, plan, runtime, readySteps)) ??
      firingPolicy.select({
        readySteps,
        readyRuntime: {
          currentMarking: runtime.currentMarking,
          enabledTransitions: readySteps.map((step) => runtime.transitionForReadyStep(step)),
        },
        state,
        plan,
      });
    if (selectedSteps.length === 0) {
      const terminal = classifyDriveTerminal({
        kind: 'scheduler_exhausted',
        runId: ctx.runId,
        runStatus: state.status,
      });
      const snapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
      if (snapshotAlreadyCapturesTerminal({ snapshot, state, runtime, plan, terminal })) {
        return terminal.outcome;
      }
      const emitted = await emitNetEvent(ctx, terminal.event);
      if (!emitted.journaled) return journalFailureOutcome(terminal);
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

    const claimedTransitionIds = selectedSteps.flatMap((step) => {
      const transition = runtime.transitionForReadyStep(step);
      return transition ? [transition.id] : [];
    });
    await persistPetriMarkingSnapshot(
      ctx,
      await nextPetriSnapshot({
        ...(claimedTransitionIds.length === 0 ? {} : { claimedTransitionIds }),
        currentMarking: runtime.currentMarking,
        firedTransitionCount: firedTransitionCountForState(state, plan),
        lifecycleProvenance: petriMarkingLifecycleProvenance(state),
      }),
    );

    for (const [selectedIndex, selectedStep] of selectedSteps.entries()) {
      const currentState = await readRunMetadata(metadataPath);
      if (!currentState) return { status: 'missing_run', runId: ctx.runId };
      const currentPlan = await readPetriRuntimePlan(ctx.cwd, currentState);
      const currentRuntimeResult = await materializeDriveRuntime({
        ctx,
        state: currentState,
        plan: currentPlan,
      });
      if ('outcome' in currentRuntimeResult) {
        return currentRuntimeResult.outcome;
      }
      const currentRuntime = currentRuntimeResult.runtime;
      const next = currentRuntime.readySteps.find((candidate) => readyStepsEqual(candidate, selectedStep));
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

      const boundRuntime = bindExecutorPetriRuntime(currentRuntime, ctx);
      const boundTransition = boundRuntime.transitionForReadyStep(next);
      const result = boundTransition ? await boundTransition.execute() : await neverBoundReadyStep(next);
      if (result.runStatus === currentState.status) {
        if (
          (result.status === 'agent_run_failed' || result.status === 'test_run_failed') &&
          'attempts' in result &&
          typeof result.attempts === 'number' &&
          currentState.activeSliceId !== undefined
        ) {
          const emitted = await emitNetEvent(ctx, {
            kind: 'attempt_failed',
            runId: ctx.runId,
            runStatus: currentState.status,
            sliceId: currentState.activeSliceId,
            ...(currentState.activeEpicId === undefined ? {} : { epicId: currentState.activeEpicId }),
            step: result.status === 'agent_run_failed' ? 'agent_result' : 'test_result',
            attempt: result.attempts,
            reason: result.status,
          });
          if (!emitted.journaled) {
            return {
              status: 'halted',
              step: next.kind,
              runStatus: currentState.status,
              reason: 'petri_journal_append_failed',
            };
          }
          const attemptTransitionJournaled = await emitAttemptMarkingTransition({
            ctx,
            runtime: currentRuntime,
            state: currentState,
            step: result.status === 'agent_run_failed' ? 'agent_result' : 'test_result',
            sliceId: currentState.activeSliceId,
            attempt: result.attempts,
          });
          if (!attemptTransitionJournaled) {
            return {
              status: 'halted',
              step: next.kind,
              runStatus: currentState.status,
              reason: 'petri_journal_append_failed',
            };
          }
          if (result.attempts < SLICE_ATTEMPT_LIMIT) continue;
        }
        const terminal = classifyDriveTerminal({
          kind: 'step_halted',
          runId: ctx.runId,
          runStatus: currentState.status,
          step: next.kind,
          reason: result.status,
        });
        const emitted = await emitNetEvent(ctx, terminal.event);
        if (!emitted.journaled) return journalFailureOutcome(terminal);
        const haltedState = (await readRunMetadata(metadataPath)) ?? currentState;
        const haltedRuntime = materializeExecutorPetriRuntime(haltedState, currentPlan);
        await persistPetriMarkingSnapshot(
          ctx,
          await nextPetriSnapshot({
            currentMarking: haltedRuntime.currentMarking,
            firedTransitionCount: firedTransitionCountForState(haltedState, currentPlan),
            lifecycleProvenance: petriMarkingLifecycleProvenance(haltedState),
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
          const emitted = await emitNetEvent(ctx, {
            kind: 'transition_fired',
            runId: ctx.runId,
            runStatus: result.runStatus,
            transitionId: transition.id,
            subnetId: transition.subnetId,
            ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
            ...(transition.derivedFrom === undefined ? {} : { derivedFrom: transition.derivedFrom }),
            step: next.kind,
            contract: transition.contract,
            consumed: transition.inputArcs.map((arc) => arc.placeId),
            produced: transition.outputArcs.map((arc) => arc.placeId),
            fromStatus: currentState.status,
            toStatus: result.runStatus,
            ...(currentState.activeSliceAttempts ? { attempt: currentState.activeSliceAttempts + 1 } : {}),
          });
          if (!emitted.journaled) {
            return {
              status: 'halted',
              step: next.kind,
              runStatus: result.runStatus,
              reason: 'petri_journal_append_failed',
            };
          }
          const nextState = await readRunMetadata(metadataPath);
          if (nextState) {
            const nextPlan = await readPetriRuntimePlan(ctx.cwd, nextState);
            const impliedEventsJournaled = await emitNewImpliedTopologyEvents({
              ctx,
              before: currentState,
              after: nextState,
              plan: nextPlan,
              topology: currentRuntime.topology,
            });
            if (!impliedEventsJournaled) {
              return {
                status: 'halted',
                step: next.kind,
                runStatus: result.runStatus,
                reason: 'petri_journal_append_failed',
              };
            }
            const nextRuntimeResult = await materializeDriveRuntime({
              ctx,
              state: nextState,
              plan: nextPlan,
            });
            if ('outcome' in nextRuntimeResult) {
              return nextRuntimeResult.outcome;
            }
            const nextRuntime = nextRuntimeResult.runtime;
            await persistPetriMarkingSnapshot(
              ctx,
              await nextPetriSnapshot({
                ...(selectedIndex + 1 >= claimedTransitionIds.length
                  ? {}
                  : { claimedTransitionIds: claimedTransitionIds.slice(selectedIndex + 1) }),
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
        if (options.maxFirings !== undefined && firedTransitions >= options.maxFirings) {
          return { status: 'completed', runStatus: result.runStatus };
        }
      }
    }
  }
}

async function applyPendingAttemptReset(
  ctx: DriveContext,
  state: RunMetadata,
  plan: SchedulerPlan,
): Promise<{ readonly applied: true } | { readonly applied: false; readonly outcome: DriveOutcome }> {
  const stage = state.activeSliceAttemptReset!.stage;
  const sliceId = state.activeSliceId!;
  const transitionId = attemptResetTransitionId(stage, sliceId);
  const transition = compileExecutorTopology(plan).transitions.find(
    (candidate) => candidate.id === transitionId,
  );
  if (!transition) {
    return {
      applied: false,
      outcome: {
        status: 'halted',
        step: stage === 'agent' ? 'agent_result' : 'test_result',
        runStatus: state.status,
        reason: 'petri_input_unreadable',
      },
    };
  }
  const step = stage === 'agent' ? 'agent_result' : 'test_result';
  const emitted = await emitNetEvent(ctx, {
    kind: 'transition_fired',
    runId: state.runId,
    runStatus: state.status,
    transitionId,
    subnetId: transition.subnetId,
    ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
    step,
    contract: transition.contract,
    consumed: transition.inputArcs.map((arc) => arc.placeId),
    produced: transition.outputArcs.map((arc) => arc.placeId),
    fromStatus: state.status,
    toStatus: state.status,
  });
  if (!emitted.journaled) {
    return {
      applied: false,
      outcome: {
        status: 'halted',
        step,
        runStatus: state.status,
        reason: 'petri_journal_append_failed',
      },
    };
  }
  const { activeSliceAttemptReset: _cleared, ...rest } = state;
  await persistRunMetadata(runMetadataPath(ctx.cwd, ctx.runId), {
    ...rest,
    sliceAttemptHistory: appendSliceAttemptCycle(state, sliceId, stage, {
      outcome: 'reset',
      attempts: 0,
    }),
  });
  return { applied: true };
}

async function emitAttemptMarkingTransition(args: {
  readonly ctx: DriveContext;
  readonly runtime: ExecutorPetriRuntime;
  readonly state: RunMetadata;
  readonly step: 'agent_result' | 'test_result';
  readonly sliceId: string;
  readonly attempt: number;
}): Promise<boolean> {
  const stage = args.step === 'agent_result' ? 'agent' : 'verify';
  const transitionId =
    args.attempt < SLICE_ATTEMPT_LIMIT
      ? attemptRetryTransitionId(stage, args.sliceId, args.attempt)
      : attemptExhaustedTransitionId(stage, args.sliceId);
  const transition = args.runtime.topology.transitions.find((candidate) => candidate.id === transitionId);
  if (!transition) return false;
  const emitted = await emitNetEvent(args.ctx, {
    kind: 'transition_fired',
    runId: args.state.runId,
    runStatus: args.state.status,
    transitionId,
    subnetId: transition.subnetId,
    ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
    step: args.step,
    contract: transition.contract,
    consumed: transition.inputArcs.map((arc) => arc.placeId),
    produced: transition.outputArcs.map((arc) => arc.placeId),
    fromStatus: args.state.status,
    toStatus: args.state.status,
  });
  return emitted.journaled;
}

async function emitNewImpliedTopologyEvents(args: {
  readonly ctx: DriveContext;
  readonly before: RunMetadata;
  readonly after: RunMetadata;
  readonly plan: SchedulerPlan | undefined;
  readonly topology: ExecutorPetriRuntime['topology'];
}): Promise<boolean> {
  const beforeIds = projectExecutorPetriTransitionHistory(args.before, args.plan)?.transitionIds ?? [];
  const afterIds = projectExecutorPetriTransitionHistory(args.after, args.plan)?.transitionIds ?? [];
  for (const transitionId of afterIds.slice(beforeIds.length)) {
    const transition = args.topology.transitions.find((candidate) => candidate.id === transitionId);
    if (!transition || transition.step !== undefined) continue;
    const step = transitionId.startsWith('epic_integrate:')
      ? 'epic_integrate'
      : transitionId.startsWith('epic_verify:')
        ? 'epic_verify'
        : 'epic_complete';
    const emitted = await emitNetEvent(args.ctx, {
      kind: 'transition_fired',
      runId: args.after.runId,
      runStatus: args.after.status,
      transitionId,
      subnetId: transition.subnetId,
      ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
      step,
      contract: transition.contract,
      consumed: transition.inputArcs.map((arc) => arc.placeId),
      produced: transition.outputArcs.map((arc) => arc.placeId),
      fromStatus: args.before.status,
      toStatus: args.after.status,
    });
    if (!emitted.journaled) return false;
  }
  return true;
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

async function neverBoundReadyStep(step: ReadyStep): Promise<StepResult> {
  throw new Error(`missing bound Petri transition for ready step ${step.kind}`);
}

async function readClaimedReadySteps(
  ctx: Pick<DriveContext, 'cwd' | 'runId'>,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  runtime: ExecutorPetriRuntime,
  readySteps: readonly ReadyStep[],
): Promise<readonly ReadyStep[] | undefined> {
  const snapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
  if (
    !snapshot ||
    !petriMarkingSnapshotMatchesRunMetadata(snapshot, state) ||
    snapshot.claimedTransitionIds === undefined ||
    snapshot.claimedTransitionIds.length === 0
  ) {
    return undefined;
  }
  if (snapshot.firedTransitionCount !== firedTransitionCountForState(state, plan)) return undefined;
  if (!petriMarkingsEqual(snapshot.currentMarking, runtime.currentMarking)) return undefined;
  const enabledById = new Map(
    readySteps.flatMap((step) => {
      const transition = runtime.transitionForReadyStep(step);
      return transition ? [[transition.id, transition.step] as const] : [];
    }),
  );
  const claimedSteps = snapshot.claimedTransitionIds.map((transitionId) => enabledById.get(transitionId));
  if (!claimedSteps.every((step) => step !== undefined)) return undefined;

  const claimedInputs = new Map<string, number>();
  for (const transitionId of snapshot.claimedTransitionIds) {
    const transition = runtime.enabledTransitions.find((candidate) => candidate.id === transitionId);
    if (!transition) return undefined;
    for (const arc of transition.inputArcs) {
      const nextClaimed = (claimedInputs.get(arc.placeId) ?? 0) + arc.weight;
      if (nextClaimed > (runtime.currentMarking[arc.placeId] ?? 0)) return undefined;
      claimedInputs.set(arc.placeId, nextClaimed);
    }
  }

  return claimedSteps;
}

function petriMarkingsEqual(left: Record<string, number>, right: Record<string, number>): boolean {
  const leftEntries = Object.entries(left);
  return (
    leftEntries.length === Object.keys(right).length &&
    leftEntries.every(([placeId, count]) => right[placeId] === count)
  );
}
