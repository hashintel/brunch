import {
  assertExecutionSpecSnapshotVersion,
  type ExecutionSpecCriterionSnapshot,
  type ExecutionSpecFrontierSnapshot,
  type ExecutionSpecItemSnapshot,
  type ExecutionSpecMode,
  type ExecutionSpecRequirementSnapshot,
  type ExecutionSpecScopeSnapshot,
  type ExecutionSpecSnapshot,
} from './execution-spec-snapshot.js';

export interface PlanningCommitments {
  readonly constraints: readonly ExecutionSpecItemSnapshot[];
  readonly invariants: readonly ExecutionSpecItemSnapshot[];
  readonly decisions: readonly ExecutionSpecItemSnapshot[];
  readonly verification: readonly ExecutionSpecItemSnapshot[];
  readonly executionHarnesses: readonly ExecutionSpecItemSnapshot[];
}

// The bounded scope-informed planning input (FE-1197): committed scopes plus the
// settled commitments that must shape execution. Examples and nodes not linked
// through a scope stay out — the planner receives relevance, not the whole graph.
export interface PlanningProjection {
  readonly schemaVersion: 1;
  readonly specId: string;
  readonly mode: ExecutionSpecMode;
  readonly requirements: readonly ExecutionSpecRequirementSnapshot[];
  readonly criteria: readonly ExecutionSpecCriterionSnapshot[];
  readonly frontiers: readonly ExecutionSpecFrontierSnapshot[];
  readonly scopes: readonly ExecutionSpecScopeSnapshot[];
  readonly commitments: PlanningCommitments;
}

export function projectPlanningInput(snapshot: ExecutionSpecSnapshot): PlanningProjection {
  assertExecutionSpecSnapshotVersion(snapshot);
  return {
    schemaVersion: 1,
    specId: snapshot.specId,
    mode: snapshot.mode,
    requirements: snapshot.requirements,
    criteria: snapshot.criteria,
    frontiers: snapshot.frontiers,
    scopes: snapshot.scopes,
    commitments: {
      constraints: snapshot.context.constraints,
      invariants: snapshot.context.invariants,
      decisions: snapshot.context.decisions,
      verification: snapshot.context.oracle,
      executionHarnesses: snapshot.context.executionHarnesses,
    },
  };
}
