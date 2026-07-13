import type {
  ExecutionSpecCriterionSnapshot,
  ExecutionSpecItemSnapshot,
  ExecutionSpecSnapshot,
} from './execution-spec-snapshot.js';

export interface ExecutionPlanOutlineCriterion {
  readonly criterionId: string;
  readonly title: string;
  readonly content: string;
  readonly verifies?: readonly string[];
}

export interface ExecutionPlanOutlineTask {
  readonly id: string;
  readonly title: string;
  readonly requirementId: string;
  readonly scopeId?: string;
  readonly requirementIds?: readonly string[];
  readonly requirements?: readonly ExecutionSpecItemSnapshot[];
  readonly summary: string;
  readonly dependsOn: readonly string[];
  readonly acceptanceCriterionIds: readonly string[];
  readonly acceptanceCriteria: readonly ExecutionPlanOutlineCriterion[];
  readonly designContext?: readonly ExecutionSpecItemSnapshot[];
  readonly verificationContext?: readonly ExecutionSpecItemSnapshot[];
}

export interface ExecutionPlanOutlineFrontier {
  readonly id: string;
  readonly title: string;
  readonly dependsOn: readonly string[];
  readonly verification: readonly ExecutionPlanOutlineCriterion[];
  readonly tasks: readonly ExecutionPlanOutlineTask[];
}

export interface ExecutionPlanOutline {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionSpecSnapshot['mode'];
  readonly frontiers: readonly ExecutionPlanOutlineFrontier[];
  readonly orphanTasks: readonly ExecutionPlanOutlineTask[];
  readonly sideEffects: readonly [];
}

export function outlineExecutionPlan(snapshot: ExecutionSpecSnapshot): ExecutionPlanOutline {
  if (snapshot.scopes.length > 0) {
    return {
      schemaVersion: 1,
      specId: snapshot.specId,
      mode: snapshot.mode,
      frontiers: assignTaskIds(frontiersForScopes(snapshot)),
      orphanTasks: [],
      sideEffects: [],
    };
  }

  const tasks = new Map(
    snapshot.requirements.map((requirement, index) => [
      requirement.itemId,
      taskForRequirement(snapshot, requirement, index),
    ]),
  );
  return {
    schemaVersion: 1,
    specId: snapshot.specId,
    mode: snapshot.mode,
    frontiers: snapshot.frontiers.map((frontier) => ({
      id: frontier.itemId,
      title: frontier.title,
      dependsOn: frontier.dependsOn,
      verification: frontier.verificationCriterionIds.flatMap((criterionId) => {
        const criterion = snapshot.criteria.find((candidate) => candidate.itemId === criterionId);
        return criterion ? [outlineCriterion(criterion)] : [];
      }),
      tasks: frontier.requirementIds.flatMap((requirementId) => {
        const task = tasks.get(requirementId);
        return task ? [task] : [];
      }),
    })),
    orphanTasks: snapshot.requirements.flatMap((requirement) => {
      if (requirement.frontierId) return [];
      const task = tasks.get(requirement.itemId);
      return task ? [task] : [];
    }),
    sideEffects: [],
  };
}

function assignTaskIds(
  frontiers: readonly ExecutionPlanOutlineFrontier[],
): readonly ExecutionPlanOutlineFrontier[] {
  let nextTaskNumber = 1;

  return frontiers.map((frontier) => ({
    ...frontier,
    tasks: frontier.tasks.map((task) => ({
      ...task,
      id: `task-${nextTaskNumber++}`,
    })),
  }));
}

