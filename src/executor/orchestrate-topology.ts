export type ReadyStep =
  | { readonly kind: 'worktree_create' }
  | { readonly kind: 'populate' }
  | { readonly kind: 'source_policy' }
  | { readonly kind: 'source_copy' }
  | { readonly kind: 'report_init' }
  | { readonly kind: 'slice_start'; readonly sliceId: string; readonly epicId?: string }
  | { readonly kind: 'slice_execute' }
  | { readonly kind: 'agent_result' }
  | { readonly kind: 'test_result' }
  | { readonly kind: 'slice_complete' }
  | { readonly kind: 'run_complete' }
  | { readonly kind: 'petri_export' }
  | { readonly kind: 'promotion' };

export interface BlockedStep {
  readonly kind: 'slice_start';
  readonly sliceId: string;
  readonly epicId?: string;
  readonly blockers: readonly BlockedStepReason[];
}

export type BlockedStepReason =
  | { readonly kind: 'dependency'; readonly sliceId: string }
  | { readonly kind: 'active_slice'; readonly sliceId: string };

/** The minimal plan projection the scheduler needs to resolve the slice frontier. */
export interface SchedulerPlan {
  readonly mode?: 'greenfield' | 'brownfield';
  readonly slices?: readonly SchedulerPlanSlice[];
}

export interface SchedulerPlanSlice {
  readonly id: string;
  readonly epic_id?: string;
  readonly depends_on?: readonly string[];
}

export type SchedulerPlanMode = NonNullable<SchedulerPlan['mode']>;

export function normalizeSchedulerPlanMode(plan: SchedulerPlan | undefined): SchedulerPlanMode {
  return plan?.mode ?? 'greenfield';
}

export interface ExecutorSubnet {
  readonly id: string;
  readonly kind: 'run_control' | 'slice_control';
  readonly sliceId?: string;
  readonly epicId?: string;
  readonly transitionIds: readonly string[];
}

export interface ExecutorPlace {
  readonly id: string;
  readonly subnetId: string;
  readonly name: string;
}

export interface ExecutorArc {
  readonly placeId: string;
  readonly weight: number;
}

export type ExecutorTransitionGuard =
  | { readonly kind: 'slice_ready'; readonly sliceId: string; readonly dependsOn: readonly string[] }
  | { readonly kind: 'no_remaining_slices' }
  | { readonly kind: 'active_slice'; readonly sliceId: string };

export interface ExecutorTransition {
  readonly id: string;
  readonly subnetId: string;
  readonly epicId?: string;
  readonly step: ReadyStep;
  readonly inputArcs: readonly ExecutorArc[];
  readonly outputArcs: readonly ExecutorArc[];
  readonly guard?: ExecutorTransitionGuard;
  readonly contract: {
    readonly kind: 'mechanical' | 'structural';
    readonly lane: 'run' | 'slice';
  };
}

export interface ExecutorTopology {
  readonly subnets: readonly ExecutorSubnet[];
  readonly places: readonly ExecutorPlace[];
  readonly transitions: readonly ExecutorTransition[];
  readonly initialMarking: Record<string, number>;
}

export type ExecutorNetEvent =
  | {
      readonly kind: 'transition_fired';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly transitionId: string;
      readonly subnetId: string;
      readonly epicId?: string;
      readonly step: ReadyStep['kind'];
      readonly contract: ExecutorTransition['contract'];
      readonly consumed: readonly string[];
      readonly produced: readonly string[];
      readonly fromStatus: import('./run.js').RunMetadata['status'];
      readonly toStatus: import('./run.js').RunMetadata['status'];
    }
  | {
      readonly kind: 'net_completed';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
    }
  | {
      readonly kind: 'net_halted';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly step?: ReadyStep['kind'];
      readonly reason?: string;
    }
  | {
      readonly kind: 'net_deadlocked';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
    };

const RUN_CONTROL_TRANSITIONS = [
  'worktree_create',
  'populate',
  'source_policy',
  'source_copy',
  'report_init',
  'run_complete',
  'petri_export',
  'promotion',
] as const;

const RUN_CREATED_PLACE = 'run:created';
const RUN_WORKTREE_CREATED_PLACE = 'run:worktree_created';
const RUN_WORKTREE_POPULATED_PLACE = 'run:worktree_populated';
const RUN_SOURCE_POLICY_SELECTED_PLACE = 'run:source_policy_selected';
const RUN_SOURCE_COPIED_PLACE = 'run:source_copied';
const RUN_SLICE_FRONTIER_PLACE = 'run:slice_frontier';
const RUN_COMPLETED_PLACE = 'run:run_completed';
const RUN_PETRI_EXPORTED_PLACE = 'run:petri_exported';
const RUN_PROMOTION_PREPARED_PLACE = 'run:promotion_prepared';

