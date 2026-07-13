import type { ExecutionPlanOutline } from './execute-plan-outline.js';

export interface ExecutablePlanDraftVerificationTarget {
  readonly kind: 'criterion';
  readonly target: string;
  readonly criterionId: string;
  readonly verifies?: readonly string[];
}

export interface ExecutablePlanDraftRequirement {
  readonly itemId: string;
  readonly title: string;
  readonly content: string;
}

export interface ExecutablePlanDraftSlice {
  readonly id: string;
  readonly epicId: string;
  readonly title: string;
  readonly definition: string;
  readonly scopeId?: string;
  readonly requirementId: string;
  readonly requirementIds: readonly string[];
  readonly requirements?: readonly ExecutablePlanDraftRequirement[];
  readonly dependsOn: readonly string[];
  readonly designContext: readonly {
    readonly itemId: string;
    readonly title: string;
    readonly content: string;
  }[];
  readonly verificationContext: readonly {
    readonly itemId: string;
    readonly title: string;
    readonly content: string;
  }[];
  readonly verification: readonly ExecutablePlanDraftVerificationTarget[];
}

export interface ExecutablePlanDraftEpic {
  readonly id: string;
  readonly title: string;
  readonly sliceIds: readonly string[];
  readonly dependsOn: readonly string[];
}

export interface ExecutablePlanDraft {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionPlanOutline['mode'];
  readonly epics: readonly ExecutablePlanDraftEpic[];
  readonly slices: readonly ExecutablePlanDraftSlice[];
  readonly sideEffects: readonly [];
}

export function draftExecutablePlan(outline: ExecutionPlanOutline): ExecutablePlanDraft {
  const taskIdByRequirement = new Map<string, string>();
  for (const task of outline.frontiers.flatMap((frontier) => frontier.tasks)) {
    const requirementIds =
      task.requirementIds && task.requirementIds.length > 0 ? task.requirementIds : [task.requirementId];
    for (const requirementId of requirementIds) {
      const existingTaskId = taskIdByRequirement.get(requirementId);
      // Plan-check owns ambiguous scope membership. Keep this projection total so
      // callers can inspect the blocked result instead of crashing while building it.
      if (!existingTaskId) taskIdByRequirement.set(requirementId, task.id);
    }
  }
  const slices = outline.frontiers.flatMap((frontier) => {
    return frontier.tasks.map((task) => {
      const requirementIds =
        task.requirementIds && task.requirementIds.length > 0 ? task.requirementIds : [task.requirementId];
      return {
        id: task.id,
        epicId: frontier.id,
        title: task.title,
        definition: task.summary,
        ...(task.scopeId ? { scopeId: task.scopeId } : {}),
        requirementId: task.requirementId,
        requirementIds,
        ...(task.requirements && task.requirements.length > 0
          ? {
              requirements: task.requirements.map((requirement) => ({
                itemId: requirement.itemId,
                title: requirement.title,
                content: requirement.content,
              })),
            }
          : {}),
        dependsOn: [
          ...new Set(
            task.dependsOn.flatMap((requirementId) => {
              const dependencyTaskId = taskIdByRequirement.get(requirementId);
              return dependencyTaskId === undefined || dependencyTaskId === task.id ? [] : [dependencyTaskId];
            }),
          ),
        ],
        designContext: (task.designContext ?? []).map((item) => ({
          itemId: item.itemId,
          title: item.title,
          content: item.content,
        })),
        verificationContext: (task.verificationContext ?? []).map((item) => ({
          itemId: item.itemId,
          title: item.title,
          content: item.content,
        })),
        verification: task.acceptanceCriteria.map((criterion) => ({
          kind: 'criterion' as const,
          criterionId: criterion.criterionId,
          target: criterion.content,
          ...(criterion.verifies && criterion.verifies.length > 0 ? { verifies: criterion.verifies } : {}),
        })),
      };
    });
  });

  const orderedSlices = orderSlicesByDependencies(slices);
  const epics = outline.frontiers.map((frontier) => ({
    id: frontier.id,
    title: frontier.title,
    sliceIds: orderedSlices.filter((slice) => slice.epicId === frontier.id).map((slice) => slice.id),
    dependsOn: [],
  }));

  return {
    schemaVersion: 1,
    specId: outline.specId,
    mode: outline.mode,
    epics,
    slices: orderedSlices,
    sideEffects: [],
  };
}

function orderSlicesByDependencies(
  slices: readonly ExecutablePlanDraftSlice[],
): readonly ExecutablePlanDraftSlice[] {
  const sliceIds = new Set(slices.map((slice) => slice.id));
  const completed = new Set<string>();
  const remaining = [...slices];
  const ordered: ExecutablePlanDraftSlice[] = [];

  // ceiling: O(n²) stable topological sort; index dependencies if plans grow beyond a few hundred slices.
  while (remaining.length > 0) {
    const nextIndex = remaining.findIndex((slice) =>
      slice.dependsOn.every((dependencyId) => !sliceIds.has(dependencyId) || completed.has(dependencyId)),
    );
    if (nextIndex === -1) return [...ordered, ...remaining];

    const [next] = remaining.splice(nextIndex, 1);
    if (!next) continue;
    ordered.push(next);
    completed.add(next.id);
  }

  return ordered;
}
