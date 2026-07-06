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
  readonly summary: string;
  readonly acceptanceCriterionIds: readonly string[];
  readonly acceptanceCriteria: readonly ExecutionPlanOutlineCriterion[];
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
    frontiers: snapshot.requirements.length === 0 ? [] : [frontierForRequirements(snapshot)],
    sideEffects: [],
  };
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
