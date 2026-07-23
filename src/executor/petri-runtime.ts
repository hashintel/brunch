import { readFile } from 'node:fs/promises';

import { ingestAgentResult } from './agent-result.js';
import { executeEpicLifecycleStep } from './epic-lifecycle.js';
import type { AgentRunnerRuntime, ExecutionPorts } from './execution-ports.js';
import type { AgentStreamEvent, VerifyStreamEvent } from './isolated-slice-operations.js';
import {
  blockedPlanSliceSteps,
  compileExecutorTopology,
  normalizeSchedulerPlanMode,
  projectSchedulerPlan,
  readyPlanSliceIds,
  sliceTransitionId,
  type BlockedStep,
  type ExecutorTopology,
  type ExecutorTransition,
  type ExecutorTransitionGuard,
  type ReadyStep,
  type SchedulerPlan,
} from './orchestrate-topology.js';
import type { EpicVerificationClaim, PetriMarkingSnapshot } from './petri-marking.js';
import type { ParallelSliceBatchSnapshot } from './petri-marking.js';
import { replayTransitionHistory } from './petri-replay.js';
import { exportPetri } from './petri.js';
import { populatedPlanPath, populateWorktree } from './populate.js';
import { preparePromotion } from './promotion.js';
import { initializeReports } from './report.js';
import { completeRun } from './run-complete.js';
import { activeSliceRepairCycle, readRunMetadata, runMetadataPath, type RunMetadata } from './run.js';
import { completeSlice } from './slice-complete.js';
import { requestSliceExecution } from './slice-execute.js';
import { integrateSlice } from './slice-integration.js';
import {
  MAX_STAGE_ATTEMPTS,
  sliceRepairProtocol,
  sliceRepairTopology,
  type SliceRepairStage,
  type SliceStageEpoch,
} from './slice-repair-cycle.js';
import { startSlice } from './slice-start.js';
import { copyHostSource } from './source-copy.js';
import { selectSourcePolicy, type SourcePolicyKind } from './source-policy.js';
import { ingestTestResult } from './test-result.js';
import { createWorktree } from './worktree.js';

export interface ExecutorPetriRuntime {
  readonly topology: ExecutorTopology;
  readonly currentMarking: Record<string, number>;
  readonly enabledTransitions: readonly ExecutableExecutorTransition[];
  readonly readySteps: readonly ReadyStep[];
  readonly blockedSteps: readonly BlockedStep[];
  transitionForReadyStep(step: ReadyStep): ExecutableExecutorTransition | undefined;
}

type ExecutableExecutorTransition = ExecutorTransition & { readonly step: ReadyStep };

export interface ExecutorPetriTransitionHistoryProjection {
  readonly transitionIds: readonly string[];
  readonly currentSliceId?: string;
}

export interface ExecutorTransitionBindingContext {
  readonly cwd: string;
  readonly runId: string;
  readonly ports: ExecutionPorts;
  readonly sourcePolicy?: SourcePolicyKind;
  readonly runtime?: AgentRunnerRuntime;
  readonly signal?: AbortSignal;
  readonly onAgentUpdate?: (event: AgentStreamEvent) => void;
  readonly onVerifyUpdate?: (event: VerifyStreamEvent) => void;
  readonly plan?: SchedulerPlan;
  readonly currentMarking?: Record<string, number>;
  readonly firedTransitionCount?: number;
  readonly markingSnapshot?: PetriMarkingSnapshot;
}

export interface ExecutorStepResult {
  readonly status: string;
  readonly runStatus: RunMetadata['status'] | 'not_started';
  readonly advanced?: true;
  readonly skipTransition?: true;
  readonly epicVerificationPassed?: string;
}

export interface BoundExecutorPetriTransition {
  readonly transition: ExecutorTransition;
  execute(): Promise<ExecutorStepResult>;
}

export interface ExecutorPetriRuntimeBindings {
  readonly runtime: ExecutorPetriRuntime;
  transitionForReadyStep(step: ReadyStep): BoundExecutorPetriTransition | undefined;
}

