import type { ExecutionSpecSnapshot } from './execution-spec-snapshot.js';

export type ExecutePlanCheckFindingCode =
  | 'empty_snapshot'
  | 'requirement_without_criterion'
  | 'criterion_without_requirement'
  | 'unprojected_dependency';

export type ExecutePlanCheckSeverity = 'error' | 'warning';

export interface ExecutePlanCheckFinding {
  readonly code: ExecutePlanCheckFindingCode;
  readonly severity: ExecutePlanCheckSeverity;
  readonly itemId?: string;
  readonly message: string;
}

export interface ExecutePlanCheckResult {
  readonly status: 'ok' | 'blocked';
  readonly counts: {
    readonly requirements: number;
    readonly criteria: number;
    readonly verifiedRequirements: number;
    readonly criteriaWithRequirement: number;
  };
  readonly findings: readonly ExecutePlanCheckFinding[];
  readonly sideEffects: readonly [];
}

export function checkExecutionSpecForPlan(snapshot: ExecutionSpecSnapshot): ExecutePlanCheckResult {
  const findings: ExecutePlanCheckFinding[] = [];
  const requirementIds = new Set(snapshot.requirements.map((requirement) => requirement.itemId));
  const verifiedRequirementIds = new Set<string>();
  let criteriaWithRequirement = 0;

  if (snapshot.requirements.length === 0) {
    findings.push({
      code: 'empty_snapshot',
      severity: 'error',
      message: 'Execution snapshot has no requirements to plan from.',
    });
  }

  for (const criterion of snapshot.criteria) {
    const verifies = criterion.verifies.filter((requirementId) => requirementIds.has(requirementId));
    if (verifies.length === 0) {
      findings.push({
        code: 'criterion_without_requirement',
        severity: 'warning',
        itemId: criterion.itemId,
        message: `Criterion ${criterion.itemId} does not verify any projected requirement.`,
      });
      continue;
    }
    criteriaWithRequirement += 1;
    for (const requirementId of verifies) verifiedRequirementIds.add(requirementId);
  }

  for (const requirement of snapshot.requirements) {
    if (verifiedRequirementIds.has(requirement.itemId)) continue;
    findings.push({
      code: 'requirement_without_criterion',
      severity: 'warning',
      itemId: requirement.itemId,
      message: `Requirement ${requirement.itemId} has no verifying criterion in the execution snapshot.`,
    });
  }

  for (const dependency of snapshot.unprojectedDependencies ?? []) {
    findings.push({
      code: 'unprojected_dependency',
      severity: 'error',
      itemId: dependency.dependentId,
      message: `Dependency ${dependency.dependencyId} -> ${dependency.dependentId} cannot be represented in the executable plan as a slice dependency.`,
    });
  }

  return {
    status: findings.some((finding) => finding.severity === 'error') ? 'blocked' : 'ok',
    counts: {
      requirements: snapshot.requirements.length,
      criteria: snapshot.criteria.length,
      verifiedRequirements: verifiedRequirementIds.size,
      criteriaWithRequirement,
    },
    findings,
    sideEffects: [],
  };
}
