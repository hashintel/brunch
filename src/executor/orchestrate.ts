import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
import {
  IsolatedSliceOperationError,
  isolatedAttemptOutcomeFor,
  thrownSliceEffectReason,
  type AgentStreamEvent,
  type VerifyStreamEvent,
} from './isolated-slice-operations.js';
import {
  compileExecutorTopology,
  type ExecutorNetEvent,
  type ExecutorNetEventPayload,
  type ReadyStep,
  type SchedulerPlan,
  type SchedulerPlanMode,
} from './orchestrate-topology.js';
import { executeParallelSliceBatch } from './parallel-slice-batch.js';
import {
  appendPetriEvent,
  appendPetriTerminalOnce,
  PetriTerminalJournalError,
  publishPetriJournalFailure,
  type PetriTerminalEvent,
} from './petri-events.js';
import {
  inspectPetriJournalAuthority,
  type PetriJournalAuthorityInspection,
} from './petri-journal-authority.js';
import {
  petriMarkingLifecycleProvenance,
  petriMarkingSnapshotMatchesRunMetadata,
  readPetriMarkingSnapshot,
  type PetriMarkingSnapshot,
  writePetriMarkingSnapshot,
} from './petri-marking.js';
import { replayTransitionHistory, type PetriProjection } from './petri-replay.js';
import { readPetriRuntimePlan } from './petri-runtime-plan.js';
import {
  bindExecutorPetriRuntime,
  materializeExecutorPetriRuntime,
  projectExecutorPetriTransitionHistory,
  type ExecutorPetriRuntime,
} from './petri-runtime.js';
import { classifyDriveTerminal, driveOutcomeFromTerminal } from './petri-terminal.js';
import {
  PetriObservationInputError,
  PetriObservationJournalError,
  preparePetriObservation,
} from './petri.js';
import { withRunExecutionAuthority } from './run-execution-authority.js';
import {
  activeSliceRepairCycle,
  persistRunMetadata,
  readRunMetadata,
  runDirPath,
  runMetadataPath,
  type RunMetadata,
} from './run.js';
import { sliceRepairProtocol, sliceRepairTopology, type PendingSliceRepair } from './slice-repair-cycle.js';
import type { SourcePolicyKind } from './source-policy.js';

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
async function emitNetEvent(
  ctx: Pick<DriveContext, 'cwd' | 'runId'>,
  event: ExecutorNetEventPayload,
): Promise<{
  readonly journaled: boolean;
  readonly event?: ExecutorNetEvent;
  readonly failureReason?: 'petri_terminal_conflict' | 'petri_input_unreadable';
}> {
  try {
    const appended =
      event.kind === 'net_completed' || event.kind === 'net_halted' || event.kind === 'net_deadlocked'
        ? await appendPetriTerminalOnce({ cwd: ctx.cwd, runId: ctx.runId, event })
        : await appendPetriEvent({ cwd: ctx.cwd, runId: ctx.runId, event });
    return { journaled: true, event: appended };
  } catch (error) {
    return {
      journaled: false,
      ...(error instanceof PetriTerminalJournalError ? { failureReason: error.reason } : {}),
    };
  }
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

async function settleDriveTerminal(
  ctx: Pick<DriveContext, 'cwd' | 'runId'>,
  terminal: ReturnType<typeof classifyDriveTerminal>,
): Promise<{ readonly outcome: DriveOutcome; readonly event?: PetriTerminalEvent }> {
  const emitted = await emitNetEvent(ctx, terminal.event);
  if (!emitted.journaled) {
    return {
      outcome:
        emitted.failureReason === 'petri_terminal_conflict'
          ? {
              status: 'halted',
              step: 'terminal',
              runStatus: terminal.outcome.runStatus,
              reason: emitted.failureReason,
            }
          : journalFailureOutcome(terminal),
    };
  }
  const event = emitted.event as PetriTerminalEvent;
  return {
    event,
    outcome: driveOutcomeFromTerminal(event),
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
  readonly terminalTs?: string;
  readonly failedSliceIds?: readonly string[];
  readonly epicVerificationClaims?: PetriMarkingSnapshot['epicVerificationClaims'];
}): Promise<PetriMarkingSnapshot> {
  return {
    ...(args.claimedTransitionIds === undefined ? {} : { claimedTransitionIds: args.claimedTransitionIds }),
    currentMarking: args.currentMarking,
    firedTransitionCount: args.firedTransitionCount,
    lifecycleProvenance: args.lifecycleProvenance,
    ...(args.terminalEventKind === undefined ? {} : { terminalEventKind: args.terminalEventKind }),
    ...(args.haltedReason === undefined ? {} : { haltedReason: args.haltedReason }),
    ...(args.terminalTs === undefined ? {} : { terminalTs: args.terminalTs }),
    ...(args.failedSliceIds === undefined ? {} : { failedSliceIds: args.failedSliceIds }),
    ...(args.epicVerificationClaims === undefined
      ? {}
      : { epicVerificationClaims: args.epicVerificationClaims }),
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
    case 'landed':
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
        return { outcome: (await settleDriveTerminal(args.ctx, terminal)).outcome };
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
    return { outcome: (await settleDriveTerminal(args.ctx, terminal)).outcome };
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
  readonly advanced?: true;
  readonly skipTransition?: true;
  readonly epicVerificationPassed?: string;
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
  return withRunExecutionAuthority({
    cwd: ctx.cwd,
    runId: ctx.runId,
    execute: () => driveOwned(ctx, scheduler, firingPolicy, options),
  });
}

async function driveOwned(
  ctx: DriveContext,
  scheduler: RunScheduler,
  firingPolicy: RunFiringPolicy,
  options: { readonly maxFirings?: number },
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
      return (await settleDriveTerminal(ctx, terminal)).outcome;
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
        if (error instanceof PetriObservationJournalError) {
          publishPetriJournalFailure(ctx);
          return terminal.outcome;
        }
        return (await settleDriveTerminal(ctx, terminal)).outcome;
      }
    }
    const authoritySnapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
    const journal = await inspectPetriJournalAuthority({
      cwd: ctx.cwd,
      runId: ctx.runId,
      lifecycleTransitionIds: projectExecutorPetriTransitionHistory(state, plan)?.transitionIds,
      plan,
    });
    if (journal.status === 'readable') {
      const terminals = journal.events.filter(
        (event): event is PetriTerminalEvent =>
          event.kind === 'net_completed' || event.kind === 'net_halted' || event.kind === 'net_deadlocked',
      );
      if (terminals.length > 1) {
        return {
          status: 'halted',
          step: 'terminal',
          runStatus: state.status,
          reason: 'petri_terminal_conflict',
        };
      }
      const durableTerminal = terminals[0];
      if (durableTerminal) {
        try {
          const terminalRuntime = authoritySnapshot
            ? undefined
            : materializeExecutorPetriRuntime(state, plan);
          await persistPetriMarkingSnapshot(ctx, {
            ...(authoritySnapshot ?? {
              currentMarking: terminalRuntime!.currentMarking,
              firedTransitionCount: firedTransitionCountForState(state, plan),
              lifecycleProvenance: petriMarkingLifecycleProvenance(state),
            }),
            terminalEventKind: durableTerminal.kind,
            ...(durableTerminal.kind === 'net_halted' && durableTerminal.reason !== undefined
              ? { haltedReason: durableTerminal.reason }
              : {}),
            terminalTs: durableTerminal.ts,
            failedSliceIds: durableTerminal.failedSliceIds,
          });
        } catch {
          // Durable terminal truth still wins when stale metadata cannot rematerialize its marking.
        }
        const outcome = driveOutcomeFromTerminal(durableTerminal);
        // Landing advances run metadata after the net's terminal event without
        // touching the net, so a landed run reports its current status rather
        // than the promotion_prepared frozen into the journal terminal.
        return state.status === 'landed' ? { ...outcome, runStatus: state.status } : outcome;
      }
    }
    if (state.pendingSliceRepair && plan) {
      const recovered = await recoverPendingSliceRepair({
        ctx,
        state,
        plan,
        journal,
      });
      if (!recovered.recovered) return recovered.outcome;
      continue;
    }
    if ('events' in journal && journal.events !== undefined) {
      const durableEpicHistory = journal.events.flatMap((event) =>
        event.kind === 'transition_fired' && event.contract.lane === 'epic' ? [event.transitionId] : [],
      );
      if (
        !stringArraysEqual(durableEpicHistory, state.epicTransitionHistory ?? []) &&
        stringArraysEqual([...durableEpicHistory].sort(), [...(state.epicTransitionHistory ?? [])].sort())
      ) {
        const epicSummary = epicSummaryFromHistory(durableEpicHistory);
        await persistRunMetadata(metadataPath, {
          ...state,
          epicTransitionHistory: durableEpicHistory,
          integratedEpicIds: epicSummary.integratedEpicIds,
          verifiedEpicIds: epicSummary.verifiedEpicIds,
          completedEpicIds: epicSummary.completedEpicIds,
        });
        continue;
      }
    }
    if (state.status !== 'abandoned') {
      const persistedParallelTerminal = persistedParallelTerminalOutcome({
        state,
        journal,
        snapshot: authoritySnapshot,
      });
      if (persistedParallelTerminal) return persistedParallelTerminal;
      const parityFailure = transitionParityFailure({ journal, authoritySnapshot });
      if (parityFailure) {
        publishPetriJournalFailure(ctx);
        return {
          status: 'halted',
          step: reconciliationStep(state, plan),
          runStatus: state.status,
          reason: parityFailure,
        };
      }
    }
    if (state.activeSliceAttemptReset && state.activeSliceId && plan) {
      const reset = await applyPendingAttemptReset(ctx, state, plan);
      if (!reset.applied) return reset.outcome;
      continue;
    }
    if (journal.status === 'readable') {
      const durableEpicHistory = journal.events.flatMap((event) =>
        event.kind === 'transition_fired' && event.contract.lane === 'epic' ? [event.transitionId] : [],
      );
      const epicSummary = epicSummaryFromHistory(durableEpicHistory);
      if (
        !stringArraysEqual(durableEpicHistory, state.epicTransitionHistory ?? []) ||
        !stringArraysEqual(epicSummary.integratedEpicIds, state.integratedEpicIds ?? []) ||
        !stringArraysEqual(epicSummary.verifiedEpicIds, state.verifiedEpicIds ?? []) ||
        !stringArraysEqual(epicSummary.completedEpicIds, state.completedEpicIds ?? [])
      ) {
        await persistRunMetadata(metadataPath, {
          ...state,
          epicTransitionHistory: durableEpicHistory,
          integratedEpicIds: epicSummary.integratedEpicIds,
          verifiedEpicIds: epicSummary.verifiedEpicIds,
          completedEpicIds: epicSummary.completedEpicIds,
        });
        continue;
      }
    }
    const runtimeResult = await materializeDriveRuntime({ ctx, state, plan });
    if ('outcome' in runtimeResult) {
      return runtimeResult.outcome;
    }
    const runtime = runtimeResult.runtime;
    const readySteps = scheduler.ready(state, plan, runtime);
    const persisted = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
    const parallelRecoveryRequired =
      state.status !== 'abandoned' &&
      (persisted?.parallelSliceBatch !== undefined ||
        (!persisted?.epicVerificationClaims?.length &&
          journal.status === 'readable' &&
          journal.sliceStartClaimIds.length > 0));
    if (parallelRecoveryRequired) {
      const step = readySteps[0]?.kind ?? 'slice_start';
      if (
        persisted?.parallelSliceBatch?.pendingRepairs?.length &&
        !parallelPendingRepairAuthorityIsValid({
          cwd: ctx.cwd,
          runId: ctx.runId,
          state,
          snapshot: persisted,
        })
      ) {
        const terminal = classifyDriveTerminal({
          kind: 'step_halted',
          runId: ctx.runId,
          runStatus: state.status,
          step,
          reason: 'petri_input_unreadable',
        });
        return (await settleDriveTerminal(ctx, terminal)).outcome;
      }
      const terminal = classifyDriveTerminal({
        kind: 'step_halted',
        runId: ctx.runId,
        runStatus: state.status,
        step,
        reason: 'parallel_slice_replan_required',
      });
      return (await settleDriveTerminal(ctx, terminal)).outcome;
    }
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
    const parallelSliceSteps = selectedSteps.every(
      (step): step is Extract<ReadyStep, { readonly kind: 'slice_start' }> => step.kind === 'slice_start',
    )
      ? selectedSteps
      : [];
    const parallelSliceFrontier =
      parallelSliceSteps.length > 0 &&
      plan !== undefined &&
      (state.status === 'reports_initialized' || state.status === 'slice_completed');
    if (
      parallelSliceFrontier &&
      plan !== undefined &&
      firingPolicy === frontierFiringPolicy &&
      parallelSliceSteps.length > 1 &&
      options.maxFirings === undefined
    ) {
      const batch = await executeParallelSliceBatch({
        ctx,
        state,
        plan,
        runtime,
        steps: parallelSliceSteps,
      });
      if (batch.status === 'halted') return batch;
      firedTransitions += batch.firings;
      continue;
    }
    if (selectedSteps.length === 0) {
      const terminal = classifyDriveTerminal({
        kind: 'scheduler_exhausted',
        runId: ctx.runId,
        runStatus: state.status,
        ...(state.failedSliceIds === undefined ? {} : { failedSliceIds: state.failedSliceIds }),
      });
      const snapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
      if (snapshotAlreadyCapturesTerminal({ snapshot, state, runtime, plan, terminal })) {
        return terminal.outcome;
      }
      const settled = await settleDriveTerminal(ctx, terminal);
      if (!settled.event) return settled.outcome;
      const durableTerminal = settled.event;
      await persistPetriMarkingSnapshot(
        ctx,
        await nextPetriSnapshot({
          currentMarking: runtime.currentMarking,
          firedTransitionCount: firedTransitionCountForState(state, plan),
          lifecycleProvenance: petriMarkingLifecycleProvenance(state),
          terminalEventKind: durableTerminal.kind,
          ...(durableTerminal.kind === 'net_halted' && durableTerminal.reason !== undefined
            ? { haltedReason: durableTerminal.reason }
            : {}),
          terminalTs: durableTerminal.ts,
          failedSliceIds: durableTerminal.failedSliceIds,
        }),
      );
      return settled.outcome;
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
        ...(authoritySnapshot?.epicVerificationClaims
          ? { epicVerificationClaims: authoritySnapshot.epicVerificationClaims }
          : {}),
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

      const currentAuthoritySnapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
      const boundRuntime = bindExecutorPetriRuntime(currentRuntime, {
        ...ctx,
        ...(currentPlan ? { plan: currentPlan } : {}),
        currentMarking: currentRuntime.currentMarking,
        firedTransitionCount: firedTransitionCountForState(currentState, currentPlan),
        ...(currentAuthoritySnapshot ? { markingSnapshot: currentAuthoritySnapshot } : {}),
      });
      const boundTransition = boundRuntime.transitionForReadyStep(next);
      let result: StepResult;
      try {
        result = boundTransition ? await boundTransition.execute() : await neverBoundReadyStep(next);
      } catch (error) {
        if (next.kind === 'epic_integrate' || next.kind === 'epic_verify' || next.kind === 'epic_complete') {
          throw error;
        }
        const reason =
          error instanceof IsolatedSliceOperationError
            ? error.reason
            : thrownSliceEffectReason(serialThrowKind(next.kind), error);
        const terminal = classifyDriveTerminal({
          kind: 'step_halted',
          runId: ctx.runId,
          runStatus: currentState.status,
          step: next.kind,
          reason,
        });
        const settled = await settleDriveTerminal(ctx, terminal);
        if (!settled.event) return settled.outcome;
        const durableTerminal = settled.event;
        const authoritySnapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
        try {
          await writePetriMarkingSnapshot({
            cwd: ctx.cwd,
            runId: ctx.runId,
            snapshot: await nextPetriSnapshot({
              currentMarking: currentRuntime.currentMarking,
              firedTransitionCount: firedTransitionCountForState(currentState, currentPlan),
              lifecycleProvenance: petriMarkingLifecycleProvenance(currentState),
              terminalEventKind: durableTerminal.kind,
              ...(durableTerminal.kind === 'net_halted' && durableTerminal.reason !== undefined
                ? { haltedReason: durableTerminal.reason }
                : {}),
              terminalTs: durableTerminal.ts,
              failedSliceIds: durableTerminal.failedSliceIds,
              ...(authoritySnapshot?.epicVerificationClaims
                ? { epicVerificationClaims: authoritySnapshot.epicVerificationClaims }
                : {}),
            }),
          });
        } catch {
          return {
            status: 'halted',
            step: next.kind,
            runStatus: currentState.status,
            reason: 'petri_marking_persist_failed',
          };
        }
        return settled.outcome;
      }
      if (result.skipTransition && result.runStatus !== 'not_started') {
        try {
          ctx.onStepComplete?.(
            next.kind,
            result.runStatus,
            progressForStep('completed', next, currentState, result.runStatus),
          );
        } catch {
          // Observer failures never affect the drive.
        }
        continue;
      }
      if (result.runStatus === currentState.status && result.advanced !== true) {
        const attemptOutcome = isolatedAttemptOutcomeFor(result);
        if (
          (result.status === 'agent_run_failed' || result.status === 'test_run_failed') &&
          'attempts' in result &&
          typeof result.attempts === 'number' &&
          currentState.activeSliceId !== undefined &&
          attemptOutcome !== undefined &&
          (attemptOutcome.status === 'retry' || attemptOutcome.status === 'exhausted')
        ) {
          const emitted = await emitNetEvent(ctx, {
            kind: 'attempt_failed',
            runId: ctx.runId,
            runStatus: currentState.status,
            sliceId: currentState.activeSliceId,
            ...(currentState.activeEpicId === undefined ? {} : { epicId: currentState.activeEpicId }),
            step: result.status === 'agent_run_failed' ? 'agent_result' : 'test_result',
            attempt: result.attempts,
            reason: attemptOutcome.fact.reason,
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
            transitionId: attemptOutcome.transitionId,
          });
          if (!attemptTransitionJournaled) {
            return {
              status: 'halted',
              step: next.kind,
              runStatus: currentState.status,
              reason: 'petri_journal_append_failed',
            };
          }
          if (attemptOutcome.status === 'retry') continue;
        }
        const terminal = classifyDriveTerminal({
          kind: 'step_halted',
          runId: ctx.runId,
          runStatus: currentState.status,
          step: next.kind,
          reason: result.status,
        });
        const settled = await settleDriveTerminal(ctx, terminal);
        if (!settled.event) return settled.outcome;
        const durableTerminal = settled.event;
        const haltedState = (await readRunMetadata(metadataPath)) ?? currentState;
        const haltedRuntime = materializeExecutorPetriRuntime(haltedState, currentPlan);
        const authoritySnapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
        await persistPetriMarkingSnapshot(
          ctx,
          await nextPetriSnapshot({
            currentMarking: haltedRuntime.currentMarking,
            firedTransitionCount: firedTransitionCountForState(haltedState, currentPlan),
            lifecycleProvenance: petriMarkingLifecycleProvenance(haltedState),
            terminalEventKind: durableTerminal.kind,
            ...(durableTerminal.kind === 'net_halted' && durableTerminal.reason !== undefined
              ? { haltedReason: durableTerminal.reason }
              : {}),
            terminalTs: durableTerminal.ts,
            failedSliceIds: durableTerminal.failedSliceIds,
            ...(authoritySnapshot?.epicVerificationClaims
              ? { epicVerificationClaims: authoritySnapshot.epicVerificationClaims }
              : {}),
          }),
        );
        return settled.outcome;
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
          if (result.epicVerificationPassed) {
            const transitioned = replayTransitionHistory(
              { transitions: [transition], initialMarking: currentRuntime.currentMarking },
              [transition.id],
            );
            if (!transitioned) {
              return {
                status: 'halted',
                step: next.kind,
                runStatus: currentState.status,
                reason: 'petri_input_unreadable',
              };
            }
            const claimSnapshot = await readPetriMarkingSnapshot({ cwd: ctx.cwd, runId: ctx.runId });
            try {
              await writePetriMarkingSnapshot({
                cwd: ctx.cwd,
                runId: ctx.runId,
                snapshot: {
                  currentMarking: transitioned.currentMarking,
                  firedTransitionCount: firedTransitionCountForState(currentState, currentPlan) + 1,
                  lifecycleProvenance: petriMarkingLifecycleProvenance(currentState),
                  epicVerificationClaims: (claimSnapshot?.epicVerificationClaims ?? []).map((claim) =>
                    claim.epicId === result.epicVerificationPassed
                      ? { ...claim, phase: 'transitioned' as const }
                      : claim,
                  ),
                },
              });
            } catch {
              return {
                status: 'halted',
                step: next.kind,
                runStatus: currentState.status,
                reason: 'petri_marking_persist_failed',
              };
            }
            await persistRunMetadata(metadataPath, {
              ...currentState,
              verifiedEpicIds: appendUniqueId(currentState.verifiedEpicIds, result.epicVerificationPassed),
            });
          }
          if (transition.contract.lane === 'epic') {
            const epicState = (await readRunMetadata(metadataPath)) ?? currentState;
            await persistRunMetadata(metadataPath, {
              ...epicState,
              epicTransitionHistory: appendUniqueId(epicState.epicTransitionHistory, transition.id),
            });
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

function parallelPendingRepairAuthorityIsValid(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly state: RunMetadata;
  readonly snapshot: PetriMarkingSnapshot;
}): boolean {
  const batch = args.snapshot.parallelSliceBatch;
  if (!batch?.pendingRepairs?.length || !batch.pendingRepairHistory || !args.state.verifyTarget) {
    return false;
  }
  try {
    for (const pending of batch.pendingRepairs) {
      const cycles = batch.pendingRepairHistory[pending.sliceId];
      if (!cycles) return false;
      sliceRepairProtocol.validateRepairAuthority({
        pending,
        trusted: {
          runDir: runDirPath(args.cwd, args.runId),
          runId: args.runId,
          sliceId: pending.sliceId,
          target: args.state.verifyTarget,
          policy: sliceRepairProtocol.policy,
          history: { [pending.sliceId]: cycles },
        },
      });
    }
    return true;
  } catch {
    return false;
  }
}

function transitionParityFailure(args: {
  readonly journal: PetriJournalAuthorityInspection;
  readonly authoritySnapshot: PetriMarkingSnapshot | undefined;
}): 'petri_input_unreadable' | 'petri_journal_gap' | undefined {
  if (args.journal.status !== 'readable') return 'petri_input_unreadable';
  if (args.journal.relation === 'equal') return undefined;
  if (args.journal.relation === 'lifecycle_ahead') {
    return args.authoritySnapshot?.parallelSliceBatch !== undefined ? undefined : 'petri_journal_gap';
  }

  const journalAhead = args.journal.residualTransitionIds;
  const parallelAuthority =
    journalAhead.length > 0 && journalAhead.every((transitionId) => transitionId.startsWith('slice_start:'));
  const transitionedEpicIds = new Set(
    (args.authoritySnapshot?.epicVerificationClaims ?? [])
      .filter((claim) => claim.phase === 'transitioned')
      .map((claim) => `epic_verify:${claim.epicId}`),
  );
  const epicAuthority =
    journalAhead.length > 0 && journalAhead.every((transitionId) => transitionedEpicIds.has(transitionId));
  return parallelAuthority || epicAuthority ? undefined : 'petri_input_unreadable';
}

function persistedParallelTerminalOutcome(args: {
  readonly state: RunMetadata;
  readonly journal: PetriJournalAuthorityInspection;
  readonly snapshot: PetriMarkingSnapshot | undefined;
}): DriveOutcome | undefined {
  const { journal, snapshot, state } = args;
  if (
    journal.status !== 'readable' ||
    snapshot?.parallelSliceBatch === undefined ||
    snapshot.terminalEventKind !== 'net_halted' ||
    snapshot.lifecycleProvenance?.runStatus !== state.status ||
    snapshot.lifecycleProvenance.activeSliceId !== state.activeSliceId ||
    !stringArraysEqual(snapshot.lifecycleProvenance.completedSliceIds ?? [], state.completedSliceIds ?? [])
  ) {
    return undefined;
  }
  const terminal = journal.events.flatMap((event) => (event.kind === 'net_halted' ? [event] : [])).at(-1);
  if (
    terminal === undefined ||
    terminal.step === undefined ||
    terminal.reason === undefined ||
    terminal.ts !== snapshot.terminalTs ||
    terminal.reason !== snapshot.haltedReason ||
    terminal.runStatus !== state.status ||
    !stringArraysEqual(terminal.failedSliceIds, snapshot.failedSliceIds ?? []) ||
    !stringArraysEqual(terminal.failedSliceIds, state.failedSliceIds ?? [])
  ) {
    return undefined;
  }
  return {
    status: 'halted',
    step: terminal.step,
    runStatus: terminal.runStatus,
    reason: terminal.reason,
  };
}

function serialThrowKind(step: ReadyStep['kind']): string {
  switch (step) {
    case 'slice_execute':
      return 'slice_workspace_threw';
    case 'agent_result':
      return 'agent_run_threw';
    case 'test_result':
      return 'test_run_threw';
    case 'slice_integrate':
      return 'slice_integration_threw';
    default:
      return `${step}_threw`;
  }
}

function reconciliationStep(state: RunMetadata, plan: SchedulerPlan | undefined): ReadyStep['kind'] {
  try {
    return (
      materializeExecutorPetriRuntime(state, plan).readySteps[0]?.kind ??
      petriInputRequiredStep(state) ??
      'slice_start'
    );
  } catch {
    return petriInputRequiredStep(state) ?? 'slice_start';
  }
}

function appendUniqueId(ids: readonly string[] | undefined, id: string): readonly string[] {
  return ids?.includes(id) ? ids : [...(ids ?? []), id];
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function epicSummaryFromHistory(history: readonly string[]): {
  readonly integratedEpicIds: readonly string[];
  readonly verifiedEpicIds: readonly string[];
  readonly completedEpicIds: readonly string[];
} {
  return {
    integratedEpicIds: epicIdsForTransitionKind(history, 'epic_integrate'),
    verifiedEpicIds: epicIdsForTransitionKind(history, 'epic_verify'),
    completedEpicIds: epicIdsForTransitionKind(history, 'epic_complete'),
  };
}

function epicIdsForTransitionKind(history: readonly string[], kind: string): readonly string[] {
  return history.flatMap((transitionId) => {
    const [transitionKind, epicId] = transitionId.split(':');
    return transitionKind === kind && epicId ? [epicId] : [];
  });
}

async function recoverPendingSliceRepair(args: {
  readonly ctx: DriveContext;
  readonly state: RunMetadata;
  readonly plan: SchedulerPlan;
  readonly journal: PetriJournalAuthorityInspection;
}): Promise<{ readonly recovered: true } | { readonly recovered: false; readonly outcome: DriveOutcome }> {
  if (args.journal.status !== 'readable') {
    return {
      recovered: false,
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: args.state.status,
        reason: 'petri_input_unreadable',
      },
    };
  }
  const metadataPath = runMetadataPath(args.ctx.cwd, args.ctx.runId);
  const trustedRepairState = {
    runDir: runDirPath(args.ctx.cwd, args.ctx.runId),
    runId: args.ctx.runId,
    sliceId: args.state.activeSliceId!,
    target: args.state.verifyTarget!,
    policy: sliceRepairProtocol.policy,
    history: args.state.sliceRepairHistory!,
  };
  let pending: PendingSliceRepair;
  try {
    pending = await sliceRepairProtocol.materializeRepair({
      pending: args.state.pendingSliceRepair!,
      trusted: trustedRepairState,
    });
  } catch {
    return {
      recovered: false,
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: args.state.status,
        reason: 'repair_context_unreadable',
      },
    };
  }
  const materializedState: RunMetadata = {
    ...args.state,
    status: 'slice_execution_requested',
    pendingSliceRepair: pending,
  };
  if (
    args.state.pendingSliceRepair!.phase !== 'materialized' ||
    args.state.status !== 'slice_execution_requested'
  ) {
    await persistRunMetadata(metadataPath, materializedState);
  }

  const desired = projectExecutorPetriTransitionHistory(materializedState, args.plan)?.transitionIds;
  if (!desired) {
    return {
      recovered: false,
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: materializedState.status,
        reason: 'petri_input_unreadable',
      },
    };
  }
  const journaled = args.journal.events.flatMap((event) =>
    event.kind === 'transition_fired' ? [event.transitionId] : [],
  );
  if (!journaled.every((transitionId, index) => desired[index] === transitionId)) {
    return {
      recovered: false,
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: materializedState.status,
        reason: 'petri_input_unreadable',
      },
    };
  }
  const topology = compileExecutorTopology(args.plan);
  for (const transitionId of desired.slice(journaled.length)) {
    const transition = topology.transitions.find((candidate) => candidate.id === transitionId);
    if (!transition) {
      return {
        recovered: false,
        outcome: {
          status: 'halted',
          step: 'test_result',
          runStatus: materializedState.status,
          reason: 'petri_input_unreadable',
        },
      };
    }
    const step: ReadyStep['kind'] = transition.step?.kind ?? 'test_result';
    const emitted = await emitNetEvent(args.ctx, {
      kind: 'transition_fired',
      runId: args.ctx.runId,
      runStatus: materializedState.status,
      transitionId,
      subnetId: transition.subnetId,
      ...(transition.epicId === undefined ? {} : { epicId: transition.epicId }),
      ...(transition.derivedFrom === undefined ? {} : { derivedFrom: transition.derivedFrom }),
      step,
      contract: transition.contract,
      consumed: transition.inputArcs.map((arc) => arc.placeId),
      produced: transition.outputArcs.map((arc) => arc.placeId),
      fromStatus: args.state.status,
      toStatus: materializedState.status,
    });
    if (!emitted.journaled) {
      return {
        recovered: false,
        outcome: {
          status: 'halted',
          step: 'test_result',
          runStatus: materializedState.status,
          reason: 'petri_journal_append_failed',
        },
      };
    }
  }
  const runtime = materializeExecutorPetriRuntime(materializedState, args.plan);
  try {
    await writePetriMarkingSnapshot({
      cwd: args.ctx.cwd,
      runId: args.ctx.runId,
      snapshot: {
        currentMarking: runtime.currentMarking,
        firedTransitionCount: desired.length,
        lifecycleProvenance: petriMarkingLifecycleProvenance(materializedState),
      },
    });
  } catch {
    return {
      recovered: false,
      outcome: {
        status: 'halted',
        step: 'test_result',
        runStatus: materializedState.status,
        reason: 'petri_marking_persist_failed',
      },
    };
  }
  const { pendingSliceRepair: _pending, ...withoutPending } = materializedState;
  const activeSliceRepairContext = sliceRepairProtocol.activateRepair({
    pending,
    trusted: trustedRepairState,
  });
  await persistRunMetadata(metadataPath, {
    ...withoutPending,
    activeSliceRepairContext,
    activeSliceRepairAuthority: pending,
  });
  return { recovered: true };
}

