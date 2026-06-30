import type { ExecutionSpecItemSnapshot, ExecutionSpecSnapshot } from './execution-spec-snapshot.js';

export interface ExecutionPlanOutlineTask {
  readonly id: string;
  readonly title: string;
  readonly requirementId: string;
  readonly summary: string;
  readonly acceptanceCriterionIds: readonly string[];
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
  const acceptanceCriterionIds = snapshot.criteria
    .filter((criterion) => criterion.verifies.includes(requirement.itemId))
    .map((criterion) => criterion.itemId);
  return {
    id: `task-${index + 1}`,
    title: requirement.title,
    requirementId: requirement.itemId,
    summary: requirement.content,
    acceptanceCriterionIds,
  };
}