function sliceStartedPlace(sliceId: string): string {
  return `slice:${sliceId}:started`;
}

function sliceExecutionRequestedPlace(sliceId: string): string {
  return `slice:${sliceId}:execution_requested`;
}

function sliceAgentResultPlace(sliceId: string): string {
  return `slice:${sliceId}:agent_result_ingested`;
}

function sliceTestResultPlace(sliceId: string): string {
  return `slice:${sliceId}:test_result_ingested`;
}

export function sliceTransitionId(
  kind: Exclude<ReadyStep['kind'], (typeof RUN_CONTROL_TRANSITIONS)[number]>,
  sliceId: string,
): string {
  return `${kind}:${sliceId}`;
}

export function readyPlanSliceIds(
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): readonly string[] {
  const completed = new Set(completedSliceIds);
  return (plan?.slices ?? [])
    .filter(
      (slice) =>
        !completed.has(slice.id) && planSliceDependsOn(slice).every((sliceId) => completed.has(sliceId)),
    )
    .map((slice) => slice.id);
}

export function blockedPlanSliceSteps(
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
): readonly BlockedStep[] {
  const completed = new Set(completedSliceIds);
  return (plan?.slices ?? [])
    .filter((slice) => !completed.has(slice.id))
    .map((slice) => ({
      kind: 'slice_start' as const,
      sliceId: slice.id,
      ...(slice.epic_id === undefined ? {} : { epicId: slice.epic_id }),
      blockers: planSliceDependsOn(slice)
        .filter((sliceId) => !completed.has(sliceId))
        .map((sliceId) => ({ kind: 'dependency' as const, sliceId })),
    }))
    .filter((step) => step.blockers.length > 0);
}

export function planSliceDependsOn(slice: SchedulerPlanSlice): readonly string[] {
  return slice.depends_on ?? [];
}