async function applyPendingAttemptReset(
  ctx: DriveContext,
  state: RunMetadata,
  plan: SchedulerPlan,
): Promise<{ readonly applied: true } | { readonly applied: false; readonly outcome: DriveOutcome }> {
  const stage = state.activeSliceAttemptReset!.stage;
  const sliceId = state.activeSliceId!;
  const cycle = activeSliceRepairCycle(state, sliceId);
  const transitionId = sliceRepairTopology.attemptResetTransitionId(stage, sliceId, cycle);
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
  let candidateHistory;
  try {
    candidateHistory = sliceRepairProtocol.admitReset({
      history: state.sliceRepairHistory!,
      sliceId,
      cycle,
      stage,
      policy: sliceRepairProtocol.policy,
    });
  } catch {
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
    sliceRepairHistory: candidateHistory,
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
  readonly transitionId: string;
}): Promise<boolean> {
  const transition = args.runtime.topology.transitions.find(
    (candidate) => candidate.id === args.transitionId,
  );
  if (!transition) return false;
  const emitted = await emitNetEvent(args.ctx, {
    kind: 'transition_fired',
    runId: args.state.runId,
    runStatus: args.state.status,
    transitionId: args.transitionId,
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
    const step = transitionId.startsWith('verify_')
      ? 'test_result'
      : transitionId.startsWith('epic_integrate:')
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
      ...(transition.derivedFrom === undefined ? {} : { derivedFrom: transition.derivedFrom }),
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
  if ('sliceId' in left && 'sliceId' in right) return left.sliceId === right.sliceId;
  return 'epicId' in left && 'epicId' in right ? left.epicId === right.epicId : true;
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
    ...('epicId' in step && step.epicId
      ? { activeEpicId: step.epicId }
      : state.activeEpicId
        ? { activeEpicId: state.activeEpicId }
        : {}),
    ...('sliceId' in step
      ? { activeSliceId: step.sliceId }
      : state.activeSliceId
        ? { activeSliceId: state.activeSliceId }
        : {}),
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
