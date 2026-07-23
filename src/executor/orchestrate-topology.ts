import { sliceRepairProtocol, sliceRepairTopology, type SliceRepairPolicy } from './slice-repair-cycle.js';

export type ReadyStep =
  | { readonly kind: 'worktree_create' }
  | { readonly kind: 'populate' }
  | { readonly kind: 'source_policy' }
  | { readonly kind: 'source_copy' }
  | { readonly kind: 'report_init' }
  | {
      readonly kind: 'slice_start';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
    }
  | {
      readonly kind: 'slice_execute';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
    }
  | {
      readonly kind: 'agent_result';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
    }
  | {
      readonly kind: 'test_result';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
    }
  | {
      readonly kind: 'slice_integrate';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
    }
  | {
      readonly kind: 'slice_complete';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
    }
  | { readonly kind: 'epic_integrate'; readonly epicId: string }
  | { readonly kind: 'epic_verify'; readonly epicId: string }
  | { readonly kind: 'epic_complete'; readonly epicId: string }
  | { readonly kind: 'run_complete' }
  | { readonly kind: 'petri_export' }
  | { readonly kind: 'promotion' };

export type BlockedStep =
  | {
      readonly kind: 'authority_unreadable';
      readonly blockers: readonly [{ readonly kind: 'parallel_authority_unreadable' }];
    }
  | {
      readonly kind: 'slice_start';
      readonly sliceId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
      readonly blockers: readonly BlockedStepReason[];
    }
  | {
      readonly kind: 'epic_verify';
      readonly epicId: string;
      readonly blockers: readonly BlockedStepReason[];
    };

export type BlockedStepReason =
  | { readonly kind: 'dependency'; readonly sliceId: string }
  | { readonly kind: 'epic_dependency'; readonly epicId: string }
  | {
      readonly kind: 'parallel_authority';
      readonly state: 'claimed' | 'running' | 'succeeded_unintegrated' | 'failed' | 'integrated';
    }
  | { readonly kind: 'epic_verification_authority'; readonly phase: 'claimed' | 'transitioned' }
  | { readonly kind: 'parallel_authority_unreadable' }
  | { readonly kind: 'active_slice'; readonly sliceId: string };

/** The minimal plan projection the scheduler needs to resolve the slice frontier. */
export interface SchedulerPlan {
  readonly mode?: 'greenfield' | 'brownfield';
  readonly epics?: readonly SchedulerPlanEpic[];
  readonly slices?: readonly SchedulerPlanSlice[];
}

export interface SchedulerPlanVerificationTarget {
  readonly kind: 'criterion';
  readonly criterionId?: string;
  readonly target: string;
}

export interface SchedulerPlanEpic {
  readonly id: string;
  readonly summary?: string;
  readonly depends_on?: readonly string[];
  readonly verification?: readonly SchedulerPlanVerificationTarget[];
}

export interface SchedulerPlanSlice {
  readonly id: string;
  readonly epic_id?: string;
  readonly definition?: string;
  readonly depends_on?: readonly string[];
  readonly verification?: readonly SchedulerPlanVerificationTarget[];
  readonly derived_from?: readonly string[];
}

export type SchedulerPlanMode = NonNullable<SchedulerPlan['mode']>;

export function projectSchedulerPlan(value: unknown): SchedulerPlan | undefined {
  if (!isRecord(value)) return undefined;
  if (value.mode !== undefined && value.mode !== 'greenfield' && value.mode !== 'brownfield')
    return undefined;
  if (value.epics !== undefined && !Array.isArray(value.epics)) return undefined;
  if (value.slices !== undefined && !Array.isArray(value.slices)) return undefined;

  const epics = value.epics?.map(projectSchedulerPlanEpic);
  const slices = value.slices?.map(projectSchedulerPlanSlice);
  if (epics?.some((epic) => epic === undefined)) return undefined;
  if (slices?.some((slice) => slice === undefined)) return undefined;

  return {
    ...(value.mode === undefined ? {} : { mode: value.mode }),
    ...(epics === undefined ? {} : { epics: epics as readonly SchedulerPlanEpic[] }),
    ...(slices === undefined ? {} : { slices: slices as readonly SchedulerPlanSlice[] }),
  };
}