export function nextIncompletePetriSliceId(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const completed = new Set(state.completedSliceIds ?? []);
  return plan?.slices?.find((slice) => !completed.has(slice.id))?.id;
}

export function activeOrNextPetriSliceId(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  return state.activeSliceId ?? nextIncompletePetriSliceId(state, plan);
}

export function enabledPetriTransitionIds(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): readonly string[] {
  const runtime = materializeExecutorPetriRuntime(state, plan);
  return runtime.enabledTransitions.map((transition) => transition.id);
}

export function impliedPetriTransitionHistory(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): readonly string[] | undefined {
  return projectExecutorPetriTransitionHistory(state, plan)?.transitionIds;
}

export function projectExecutorPetriTransitionHistory(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): ExecutorPetriTransitionHistoryProjection | undefined {
  if (state.status === 'created') return { transitionIds: [] };
  if (state.status === 'abandoned') return undefined;
  if (!completedSliceHistoryIsValid(state, plan, state.completedSliceIds ?? [])) return undefined;

  const transitionIds = [
    ...baseRunTransitionHistory(state.status),
    ...completedSliceTransitionHistory(state, plan, state.completedSliceIds ?? []),
  ];
  const currentSliceId = inFlightSliceId(state, plan);
  switch (state.status) {
    case 'slice_started':
      return currentSliceId
        ? {
            transitionIds: [...transitionIds, sliceTransitionId('slice_start', currentSliceId)],
            currentSliceId,
          }
        : undefined;
    case 'slice_execution_requested':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
              ...completedRepairTransitionHistory(state, currentSliceId),
              ...activeStageTransitionHistory(state, 'agent', currentSliceId),
            ],
            currentSliceId,
          }
        : undefined;
    case 'agent_result_ingested':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
              ...completedRepairTransitionHistory(state, currentSliceId, {
                fallbackAgentSuccess: true,
              }),
              ...activeStageTransitionHistory(state, 'verify', currentSliceId),
            ],
            currentSliceId,
          }
        : undefined;
    case 'test_result_ingested':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
              ...completedRepairTransitionHistory(state, currentSliceId, {
                fallbackAgentSuccess: true,
                fallbackVerifySuccess: true,
              }),
            ],
            currentSliceId,
          }
        : undefined;
    case 'slice_integrated':
      return currentSliceId
        ? {
            transitionIds: [
              ...transitionIds,
              sliceTransitionId('slice_start', currentSliceId),
              sliceTransitionId('slice_execute', currentSliceId),
              ...completedRepairTransitionHistory(state, currentSliceId, {
                fallbackAgentSuccess: true,
                fallbackVerifySuccess: true,
              }),
              sliceRepairTopology.integrationTransitionId(
                currentSliceId,
                activeSliceRepairCycle(state, currentSliceId),
              ),
            ],
            currentSliceId,
          }
        : undefined;
    case 'slice_completed':
      return { transitionIds };
    case 'run_completed':
      return { transitionIds: [...transitionIds, 'run_complete'] };
    case 'petri_exported':
      return { transitionIds: [...transitionIds, 'run_complete', 'petri_export'] };
    case 'promotion_prepared':
    case 'landed':
      // Landing happens outside the driven chain; a landed run's net history is
      // identical to promotion_prepared's.
      return { transitionIds: [...transitionIds, 'run_complete', 'petri_export', 'promotion'] };
    default:
      return { transitionIds };
  }
}

function completedSliceHistoryIsValid(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): boolean {
  const completed = new Set<string>();
  const slicesById = new Map((plan?.slices ?? []).map((slice) => [slice.id, slice]));
  for (const sliceId of completedSliceIds) {
    const slice = slicesById.get(sliceId);
    if (!slice || completed.has(sliceId)) return false;
    if ((slice.depends_on ?? []).some((dependencyId) => !completed.has(dependencyId))) return false;
    const epic = plan?.epics?.find((candidate) => candidate.id === slice.epic_id);
    if (epic?.depends_on?.some((dependencyId) => !state.completedEpicIds?.includes(dependencyId))) {
      return false;
    }
    completed.add(sliceId);
  }
  return true;
}