function frontiersForScopes(snapshot: ExecutionSpecSnapshot): readonly ExecutionPlanOutlineFrontier[] {
  const frontierById = new Map(snapshot.frontiers.map((frontier) => [frontier.itemId, frontier]));
  const requirementsById = new Map(
    snapshot.requirements.map((requirement) => [requirement.itemId, requirement]),
  );
  const scopesByFrontier = new Map<string, typeof snapshot.scopes>();
  const claimedRequirementIds = new Set<string>();

  for (const scope of snapshot.scopes) {
    if (scope.requirementIds.length === 0 || scope.frontierIds.length !== 1) continue;
    const requirementIds = scope.requirementIds.filter((requirementId) => {
      if (claimedRequirementIds.has(requirementId)) return false;
      claimedRequirementIds.add(requirementId);
      return true;
    });

    if (requirementIds.length === 0) continue;
    const frontierId = scope.frontierIds[0]!;
    const scopes = scopesByFrontier.get(frontierId) ?? [];
    scopesByFrontier.set(frontierId, [...scopes, { ...scope, requirementIds }]);
  }

  return [...scopesByFrontier.entries()].map(([frontierId, scopes]) => {
    const frontier = frontierById.get(frontierId);
    return {
      id: frontierId,
      title: frontier?.title ?? 'Execution handoff',
      dependsOn: frontier?.dependsOn ?? [],
      verification: (frontier?.verificationCriterionIds ?? []).flatMap((criterionId) => {
        const criterion = snapshot.criteria.find((candidate) => candidate.itemId === criterionId);
        return criterion ? [outlineCriterion(criterion)] : [];
      }),
      tasks: scopes.flatMap((scope, index) => tasksForScope(scope, requirementsById, index)),
    };
  });
}

function tasksForScope(
  scope: ExecutionSpecSnapshot['scopes'][number],
  requirementsById: ReadonlyMap<string, ExecutionSpecItemSnapshot>,
  scopeIndex: number,
): readonly ExecutionPlanOutlineTask[] {
  const requirements = scope.requirementIds.flatMap((requirementId) => {
    const requirement = requirementsById.get(requirementId);
    return requirement ? [requirement] : [];
  });
  if (requirements.length <= 1) {
    return [
      {
        id: `task-${scopeIndex + 1}`,
        title: scope.title,
        scopeId: scope.itemId,
        requirementId: requirements[0]?.itemId ?? scope.itemId,
        ...(scope.requirementIds.length > 0 ? { requirementIds: scope.requirementIds } : {}),
        ...(requirements.length > 0 ? { requirements } : {}),
        summary: scope.content,
        dependsOn: [
          ...new Set(
            scope.requirementIds.flatMap((requirementId) =>
              (requirementsById.get(requirementId)?.dependsOn ?? []).filter(
                (dependencyId) => !scope.requirementIds.includes(dependencyId),
              ),
            ),
          ),
        ],
        acceptanceCriterionIds: scope.criteria.map((criterion) => criterion.itemId),
        acceptanceCriteria: scope.criteria.map(outlineCriterion),
        designContext: scope.design,
        verificationContext: scope.verification,
      },
    ];
  }

  return requirements.map((requirement, requirementIndex) => {
    const acceptanceCriteria = scope.criteria
      .filter(
        (criterion) =>
          criterion.scopeLinked === true ||
          criterion.verifiesRequirements.length === 0 ||
          criterion.verifiesRequirements.includes(requirement.itemId),
      )
      .map(outlineCriterion);
    return {
      id: `task-${scopeIndex + requirementIndex + 1}`,
      title: requirement.title,
      scopeId: scope.itemId,
      requirementId: requirement.itemId,
      requirementIds: [requirement.itemId],
      requirements: [requirement],
      summary: requirement.content,
      dependsOn: requirement.dependsOn,
      acceptanceCriterionIds: acceptanceCriteria.map((criterion) => criterion.criterionId),
      acceptanceCriteria,
      designContext: scope.design,
      verificationContext: scope.verification,
    };
  });
}

function taskForRequirement(
  snapshot: ExecutionSpecSnapshot,
  requirement: ExecutionSpecItemSnapshot,
  index: number,
): ExecutionPlanOutlineTask {
  const acceptanceCriteria = snapshot.criteria
    .filter((criterion) => criterion.verifiesRequirements.includes(requirement.itemId))
    .map(outlineCriterion);
  return {
    id: `task-${index + 1}`,
    title: requirement.title,
    requirementId: requirement.itemId,
    requirements: [requirement],
    summary: requirement.content,
    dependsOn: requirement.dependsOn,
    acceptanceCriterionIds: acceptanceCriteria.map((criterion) => criterion.criterionId),
    acceptanceCriteria,
  };
}

function outlineCriterion(criterion: ExecutionSpecCriterionSnapshot): ExecutionPlanOutlineCriterion {
  return {
    criterionId: criterion.itemId,
    title: criterion.title,
    content: criterion.content,
    ...(criterion.verifiesRequirements.length > 0 ? { verifies: criterion.verifiesRequirements } : {}),
  };
}