export function normalizeSchedulerPlanMode(plan: SchedulerPlan | undefined): SchedulerPlanMode {
  return plan?.mode ?? 'greenfield';
}

function projectSchedulerPlanSlice(value: unknown): SchedulerPlanSlice | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  if (value.epic_id !== undefined && typeof value.epic_id !== 'string') return undefined;
  if (value.definition !== undefined && typeof value.definition !== 'string') return undefined;
  if (
    value.depends_on !== undefined &&
    (!Array.isArray(value.depends_on) || value.depends_on.some((sliceId) => typeof sliceId !== 'string'))
  ) {
    return undefined;
  }
  const verification = projectSchedulerPlanVerification(value.verification);
  if (value.verification !== undefined && verification === undefined) return undefined;
  if (
    value.derived_from !== undefined &&
    (!Array.isArray(value.derived_from) || value.derived_from.some((itemId) => typeof itemId !== 'string'))
  ) {
    return undefined;
  }
  return {
    id: value.id,
    ...(value.epic_id === undefined ? {} : { epic_id: value.epic_id }),
    ...(value.definition === undefined ? {} : { definition: value.definition }),
    ...(value.depends_on === undefined ? {} : { depends_on: value.depends_on as readonly string[] }),
    ...(verification === undefined ? {} : { verification }),
    ...(value.derived_from === undefined ? {} : { derived_from: value.derived_from as readonly string[] }),
  };
}

function projectSchedulerPlanEpic(value: unknown): SchedulerPlanEpic | undefined {
  if (!isRecord(value) || typeof value.id !== 'string') return undefined;
  if (value.summary !== undefined && typeof value.summary !== 'string') return undefined;
  if (
    value.depends_on !== undefined &&
    (!Array.isArray(value.depends_on) || value.depends_on.some((epicId) => typeof epicId !== 'string'))
  ) {
    return undefined;
  }
  const verification = projectSchedulerPlanVerification(value.verification);
  if (value.verification !== undefined && verification === undefined) return undefined;
  return {
    id: value.id,
    ...(value.summary === undefined ? {} : { summary: value.summary }),
    ...(value.depends_on === undefined ? {} : { depends_on: value.depends_on as readonly string[] }),
    ...(verification === undefined ? {} : { verification }),
  };
}

function projectSchedulerPlanVerification(
  value: unknown,
): readonly SchedulerPlanVerificationTarget[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  const targets = value.map(projectSchedulerPlanVerificationTarget);
  return targets.some((target) => target === undefined)
    ? undefined
    : (targets as readonly SchedulerPlanVerificationTarget[]);
}