export function materializeExecutorPetriRuntime(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  authority?: {
    readonly currentMarking: Record<string, number>;
    readonly parallelSliceBatch?: ParallelSliceBatchSnapshot;
    readonly epicVerificationClaims?: readonly EpicVerificationClaim[];
  },
): ExecutorPetriRuntime {
  const topology = compileExecutorTopology(plan);
  const currentMarking = authority?.currentMarking ?? materializeCurrentMarking(topology, state, plan);
  const claimedEpicIds = new Set(authority?.epicVerificationClaims?.map((claim) => claim.epicId) ?? []);
  const enabledTransitions = authority?.parallelSliceBatch
    ? []
    : topology.transitions.filter(
        (transition): transition is ExecutableExecutorTransition =>
          transition.step !== undefined &&
          !(transition.step.kind === 'epic_verify' && claimedEpicIds.has(transition.step.epicId)) &&
          isPetriTransitionEnabled(transition, currentMarking, state, plan),
      );

  return {
    topology,
    currentMarking,
    enabledTransitions,
    readySteps: enabledTransitions.map((transition) => transition.step),
    blockedSteps: blockedExecutorSteps(state, plan, authority),
    transitionForReadyStep(step) {
      return enabledTransitions.find((transition) => readyStepsEqual(transition.step, step));
    },
  };
}

export function bindExecutorPetriRuntime(
  runtime: ExecutorPetriRuntime,
  ctx: ExecutorTransitionBindingContext,
): ExecutorPetriRuntimeBindings {
  return {
    runtime,
    transitionForReadyStep(step) {
      const transition = runtime.transitionForReadyStep(step);
      return transition
        ? {
            transition,
            execute: () => executeExecutorReadyStep(step, ctx),
          }
        : undefined;
    },
  };
}

function isPetriTransitionEnabled(
  transition: ExecutorTransition,
  currentMarking: Record<string, number>,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): boolean {
  if (!transition.inputArcs.every((arc) => (currentMarking[arc.placeId] ?? 0) >= arc.weight)) return false;
  return transition.guard ? evaluateTransitionGuard(transition.guard, state, plan) : true;
}

function evaluateTransitionGuard(
  guard: ExecutorTransitionGuard,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): boolean {
  switch (guard.kind) {
    case 'slice_ready': {
      if (inFlightSliceId(state, plan)) return false;
      const readySliceIds = new Set(
        readyPlanSliceIds(plan, state.completedSliceIds ?? [], state.completedEpicIds ?? []),
      );
      return readySliceIds.has(guard.sliceId);
    }
    case 'no_remaining_slices':
      return nextIncompletePetriSliceId(state, plan) === undefined;
    case 'active_slice':
      return activeOrNextPetriSliceId(state, plan) === guard.sliceId;
  }
}

export function resolvePetriTransitionIdForReadyStep(
  step: ReadyStep,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  return resolveTransitionIdForReadyStep(step, state, plan);
}

function resolveTransitionIdForReadyStep(
  step: ReadyStep,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  switch (step.kind) {
    case 'worktree_create':
    case 'populate':
    case 'source_policy':
    case 'source_copy':
    case 'report_init':
    case 'run_complete':
    case 'petri_export':
    case 'promotion':
      return step.kind;
    case 'slice_start':
      return sliceTransitionId('slice_start', step.sliceId);
    case 'slice_execute':
      return currentSliceTransitionId('slice_execute', state, plan);
    case 'agent_result':
      return currentAttemptSuccessTransitionId('agent', state, plan);
    case 'test_result':
      return currentAttemptSuccessTransitionId('verify', state, plan);
    case 'slice_complete':
      return currentSliceTransitionId('slice_complete', state, plan);
    case 'slice_integrate':
      return currentSliceIntegrationTransitionId(state, plan);
    case 'epic_integrate':
    case 'epic_verify':
    case 'epic_complete':
      return `${step.kind}:${step.epicId}`;
  }
}

function readyStepsEqual(left: ReadyStep, right: ReadyStep): boolean {
  if (left.kind !== right.kind) return false;
  if ('sliceId' in left && 'sliceId' in right) return left.sliceId === right.sliceId;
  return 'epicId' in left && 'epicId' in right ? left.epicId === right.epicId : true;
}

