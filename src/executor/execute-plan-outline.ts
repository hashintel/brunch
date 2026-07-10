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
  readonly tasks: readonly ExecutionPlanOutlineTask[];
}

export interface ExecutionPlanOutline {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionSpecSnapshot['mode'];
  readonly frontiers: readonly ExecutionPlanOutlineFrontier[];
  readonly sideEffects: readonly [];
}

export function outlineExecutionPlan(snapshot: ExecutionSpecSnapshot): ExecutionPlanOutline {
  const scopeFrontiers = frontiersForScopes(snapshot);
  const unscopedRequirementIds = new Set(snapshot.scopes.flatMap((scope) => scope.requirementIds));
  const orphanRequirements = snapshot.requirements.filter(
    (requirement) => !unscopedRequirementIds.has(requirement.itemId),
  );

  return {
    schemaVersion: 1,
    specId: snapshot.specId,
    mode: snapshot.mode,
    frontiers: assignTaskIds(
      snapshot.scopes.length > 0
        ? [
            ...scopeFrontiers,
            ...(orphanRequirements.length > 0 ? [frontierForRequirements(snapshot, orphanRequirements)] : []),
          ]
        : snapshot.requirements.length === 0
          ? []
          : [frontierForRequirements(snapshot, snapshot.requirements)],
    ),
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
  const frontierTitleById = new Map(snapshot.frontiers.map((frontier) => [frontier.itemId, frontier.title]));
  const requirementsById = new Map(
    snapshot.requirements.map((requirement) => [requirement.itemId, requirement]),
  );
  const scopesByFrontier = new Map<string, typeof snapshot.scopes>();

  for (const scope of snapshot.scopes) {
    if (scope.requirementIds.length === 0) continue;
    const frontierId = scope.frontierIds[0] ?? snapshot.frontiers[0]?.itemId ?? 'frontier-1';
    const scopes = scopesByFrontier.get(frontierId) ?? [];
    scopesByFrontier.set(frontierId, [...scopes, scope]);
  }

  return [...scopesByFrontier.entries()].map(([frontierId, scopes]) => ({
    id: frontierId,
    title: frontierTitleById.get(frontierId) ?? 'Execution handoff',
    tasks: scopes.map((scope, index) => ({
      ...(() => {
        const requirements = scope.requirementIds.flatMap((requirementId) => {
          const requirement = requirementsById.get(requirementId);
          return requirement ? [requirement] : [];
        });
        return {
          id: `task-${index + 1}`,
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
        };
      })(),
    })),
  }));
}

function frontierForRequirements(
  snapshot: ExecutionSpecSnapshot,
  requirements: readonly ExecutionSpecItemSnapshot[],
): ExecutionPlanOutlineFrontier {
  return {
    id: snapshot.scopes.length > 0 ? 'frontier-unscoped-requirements' : 'frontier-1',
    title:
      snapshot.scopes.length > 0 ? 'Implement unscoped requirements' : 'Implement projected requirements',
    tasks: requirements.map((requirement, index) => taskForRequirement(snapshot, requirement, index)),
  };
}

function taskForRequirement(
  snapshot: ExecutionSpecSnapshot,
  requirement: ExecutionSpecItemSnapshot,
  index: number,
): ExecutionPlanOutlineTask {
  const acceptanceCriteria = snapshot.criteria
    .filter((criterion) => criterion.verifies.includes(requirement.itemId))
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
    ...(criterion.verifies.length > 0 ? { verifies: criterion.verifies } : {}),
  };
}