function projectSchedulerPlanVerificationTarget(value: unknown): SchedulerPlanVerificationTarget | undefined {
  if (!isRecord(value) || value.kind !== 'criterion' || typeof value.target !== 'string') return undefined;
  if (value.criterionId !== undefined && typeof value.criterionId !== 'string') return undefined;
  return {
    kind: 'criterion',
    ...(value.criterionId === undefined ? {} : { criterionId: value.criterionId }),
    target: value.target,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ExecutorSubnet {
  readonly id: string;
  readonly kind: 'run_control' | 'slice_control' | 'attempt_control' | 'epic_control';
  readonly sliceId?: string;
  readonly epicId?: string;
  readonly definition?: string;
  readonly verification?: readonly SchedulerPlanVerificationTarget[];
  readonly derivedFrom?: readonly string[];
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
  readonly derivedFrom?: readonly string[];
  /** Omitted for immutable topology gates that have no lifecycle side effect in this slice. */
  readonly step?: ReadyStep;
  readonly inputArcs: readonly ExecutorArc[];
  readonly outputArcs: readonly ExecutorArc[];
  readonly guard?: ExecutorTransitionGuard;
  readonly contract: {
    readonly kind: 'mechanical' | 'structural';
    readonly lane: 'run' | 'slice' | 'attempt' | 'epic';
  };
}

export interface ExecutorEpic {
  readonly id: string;
  readonly summary?: string;
  readonly dependsOn: readonly string[];
  readonly verification?: readonly SchedulerPlanVerificationTarget[];
  readonly sliceIds: readonly string[];
}

export interface ExecutorTopology {
  readonly epics?: readonly ExecutorEpic[];
  readonly subnets: readonly ExecutorSubnet[];
  readonly places: readonly ExecutorPlace[];
  readonly transitions: readonly ExecutorTransition[];
  readonly initialMarking: Record<string, number>;
}

export type ExecutorNetStepKind = ReadyStep['kind'];

export type ExecutorNetEventPayload =
  | {
      readonly kind: 'transition_fired';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly transitionId: string;
      readonly subnetId: string;
      readonly epicId?: string;
      readonly derivedFrom?: readonly string[];
      readonly step: ExecutorNetStepKind;
      readonly contract: ExecutorTransition['contract'];
      readonly consumed: readonly string[];
      readonly produced: readonly string[];
      readonly fromStatus: import('./run.js').RunMetadata['status'];
      readonly toStatus: import('./run.js').RunMetadata['status'];
      readonly attempt?: number;
    }
  | {
      readonly kind: 'attempt_failed';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly sliceId: string;
      readonly epicId?: string;
      readonly step: ReadyStep['kind'];
      readonly attempt: number;
      readonly reason: string;
    }
  | {
      readonly kind: 'epic_verification_claimed';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly epicId: string;
      readonly step: 'epic_verify';
    }
  | {
      readonly kind: 'net_completed';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly failedSliceIds: readonly string[];
    }
  | {
      readonly kind: 'net_halted';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly step?: ExecutorNetStepKind;
      readonly reason?: string;
      readonly failedSliceIds: readonly string[];
    }
  | {
      readonly kind: 'net_deadlocked';
      readonly runId: string;
      readonly runStatus: import('./run.js').RunMetadata['status'];
      readonly failedSliceIds: readonly string[];
    };

export type ExecutorNetEvent = ExecutorNetEventPayload & { readonly ts: string };

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

function sliceIntegratedPlace(sliceId: string): string {
  return `slice:${sliceId}:integrated`;
}

function sliceClaimPlace(sliceId: string): string {
  return `slice:${sliceId}:claim`;
}

function sliceCompletedPlace(sliceId: string): string {
  return `slice:${sliceId}:completed`;
}

function sliceDependencyPlace(sliceId: string, dependencyId: string): string {
  return `slice:${sliceId}:dependency:${dependencyId}`;
}

function sliceEpicDependencyPlace(sliceId: string, epicId: string): string {
  return `slice:${sliceId}:epic_dependency:${epicId}`;
}

function epicMemberPlace(epicId: string, sliceId: string): string {
  return `epic:${epicId}:member:${sliceId}`;
}

function epicIntegratedPlace(epicId: string): string {
  return `epic:${epicId}:integrated`;
}

function epicVerifiedPlace(epicId: string): string {
  return `epic:${epicId}:verified`;
}

function epicCompletedPlace(epicId: string): string {
  return `epic:${epicId}:completed`;
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
  completedEpicIds: readonly string[],
): readonly string[] {
  const completed = new Set(completedSliceIds);
  const completedEpics = new Set(completedEpicIds);
  return (plan?.slices ?? [])
    .filter(
      (slice) =>
        !completed.has(slice.id) &&
        planSliceDependsOn(slice).every((sliceId) => completed.has(sliceId)) &&
        epicDependenciesForSlice(plan, slice).every((epicId) => completedEpics.has(epicId)),
    )
    .map((slice) => slice.id);
}

export function blockedPlanSliceSteps(
  plan: SchedulerPlan | undefined,
  completedSliceIds: readonly string[],
  completedEpicIds: readonly string[],
): readonly BlockedStep[] {
  const completed = new Set(completedSliceIds);
  const completedEpics = new Set(completedEpicIds);
  return (plan?.slices ?? [])
    .filter((slice) => !completed.has(slice.id))
    .map((slice) => ({
      kind: 'slice_start' as const,
      sliceId: slice.id,
      ...(slice.epic_id === undefined ? {} : { epicId: slice.epic_id }),
      ...(slice.derived_from === undefined ? {} : { derivedFrom: slice.derived_from }),
      blockers: [
        ...planSliceDependsOn(slice)
          .filter((sliceId) => !completed.has(sliceId))
          .map((sliceId) => ({ kind: 'dependency' as const, sliceId })),
        ...epicDependenciesForSlice(plan, slice)
          .filter((epicId) => !completedEpics.has(epicId))
          .map((epicId) => ({ kind: 'epic_dependency' as const, epicId })),
      ],
    }))
    .filter((step) => step.blockers.length > 0);
}

export function planSliceDependsOn(slice: SchedulerPlanSlice): readonly string[] {
  return slice.depends_on ?? [];
}

function epicDependenciesForSlice(
  plan: SchedulerPlan | undefined,
  slice: SchedulerPlanSlice,
): readonly string[] {
  if (!slice.epic_id) return [];
  return plan?.epics?.find((epic) => epic.id === slice.epic_id)?.depends_on ?? [];
}

export function compileExecutorTopology(
  plan: SchedulerPlan | undefined,
  repairPolicy: SliceRepairPolicy = sliceRepairProtocol.policy,
): ExecutorTopology {
  sliceRepairProtocol.assertPolicy(repairPolicy);
  validateEpics(plan);
  const seenSliceIds = new Set<string>();
  for (const slice of plan?.slices ?? []) {
    if (slice.epic_id !== undefined && !plan?.epics?.some((epic) => epic.id === slice.epic_id)) {
      throw new Error(`Unknown slice epic in executor topology: ${slice.id} -> ${slice.epic_id}`);
    }
    if (seenSliceIds.has(slice.id)) {
      throw new Error(`Duplicate slice id in executor topology: ${slice.id}`);
    }
    seenSliceIds.add(slice.id);
  }
  for (const epic of plan?.epics ?? []) {
    if (!(plan?.slices ?? []).some((slice) => slice.epic_id === epic.id)) {
      throw new Error(`Epic has no member slices in executor topology: ${epic.id}`);
    }
  }
  for (const slice of plan?.slices ?? []) {
    for (const dependencyId of planSliceDependsOn(slice)) {
      if (dependencyId === slice.id) {
        throw new Error(`Slice cannot depend on itself in executor topology: ${slice.id}`);
      }
      if (!seenSliceIds.has(dependencyId)) {
        throw new Error(`Unknown slice dependency in executor topology: ${slice.id} -> ${dependencyId}`);
      }
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const slicesById = new Map((plan?.slices ?? []).map((slice) => [slice.id, slice]));
  const visit = (sliceId: string): void => {
    if (visited.has(sliceId)) return;
    if (visiting.has(sliceId)) throw new Error(`Cyclic slice dependency in executor topology: ${sliceId}`);
    const slice = slicesById.get(sliceId);
    if (!slice) throw new Error(`Unknown slice in executor topology: ${sliceId}`);
    visiting.add(sliceId);
    for (const dependencyId of planSliceDependsOn(slice)) visit(dependencyId);
    visiting.delete(sliceId);
    visited.add(sliceId);
  };
  for (const sliceId of seenSliceIds) visit(sliceId);
  const compiledEpics = plan?.epics?.map<ExecutorEpic>((epic) => ({
    id: epic.id,
    ...(epic.summary === undefined ? {} : { summary: epic.summary }),
    dependsOn: epic.depends_on ?? [],
    ...(epic.verification === undefined ? {} : { verification: epic.verification }),
    sliceIds: (plan?.slices ?? []).filter((slice) => slice.epic_id === epic.id).map((slice) => slice.id),
  }));

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
    inputArcs:
      id === 'run_complete'
        ? [
            ...(compiledEpics ?? []).map((epic) => ({ placeId: epicCompletedPlace(epic.id), weight: 1 })),
            ...(plan?.slices ?? [])
              .filter((slice) => slice.epic_id === undefined)
              .map((slice) => ({ placeId: sliceCompletedPlace(slice.id), weight: 1 })),
            ...((plan?.slices?.length ?? 0) === 0 && (compiledEpics?.length ?? 0) === 0
              ? [{ placeId: RUN_SLICE_FRONTIER_PLACE, weight: 1 }]
              : []),
          ]
        : [
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
                          : id === 'petri_export'
                            ? RUN_COMPLETED_PLACE
                            : RUN_PETRI_EXPORTED_PLACE,
              weight: 1,
            },
          ],
    outputArcs:
      id === 'report_init'
        ? [
            ...(plan?.slices ?? []).map((slice) => ({ placeId: sliceClaimPlace(slice.id), weight: 1 })),
            ...((plan?.slices?.length ?? 0) === 0 && (plan?.epics?.length ?? 0) === 0
              ? [{ placeId: RUN_SLICE_FRONTIER_PLACE, weight: 1 }]
              : []),
          ]
        : [
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
    ...(slice.definition === undefined ? {} : { definition: slice.definition }),
    ...(slice.verification === undefined ? {} : { verification: slice.verification }),
    ...(slice.derived_from === undefined ? {} : { derivedFrom: slice.derived_from }),
    transitionIds: [
      sliceTransitionId('slice_start', slice.id),
      sliceTransitionId('slice_execute', slice.id),
      sliceTransitionId('slice_complete', slice.id),
    ],
  }));
  const slicePlaces = sliceSubnets.flatMap<ExecutorPlace>((subnet) => {
    const sliceId = subnet.sliceId!;
    return [
      { id: sliceClaimPlace(sliceId), subnetId: subnet.id, name: 'Slice claim' },
      { id: sliceStartedPlace(sliceId), subnetId: subnet.id, name: 'Slice started' },
      { id: sliceIntegratedPlace(sliceId), subnetId: subnet.id, name: 'Slice integrated' },
      { id: sliceCompletedPlace(sliceId), subnetId: subnet.id, name: 'Slice completed' },
      ...planSliceDependsOn(plan?.slices?.find((slice) => slice.id === sliceId) ?? { id: sliceId }).map(
        (dependencyId) => ({
          id: sliceDependencyPlace(sliceId, dependencyId),
          subnetId: subnet.id,
          name: 'Slice dependency',
        }),
      ),
      ...epicDependenciesForSlice(
        plan,
        plan?.slices?.find((slice) => slice.id === sliceId) ?? { id: sliceId },
      ).map((epicId) => ({
        id: sliceEpicDependencyPlace(sliceId, epicId),
        subnetId: subnet.id,
        name: 'Epic dependency',
      })),
    ];
  });
  const sliceTransitions = sliceSubnets.flatMap<ExecutorTransition>((subnet) => {
    const sliceId = subnet.sliceId!;
    return [
      {
        id: sliceTransitionId('slice_start', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        ...(subnet.derivedFrom === undefined ? {} : { derivedFrom: subnet.derivedFrom }),
        step: {
          kind: 'slice_start',
          sliceId,
          ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
          ...(subnet.derivedFrom === undefined ? {} : { derivedFrom: subnet.derivedFrom }),
        },
        inputArcs: [
          { placeId: sliceClaimPlace(sliceId), weight: 1 },
          ...planSliceDependsOn(plan?.slices?.find((slice) => slice.id === sliceId) ?? { id: sliceId }).map(
            (dependencyId) => ({ placeId: sliceDependencyPlace(sliceId, dependencyId), weight: 1 }),
          ),
          ...epicDependenciesForSlice(
            plan,
            plan?.slices?.find((slice) => slice.id === sliceId) ?? { id: sliceId },
          ).map((epicId) => ({ placeId: sliceEpicDependencyPlace(sliceId, epicId), weight: 1 })),
        ],
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
        ...(subnet.derivedFrom === undefined ? {} : { derivedFrom: subnet.derivedFrom }),
        step: {
          kind: 'slice_execute',
          sliceId,
          ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
          ...(subnet.derivedFrom === undefined ? {} : { derivedFrom: subnet.derivedFrom }),
        },
        inputArcs: [{ placeId: sliceStartedPlace(sliceId), weight: 1 }],
        outputArcs: [{ placeId: sliceRepairTopology.attemptPlaceId('agent', sliceId, 1, 1), weight: 1 }],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'mechanical', lane: 'slice' },
      },
      {
        id: sliceTransitionId('slice_complete', sliceId),
        subnetId: subnet.id,
        ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
        ...(subnet.derivedFrom === undefined ? {} : { derivedFrom: subnet.derivedFrom }),
        step: {
          kind: 'slice_complete',
          sliceId,
          ...(subnet.epicId === undefined ? {} : { epicId: subnet.epicId }),
          ...(subnet.derivedFrom === undefined ? {} : { derivedFrom: subnet.derivedFrom }),
        },
        inputArcs: [{ placeId: sliceIntegratedPlace(sliceId), weight: 1 }],
        outputArcs: [
          ...(subnet.epicId === undefined
            ? [{ placeId: sliceCompletedPlace(sliceId), weight: 1 }]
            : [{ placeId: epicMemberPlace(subnet.epicId, sliceId), weight: 1 }]),
          ...(plan?.slices ?? [])
            .filter((slice) => planSliceDependsOn(slice).includes(sliceId))
            .map((slice) => ({ placeId: sliceDependencyPlace(slice.id, sliceId), weight: 1 })),
        ],
        guard: { kind: 'active_slice', sliceId },
        contract: { kind: 'structural', lane: 'slice' },
      },
    ];
  });

  const repairFragments = (plan?.slices ?? []).map((slice) =>
    sliceRepairTopology.compile({
      sliceId: slice.id,
      ...(slice.epic_id === undefined ? {} : { epicId: slice.epic_id }),
      ...(slice.derived_from === undefined ? {} : { derivedFrom: slice.derived_from }),
      integratedPlaceId: sliceIntegratedPlace(slice.id),
      policy: repairPolicy,
    }),
  );
  const attemptSubnets = repairFragments.flatMap((fragment) => fragment.subnets);
  const attemptPlaces = repairFragments.flatMap((fragment) => fragment.places);
  const attemptTransitions = repairFragments.flatMap((fragment) => fragment.transitions);

  const epicSubnets = (compiledEpics ?? []).map<ExecutorSubnet>((epic) => ({
    id: `epic:${epic.id}`,
    kind: 'epic_control',
    epicId: epic.id,
    ...(epic.verification === undefined ? {} : { verification: epic.verification }),
    transitionIds: [
      `epic_integrate:${epic.id}`,
      ...(epic.verification?.length ? [`epic_verify:${epic.id}`] : []),
      `epic_complete:${epic.id}`,
    ],
  }));
  const epicPlaces = epicSubnets.flatMap<ExecutorPlace>((subnet) => [
    ...(compiledEpics?.find((epic) => epic.id === subnet.epicId)?.sliceIds ?? []).map((sliceId) => ({
      id: epicMemberPlace(subnet.epicId!, sliceId),
      subnetId: subnet.id,
      name: 'Epic member joined',
    })),
    { id: epicIntegratedPlace(subnet.epicId!), subnetId: subnet.id, name: 'Epic integrated' },
    ...(subnet.verification?.length
      ? [{ id: epicVerifiedPlace(subnet.epicId!), subnetId: subnet.id, name: 'Epic verified' }]
      : []),
    { id: epicCompletedPlace(subnet.epicId!), subnetId: subnet.id, name: 'Epic completed' },
  ]);
  const epicTransitions = epicSubnets.flatMap<ExecutorTransition>((subnet) => {
    const epic = compiledEpics!.find((candidate) => candidate.id === subnet.epicId)!;
    const hasVerification = Boolean(epic.verification?.length);
    return [
      {
        id: `epic_integrate:${epic.id}`,
        subnetId: subnet.id,
        epicId: epic.id,
        step: { kind: 'epic_integrate', epicId: epic.id },
        inputArcs: epic.sliceIds.map((sliceId) => ({
          placeId: epicMemberPlace(epic.id, sliceId),
          weight: 1,
        })),
        outputArcs: [{ placeId: epicIntegratedPlace(epic.id), weight: 1 }],
        contract: { kind: 'structural', lane: 'epic' },
      },
      ...(hasVerification
        ? [
            {
              id: `epic_verify:${epic.id}`,
              subnetId: subnet.id,
              epicId: epic.id,
              step: { kind: 'epic_verify' as const, epicId: epic.id },
              inputArcs: [{ placeId: epicIntegratedPlace(epic.id), weight: 1 }],
              outputArcs: [{ placeId: epicVerifiedPlace(epic.id), weight: 1 }],
              contract: { kind: 'mechanical' as const, lane: 'epic' as const },
            },
          ]
        : []),
      {
        id: `epic_complete:${epic.id}`,
        subnetId: subnet.id,
        epicId: epic.id,
        step: { kind: 'epic_complete', epicId: epic.id },
        inputArcs: [
          { placeId: hasVerification ? epicVerifiedPlace(epic.id) : epicIntegratedPlace(epic.id), weight: 1 },
        ],
        outputArcs: [
          { placeId: epicCompletedPlace(epic.id), weight: 1 },
          ...(plan?.slices ?? [])
            .filter((slice) => epicDependenciesForSlice(plan, slice).includes(epic.id))
            .map((slice) => ({ placeId: sliceEpicDependencyPlace(slice.id, epic.id), weight: 1 })),
        ],
        contract: { kind: 'structural', lane: 'epic' },
      },
    ];
  });

  return {
    ...(compiledEpics === undefined ? {} : { epics: compiledEpics }),
    subnets: [runSubnet, ...sliceSubnets, ...attemptSubnets, ...epicSubnets],
    places: [...runPlaces, ...slicePlaces, ...attemptPlaces, ...epicPlaces],
    transitions: [...runTransitions, ...sliceTransitions, ...attemptTransitions, ...epicTransitions],
    initialMarking: { [RUN_CREATED_PLACE]: 1 },
  };
}

function validateEpics(plan: SchedulerPlan | undefined): void {
  const epics = plan?.epics ?? [];
  const byId = new Map<string, SchedulerPlanEpic>();
  for (const epic of epics) {
    if (byId.has(epic.id)) throw new Error(`Duplicate epic id in executor topology: ${epic.id}`);
    byId.set(epic.id, epic);
  }
  for (const epic of epics) {
    for (const dependencyId of epic.depends_on ?? []) {
      if (dependencyId === epic.id)
        throw new Error(`Epic cannot depend on itself in executor topology: ${epic.id}`);
      if (!byId.has(dependencyId)) {
        throw new Error(`Unknown epic dependency in executor topology: ${epic.id} -> ${dependencyId}`);
      }
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (epicId: string): void => {
    if (visited.has(epicId)) return;
    if (visiting.has(epicId)) throw new Error(`Cyclic epic dependency in executor topology: ${epicId}`);
    visiting.add(epicId);
    for (const dependencyId of byId.get(epicId)?.depends_on ?? []) visit(dependencyId);
    visiting.delete(epicId);
    visited.add(epicId);
  };
  for (const epic of epics) visit(epic.id);
}