function epicIdForSlice(plan: SchedulerPlan | undefined, sliceId: string): string | undefined {
  return plan?.slices?.find((slice) => slice.id === sliceId)?.epic_id;
}

function derivedFromForSlice(
  plan: SchedulerPlan | undefined,
  sliceId: string,
): readonly string[] | undefined {
  return plan?.slices?.find((slice) => slice.id === sliceId)?.derived_from;
}

function blockedExecutorSteps(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  authority?: {
    readonly currentMarking: Record<string, number>;
    readonly parallelSliceBatch?: ParallelSliceBatchSnapshot;
    readonly epicVerificationClaims?: readonly EpicVerificationClaim[];
  },
): readonly BlockedStep[] {
  const epicClaimBlockers: BlockedStep[] = (authority?.epicVerificationClaims ?? []).map((claim) => ({
    kind: 'epic_verify',
    epicId: claim.epicId,
    blockers: [{ kind: 'epic_verification_authority', phase: claim.phase }],
  }));
  if (authority?.parallelSliceBatch) {
    const batch = authority.parallelSliceBatch;
    return [
      ...batch.claimedSliceIds.map<BlockedStep>((sliceId) => {
        const slice = plan?.slices?.find((candidate) => candidate.id === sliceId);
        return {
          kind: 'slice_start',
          sliceId,
          ...(slice?.epic_id === undefined ? {} : { epicId: slice.epic_id }),
          ...(slice?.derived_from === undefined ? {} : { derivedFrom: slice.derived_from }),
          blockers: [
            {
              kind: 'parallel_authority',
              state: parallelSliceAuthorityState(
                sliceId,
                authority.currentMarking,
                batch,
                state.completedSliceIds ?? [],
              ),
            },
          ],
        };
      }),
      ...epicClaimBlockers,
    ];
  }
  const activeSliceId = inFlightSliceId(state, plan);
  if (activeSliceId) {
    return [
      ...readyPlanSliceIds(plan, state.completedSliceIds ?? [], state.completedEpicIds ?? [])
        .filter((sliceId) => sliceId !== activeSliceId)
        .map<BlockedStep>((sliceId) => {
          const epicId = epicIdForSlice(plan, sliceId);
          const derivedFrom = derivedFromForSlice(plan, sliceId);
          return {
            kind: 'slice_start',
            sliceId,
            ...(epicId === undefined ? {} : { epicId }),
            ...(derivedFrom === undefined ? {} : { derivedFrom }),
            blockers: [{ kind: 'active_slice', sliceId: activeSliceId }],
          };
        }),
      ...epicClaimBlockers,
    ];
  }
  const sliceBlockers =
    state.status === 'reports_initialized' || state.status === 'slice_completed'
      ? blockedPlanSliceSteps(plan, state.completedSliceIds ?? [], state.completedEpicIds ?? [])
      : [];
  return [...sliceBlockers, ...epicClaimBlockers];
}

function parallelSliceAuthorityState(
  sliceId: string,
  marking: Record<string, number>,
  batch: ParallelSliceBatchSnapshot,
  completedSliceIds: readonly string[],
): 'claimed' | 'running' | 'succeeded_unintegrated' | 'failed' | 'integrated' {
  const settlement = batch.settlements.find((candidate) => candidate.sliceId === sliceId);
  if (settlement?.status === 'failed') return 'failed';
  if (completedSliceIds.includes(sliceId)) return 'integrated';
  if (settlement?.status === 'succeeded') return 'succeeded_unintegrated';
  const running = Object.entries(marking).some(
    ([placeId, count]) =>
      count > 0 && placeId.startsWith(`slice:${sliceId}:`) && placeId.includes('_attempt:'),
  );
  return running ? 'running' : 'claimed';
}

function materializeCurrentMarking(
  topology: ExecutorTopology,
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): Record<string, number> {
  if (state.status === 'abandoned') return {};
  const history = projectExecutorPetriTransitionHistory(state, plan);
  if (!history) throw new Error(`Cannot project Petri transition history for run status ${state.status}`);
  const replay = replayTransitionHistory(topology, history.transitionIds);
  if (!replay) throw new Error(`Cannot replay Petri transition history for run status ${state.status}`);
  return replay.currentMarking;
}