export function compileExecutorTopology(plan: SchedulerPlan | undefined): ExecutorTopology {
  const seenSliceIds = new Set<string>();
  for (const slice of plan?.slices ?? []) {
    if (seenSliceIds.has(slice.id)) {
      throw new Error(`Duplicate slice id in executor topology: ${slice.id}`);
    }
    seenSliceIds.add(slice.id);
  }

  const runSubnet: ExecutorSubnet = {
    id: 'run',
    kind: 'run_control',
    transitionIds: [...RUN_CONTROL_TRANSITIONS],
  };
  const runPlaces: ExecutorPlace[] = [
    { id: RUN_CREATED_PLACE, subnetId: 'run', name: 'Created' },
    { id: RUN_WORKTREE_CREATED_PLACE, subnetId: 'run', name: 'Worktree created' },
    { id: RUN_WORKTREE_POPULATED_PLACE, subnetId: 'run', name: 'Worktree populated' },
    { id: RUN_SOURCE_POLICY_SELECTED_PLACE, subnetId: 'run', name: 'Source policy selected' },
    { id: RUN_SOURCE_COPIED_PLACE, subnetId: 'run', name: 'Source copied' },
    { id: RUN_SLICE_FRONTIER_PLACE, subnetId: 'run', name: 'Slice frontier' },
    { id: RUN_COMPLETED_PLACE, subnetId: 'run', name: 'Run completed' },
    { id: RUN_PETRI_EXPORTED_PLACE, subnetId: 'run', name: 'Petri exported' },
    { id: RUN_PROMOTION_PREPARED_PLACE, subnetId: 'run', name: 'Promotion prepared' },
  ];
  const runTransitions: ExecutorTransition[] = RUN_CONTROL_TRANSITIONS.map((id) => ({
    id,
    subnetId: 'run',
    step: { kind: id },
    inputArcs: [
      {
        placeId:
          id === 'worktree_create'
            ? RUN_CREATED_PLACE
            : id === 'populate'
              ? RUN_WORKTREE_CREATED_PLACE
              : id === 'source_policy'
                ? RUN_WORKTREE_POPULATED_PLACE
                : id === 'source_copy'
                  ? RUN_SOURCE_POLICY_SELECTED_PLACE
                  : id === 'report_init'
                    ? RUN_SOURCE_COPIED_PLACE
                    : id === 'run_complete'
                      ? RUN_SLICE_FRONTIER_PLACE
                      : id === 'petri_export'
                        ? RUN_COMPLETED_PLACE
                        : RUN_PETRI_EXPORTED_PLACE,
        weight: 1,
      },
    ],
    outputArcs: [
      {
        placeId:
          id === 'worktree_create'
            ? RUN_WORKTREE_CREATED_PLACE
            : id === 'populate'
              ? RUN_WORKTREE_POPULATED_PLACE
              : id === 'source_policy'
                ? RUN_SOURCE_POLICY_SELECTED_PLACE
                : id === 'source_copy'
                  ? RUN_SOURCE_COPIED_PLACE
                  : id === 'report_init'
                    ? RUN_SLICE_FRONTIER_PLACE
                    : id === 'run_complete'
                      ? RUN_COMPLETED_PLACE
                      : id === 'petri_export'
                        ? RUN_PETRI_EXPORTED_PLACE
                        : RUN_PROMOTION_PREPARED_PLACE,
        weight: 1,
      },
    ],
    ...(id === 'run_complete' ? { guard: { kind: 'no_remaining_slices' } as const } : {}),
    contract: { kind: id === 'source_policy' ? 'structural' : 'mechanical', lane: 'run' },
  }));

  const sliceSubnets = (plan?.slices ?? []).map<ExecutorSubnet>((slice) => ({
    id: `slice:${slice.id}`,
    kind: 'slice_control',
    sliceId: slice.id,
    ...(slice.epic_id === undefined ? {} : { epicId: slice.epic_id }),
    transitionIds: [
      sliceTransitionId('slice_start', slice.id),
      sliceTransitionId('slice_execute', slice.id),
      sliceTransitionId('agent_result', slice.id),
      sliceTransitionId('test_result', slice.id),
      sliceTransitionId('slice_complete', slice.id),
    ],
  }));
  const slicePlaces = sliceSubnets.flatMap<ExecutorPlace>((subnet) => {
    const sliceId = subnet.sliceId!;
    return [
      { id: sliceStartedPlace(sliceId), subnetId: subnet.id, name: 'Slice started' },
      {
        id: sliceExecutionRequestedPlace(sliceId),
        subnetId: subnet.id,
        name: 'Slice execution requested',
      },
      {
        id: sliceAgentResultPlace(sliceId),
        subnetId: subnet.id,
        name: 'Agent result ingested',
      },
      {
        id: sliceTestResultPlace(sliceId),
        subnetId: subnet.id,
        name: 'Test result ingested',
      },
    ];
  });
  const sliceTransitions = sliceSubnets.flatMap<ExecutorTransition>((subnet) => {
    const sliceId = subnet.sliceId!;
    return [
      {
        id: sliceTransitionId('slice_start', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        step: {
          kind: 'slice_start',
          sliceId,
          ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        },
        inputArcs: [{ placeId: RUN_SLICE_FRONTIER_PLACE, weight: 1 }],
        outputArcs: [{ placeId: sliceStartedPlace(sliceId), weight: 1 }],
        guard: {
          kind: 'slice_ready',
          sliceId,
          dependsOn: planSliceDependsOn(
            plan?.slices?.find((slice) => slice.id === sliceId) ?? { id: sliceId },
          ),
        },
        contract: { kind: 'structural', lane: 'slice' },
      },
      {
        id: sliceTransitionId('slice_execute', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        step: { kind: 'slice_execute' },
        inputArcs: [{ placeId: sliceStartedPlace(sliceId), weight: 1 }],
        outputArcs: [{ placeId: sliceExecutionRequestedPlace(sliceId), weight: 1 }],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'mechanical', lane: 'slice' },
      },
      {
        id: sliceTransitionId('agent_result', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        step: { kind: 'agent_result' },
        inputArcs: [{ placeId: sliceExecutionRequestedPlace(sliceId), weight: 1 }],
        outputArcs: [{ placeId: sliceAgentResultPlace(sliceId), weight: 1 }],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'mechanical', lane: 'slice' },
      },
      {
        id: sliceTransitionId('test_result', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        step: { kind: 'test_result' },
        inputArcs: [{ placeId: sliceAgentResultPlace(sliceId), weight: 1 }],
        outputArcs: [{ placeId: sliceTestResultPlace(sliceId), weight: 1 }],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'mechanical', lane: 'slice' },
      },
      {
        id: sliceTransitionId('slice_complete', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        step: { kind: 'slice_complete' },
        inputArcs: [{ placeId: sliceTestResultPlace(sliceId), weight: 1 }],
        outputArcs: [{ placeId: RUN_SLICE_FRONTIER_PLACE, weight: 1 }],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'structural', lane: 'slice' },
      },
    ];
  });

  return {
    subnets: [runSubnet, ...sliceSubnets],
    places: [...runPlaces, ...slicePlaces],
    transitions: [...runTransitions, ...sliceTransitions],
    initialMarking: { [RUN_CREATED_PLACE]: 1 },
  };
}
