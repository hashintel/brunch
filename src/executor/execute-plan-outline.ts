import type {
  ExecutionSpecCriterionSnapshot,
  ExecutionSpecItemSnapshot,
  ExecutionSpecSnapshot,
} from './execution-spec-snapshot.js';

export interface ExecutionPlanOutlineCriterion {
  readonly criterionId: string;
  readonly title: string;
  readonly content: string;
}

export interface ExecutionPlanOutlineTask {
  readonly id: string;
  readonly title: string;
  readonly requirementId: string;
  readonly scopeId?: string;
  readonly requirementIds?: readonly string[];
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
  return {
    schemaVersion: 1,
    specId: snapshot.specId,
    mode: snapshot.mode,
    frontiers:
      snapshot.scopes.length > 0
        ? frontiersForScopes(snapshot)
        : snapshot.requirements.length === 0
          ? []
          : [frontierForRequirements(snapshot)],
    sideEffects: [],
  };
}

function frontiersForScopes(snapshot: ExecutionSpecSnapshot): readonly ExecutionPlanOutlineFrontier[] {
  const frontierTitleById = new Map(snapshot.frontiers.map((frontier) => [frontier.itemId, frontier.title]));
  const requirementsById = new Map(snapshot.requirements.map((requirement) => [requirement.itemId, requirement]));
  const scopesByFrontier = new Map<string, typeof snapshot.scopes>();

  for (const scope of snapshot.scopes) {
    const frontierIds = scope.frontierIds.length > 0 ? scope.frontierIds : ['frontier-1'];
    for (const frontierId of frontierIds) {
      const scopes = scopesByFrontier.get(frontierId) ?? [];
      scopesByFrontier.set(frontierId, [...scopes, scope]);
    }
  }

  return [...scopesByFrontier.entries()].map(([frontierId, scopes]) => ({
    id: frontierId,
    title: frontierTitleById.get(frontierId) ?? 'Execution handoff',
    tasks: scopes.map((scope, index) => ({
      id: `task-${index + 1}`,
      title: scope.title,
      scopeId: scope.itemId,
      requirementId: scope.requirementIds[0] ?? scope.itemId,
      requirementIds: scope.requirementIds,
      summary: scope.content,
      dependsOn: scope.requirementIds.flatMap((requirementId) =>
        requirementsById.get(requirementId)?.dependsOn ?? [],
      ),
      acceptanceCriterionIds: scope.criteria.map((criterion) => criterion.itemId),
      acceptanceCriteria: scope.criteria.map(outlineCriterion),
      designContext: scope.design,
      verificationContext: scope.verification,
    })),
  }));
}

function frontierForRequirements(snapshot: ExecutionSpecSnapshot): ExecutionPlanOutlineFrontier {
  return {
    id: 'frontier-1',
    title: 'Implement projected requirements',
    tasks: snapshot.requirements.map((requirement, index) =>
      taskForRequirement(snapshot, requirement, index),
    ),
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
  };
}