function baseRunTransitionHistory(status: RunMetadata['status']): readonly string[] {
  switch (status) {
    case 'created':
    case 'abandoned':
      return [];
    case 'worktree_created':
      return ['worktree_create'];
    case 'worktree_populated':
      return ['worktree_create', 'populate'];
    case 'source_policy_selected':
      return ['worktree_create', 'populate', 'source_policy'];
    case 'source_copied':
      return ['worktree_create', 'populate', 'source_policy', 'source_copy'];
    default:
      return ['worktree_create', 'populate', 'source_policy', 'source_copy', 'report_init'];
  }
}

function currentSliceTransitionId(
  kind: 'slice_execute' | 'slice_complete',
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const sliceId = activeOrNextPetriSliceId(state, plan);
  return sliceId ? sliceTransitionId(kind, sliceId) : undefined;
}

function currentSliceIntegrationTransitionId(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const sliceId = activeOrNextPetriSliceId(state, plan);
  return sliceId
    ? sliceRepairTopology.integrationTransitionId(
        sliceId,
        sliceRepairProtocol.currentCycle(state.sliceRepairHistory, sliceId),
      )
    : undefined;
}

function currentAttemptSuccessTransitionId(
  stage: 'agent' | 'verify',
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
): string | undefined {
  const sliceId = activeOrNextPetriSliceId(state, plan);
  const attempt = (state.activeSliceAttempts ?? 0) + 1;
  const cycle = sliceId ? sliceRepairProtocol.currentCycle(state.sliceRepairHistory, sliceId) : 1;
  return sliceId && attempt <= MAX_STAGE_ATTEMPTS
    ? sliceRepairTopology.attemptSuccessTransitionId(stage, sliceId, cycle, attempt)
    : undefined;
}

function attemptFailureTransitionHistory(
  stage: 'agent' | 'verify',
  sliceId: string,
  cycle: number,
  failures: number,
): readonly string[] {
  const retries = Array.from({ length: Math.min(failures, MAX_STAGE_ATTEMPTS - 1) }, (_, index) =>
    sliceRepairTopology.attemptRetryTransitionId(stage, sliceId, cycle, index + 1),
  );
  return failures >= MAX_STAGE_ATTEMPTS
    ? [...retries, sliceRepairTopology.attemptExhaustedTransitionId(stage, sliceId, cycle)]
    : retries;
}

function completedRepairTransitionHistory(
  state: RunMetadata,
  sliceId: string,
  fallback: {
    readonly fallbackAgentSuccess?: boolean;
    readonly fallbackVerifySuccess?: boolean;
  } = {},
): readonly string[] {
  const cycles = state.sliceRepairHistory?.[sliceId] ?? [];
  if (cycles.length === 0) {
    return [
      ...(fallback.fallbackAgentSuccess
        ? [sliceRepairTopology.attemptSuccessTransitionId('agent', sliceId, 1, 1)]
        : []),
      ...(fallback.fallbackVerifySuccess
        ? [
            sliceRepairTopology.attemptSuccessTransitionId('verify', sliceId, 1, 1),
            sliceRepairTopology.verifyVerdictTransitionId('passed', sliceId, 1, 1),
          ]
        : []),
    ];
  }
  const activeCycle = activeSliceRepairCycle(state, sliceId);
  return cycles.flatMap((cycle) => {
    const transitions = cycle.epochs.flatMap((epoch) =>
      completedEpochTransitionHistory(sliceId, cycle.cycle, epoch),
    );
    const verdict = [...cycle.epochs].reverse().find((epoch) => epoch.verdict !== undefined)?.verdict;
    return verdict === 'failed' && activeCycle > cycle.cycle
      ? [...transitions, sliceRepairTopology.verifyRepairTransitionId(sliceId, cycle.cycle)]
      : transitions;
  });
}

