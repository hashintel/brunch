import { assertExecutionSpecSnapshotVersion, type ExecutionSpecSnapshot } from './execution-spec-snapshot.js';

export type ExecutePlanCheckFindingCode =
  | 'empty_snapshot'
  | 'frontier_without_requirement'
  | 'requirement_without_criterion'
  | 'criterion_without_requirement'
  | 'scope_without_frontier'
  | 'scope_with_multiple_frontiers'
  | 'scope_without_definition'
  | 'scope_without_requirement'
  | 'scope_without_criterion'
  | 'scope_without_design'
  | 'scope_without_verification'
  | 'requirement_in_multiple_scopes'
  | 'scope_dependency_without_scope';

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
    readonly frontiers: number;
  };
  readonly findings: readonly ExecutePlanCheckFinding[];
  readonly sideEffects: readonly [];
}

export function checkExecutionSpecForPlan(snapshot: ExecutionSpecSnapshot): ExecutePlanCheckResult {
  assertExecutionSpecSnapshotVersion(snapshot);
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
    const verifies = criterion.verifiesRequirements.filter((requirementId) =>
      requirementIds.has(requirementId),
    );
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

  const frontierIdsWithScopes = new Set(snapshot.scopes.flatMap((scope) => scope.frontierIds));
  for (const frontier of snapshot.frontiers) {
    if (frontier.requirementIds.length > 0) continue;
    // D123-L scope specs compose frontier -> scope, not frontier -> requirement;
    // scope-owned frontiers get their membership through realization edges.
    if (frontierIdsWithScopes.has(frontier.itemId)) continue;
    findings.push({
      code: 'frontier_without_requirement',
      severity: 'error',
      itemId: frontier.itemId,
      message: `Frontier ${frontier.itemId} has no composed requirements.`,
    });
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

  const scopeByRequirement = new Map<string, string>();
  const requirementById = new Map(
    snapshot.requirements.map((requirement) => [requirement.itemId, requirement]),
  );
  for (const scope of snapshot.scopes) {
    if (scope.frontierIds.length === 0) {
      findings.push({
        code: 'scope_without_frontier',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} is not owned by a frontier.`,
      });
    } else if (scope.frontierIds.length > 1) {
      findings.push({
        code: 'scope_with_multiple_frontiers',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} has multiple owning frontiers.`,
      });
    }
    if (scope.content.trim().length === 0) {
      findings.push({
        code: 'scope_without_definition',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} has no execution definition.`,
      });
    }
    if (scope.requirementIds.length === 0) {
      findings.push({
        code: 'scope_without_requirement',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} has no requirement anchor.`,
      });
    }
    if (scope.criteria.length === 0) {
      findings.push({
        code: 'scope_without_criterion',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} has no executable acceptance criterion.`,
      });
    }
    if (scope.design.length === 0) {
      findings.push({
        code: 'scope_without_design',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} has no design anchor.`,
      });
    }
    if (scope.verification.length === 0) {
      findings.push({
        code: 'scope_without_verification',
        severity: 'error',
        itemId: scope.itemId,
        message: `Scope ${scope.itemId} has no verification machinery anchor.`,
      });
    }

    for (const requirementId of scope.requirementIds) {
      const existingScopeId = scopeByRequirement.get(requirementId);
      if (existingScopeId && existingScopeId !== scope.itemId) {
        findings.push({
          code: 'requirement_in_multiple_scopes',
          severity: 'error',
          itemId: requirementId,
          message: `Requirement ${requirementId} is packaged by both ${existingScopeId} and ${scope.itemId}.`,
        });
      } else {
        scopeByRequirement.set(requirementId, scope.itemId);
      }
    }
  }

  if (snapshot.scopes.length > 0) {
    for (const scope of snapshot.scopes) {
      for (const requirementId of scope.requirementIds) {
        for (const dependencyId of requirementById.get(requirementId)?.dependsOn ?? []) {
          if (scopeByRequirement.has(dependencyId)) continue;
          findings.push({
            code: 'scope_dependency_without_scope',
            severity: 'error',
            itemId: dependencyId,
            message: `Requirement ${requirementId} depends on ${dependencyId}, which is not assigned to an executable scope.`,
          });
        }
      }
    }
  }

  return {
    status: findings.some((finding) => finding.severity === 'error') ? 'blocked' : 'ok',
    counts: {
      requirements: snapshot.requirements.length,
      criteria: snapshot.criteria.length,
      verifiedRequirements: verifiedRequirementIds.size,
      criteriaWithRequirement,
      frontiers: snapshot.frontiers.length,
    },
    findings,
    sideEffects: [],
  };
}