function activeStageTransitionHistory(
  state: RunMetadata,
  stage: SliceRepairStage,
  sliceId: string,
): readonly string[] {
  const cycle = activeSliceRepairCycle(state, sliceId);
  const latest = state.sliceRepairHistory?.[sliceId]
    ?.find((record) => record.cycle === cycle)
    ?.epochs.slice()
    .reverse()
    .find((epoch) => epoch.stage === stage);
  if (latest?.outcome === 'exhausted' && state.activeSliceAttempts === latest.attempts) return [];
  return attemptFailureTransitionHistory(stage, sliceId, cycle, state.activeSliceAttempts ?? 0);
}

function completedEpochTransitionHistory(
  sliceId: string,
  cycle: number,
  epoch: SliceStageEpoch,
): readonly string[] {
  if (epoch.outcome === 'reset') {
    return [sliceRepairTopology.attemptResetTransitionId(epoch.stage, sliceId, cycle)];
  }
  const failures = epoch.outcome === 'succeeded' ? epoch.attempts - 1 : epoch.attempts;
  const transitions = attemptFailureTransitionHistory(epoch.stage, sliceId, cycle, failures);
  return epoch.outcome === 'succeeded'
    ? [
        ...transitions,
        sliceRepairTopology.attemptSuccessTransitionId(epoch.stage, sliceId, cycle, epoch.attempts),
        ...(epoch.stage === 'verify' && epoch.verdict
          ? [sliceRepairTopology.verifyVerdictTransitionId(epoch.verdict, sliceId, cycle, epoch.attempts)]
          : []),
      ]
    : transitions;
}

function completedSliceTransitionHistory(
  state: RunMetadata,
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): readonly string[] {
  if (!plan?.slices?.length) return [];
  const history: string[] = [];
  const completedSlices = new Set<string>();
  const integratedEpics = new Set<string>();
  const verifiedEpics = new Set<string>();
  const completedEpics = new Set<string>();
  for (const sliceId of completedSliceIds) {
    history.push(
      sliceTransitionId('slice_start', sliceId),
      sliceTransitionId('slice_execute', sliceId),
      ...completedRepairTransitionHistory(state, sliceId, {
        fallbackAgentSuccess: true,
        fallbackVerifySuccess: true,
      }),
      sliceRepairTopology.integrationTransitionId(sliceId, activeSliceRepairCycle(state, sliceId)),
      sliceTransitionId('slice_complete', sliceId),
    );
    completedSlices.add(sliceId);
    appendRecordedEpicLifecycle(
      state,
      plan,
      completedSlices,
      integratedEpics,
      verifiedEpics,
      completedEpics,
      history,
    );
  }
  return history;
}

function appendRecordedEpicLifecycle(
  state: RunMetadata,
  plan: SchedulerPlan,
  completedSlices: ReadonlySet<string>,
  integratedEpics: Set<string>,
  verifiedEpics: Set<string>,
  completedEpics: Set<string>,
  history: string[],
): void {
  for (const transitionId of state.epicTransitionHistory ?? []) {
    const [kind, epicId] = transitionId.split(':');
    const epic = (plan.epics ?? []).find((candidate) => candidate.id === epicId);
    if (!epic) return;
    if (kind === 'epic_integrate') {
      if (integratedEpics.has(epic.id)) continue;
      const members = (plan.slices ?? []).filter((slice) => slice.epic_id === epic.id);
      if (!members.every((slice) => completedSlices.has(slice.id))) return;
      if (!(epic.depends_on ?? []).every((dependencyId) => completedEpics.has(dependencyId))) return;
      history.push(transitionId);
      integratedEpics.add(epic.id);
      continue;
    }
    if (kind === 'epic_verify') {
      if (verifiedEpics.has(epic.id)) continue;
      if (!integratedEpics.has(epic.id) || !epic.verification?.length) return;
      history.push(transitionId);
      verifiedEpics.add(epic.id);
      continue;
    }
    if (kind === 'epic_complete') {
      if (completedEpics.has(epic.id)) continue;
      const ready = epic.verification?.length ? verifiedEpics.has(epic.id) : integratedEpics.has(epic.id);
      if (!ready) return;
      history.push(transitionId);
      completedEpics.add(epic.id);
      continue;
    }
    return;
  }
}

function inFlightSliceId(state: RunMetadata, plan: SchedulerPlan | undefined): string | undefined {
  switch (state.status) {
    case 'slice_started':
    case 'slice_execution_requested':
    case 'agent_result_ingested':
    case 'slice_integrated':
      return activeOrNextPetriSliceId(state, plan);
    case 'test_result_ingested':
      return state.activeSliceId ?? latestVerificationSliceId(state);
    default:
      return undefined;
  }
}

function latestVerificationSliceId(state: RunMetadata): string | undefined {
  const entries = Object.entries(state.sliceRepairHistory ?? {});
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const [sliceId, cycles] = entries[index]!;
    if (cycles.some((cycle) => cycle.epochs.some((epoch) => epoch.stage === 'verify' && epoch.verdict))) {
      return sliceId;
    }
  }
  return undefined;
}

export async function executeExecutorReadyStep(
  step: ReadyStep,
  ctx: ExecutorTransitionBindingContext,
): Promise<ExecutorStepResult> {
  const { cwd, runId, ports } = ctx;
  switch (step.kind) {
    case 'worktree_create':
      return createWorktree({
        cwd,
        runId,
        gitWorktree: ports.gitWorktree,
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      });
    case 'populate':
      return populateWorktree({ cwd, runId });
    case 'source_policy':
      return selectSourcePolicy({
        cwd,
        runId,
        policy: await sourcePolicyForRun(ctx),
      });
    case 'source_copy':
      return copyHostSource({ cwd, runId });
    case 'report_init':
      return initializeReports({ cwd, runId });
    case 'slice_start':
      return startSlice({ cwd, runId, sliceId: step.sliceId });
    case 'slice_execute':
      return requestSliceExecution({ cwd, runId, gitSliceIntegration: ports.gitSliceIntegration });
    case 'agent_result':
      return ingestAgentResult({
        cwd,
        runId,
        agentRunner: ports.agentRunner,
        ...(ctx.runtime ? { runtime: ctx.runtime } : {}),
        ...(ctx.onAgentUpdate ? { onAgentUpdate: ctx.onAgentUpdate } : {}),
      });
    case 'test_result':
      return ingestTestResult({
        cwd,
        runId,
        testRunner: ports.testRunner,
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        ...(ctx.onVerifyUpdate ? { onVerifyUpdate: ctx.onVerifyUpdate } : {}),
      });
    case 'slice_complete':
      return completeSlice({ cwd, runId });
    case 'slice_integrate':
      return integrateSlice({ cwd, runId, gitSliceIntegration: ports.gitSliceIntegration });
    case 'epic_integrate':
    case 'epic_verify':
    case 'epic_complete':
      return executeEpicLifecycleStep({
        cwd,
        runId,
        step,
        plan: ctx.plan,
        testRunner: ports.testRunner,
        ...(ctx.currentMarking ? { currentMarking: ctx.currentMarking } : {}),
        ...(ctx.firedTransitionCount === undefined ? {} : { firedTransitionCount: ctx.firedTransitionCount }),
        ...(ctx.markingSnapshot ? { markingSnapshot: ctx.markingSnapshot } : {}),
        ...(ctx.signal ? { signal: ctx.signal } : {}),
      });
    case 'run_complete':
      return completeRun({ cwd, runId });
    case 'petri_export':
      return exportPetri({ cwd, runId });
    case 'promotion':
      return preparePromotion({ cwd, runId, gitRunPromotion: ports.gitRunPromotion });
  }
}

async function sourcePolicyForRun(ctx: ExecutorTransitionBindingContext): Promise<SourcePolicyKind> {
  if (ctx.sourcePolicy) return ctx.sourcePolicy;

  const metadata = await readRunMetadata(runMetadataPath(ctx.cwd, ctx.runId));
  const path = metadata?.populatedPlanPath ?? populatedPlanPath(ctx.cwd, ctx.runId);
  const plan = projectSchedulerPlan(JSON.parse(await readFile(path, 'utf8')));
  return normalizeSchedulerPlanMode(plan) === 'brownfield' ? 'host_source_deferred' : 'plan_only';
}
