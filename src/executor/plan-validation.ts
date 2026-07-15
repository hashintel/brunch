import type { CandidatePlan } from './candidate-plan.js';
import type { CapabilityProvider } from './capability-providers.js';
import { findDependencyCycleMembers } from './dependency-cycles.js';
import {
  deriveExecutionContract,
  type CapabilityRequirement,
  type ExecutionContract,
} from './execution-contract.js';
import type { PlanningProjection } from './planning-projection.js';

export type PlanValidationFindingCode =
  | 'malformed_candidate'
  | 'spec_id_mismatch'
  | 'duplicate_id'
  | 'epic_empty'
  | 'epic_dependency_unknown'
  | 'slice_epic_unknown'
  | 'slice_scope_missing'
  | 'slice_scope_unknown'
  | 'slice_without_requirement'
  | 'unknown_requirement'
  | 'unknown_criterion'
  | 'unknown_design_item'
  | 'unknown_verification_item'
  | 'unknown_commitment_source'
  | 'dependency_unknown'
  | 'dependency_cycle'
  | 'scope_requirement_uncovered'
  | 'criterion_dropped'
  | 'design_dropped'
  | 'verification_dropped'
  | 'zero_coverage'
  | 'capability_unsupported'
  | 'capability_conflict'
  | 'no_verification_capability';

export interface PlanValidationFinding {
  readonly code: PlanValidationFindingCode;
  readonly severity: 'error' | 'warning';
  readonly itemId?: string;
  readonly message: string;
}

export interface PlanValidationResult {
  readonly findings: readonly PlanValidationFinding[];
  readonly executionContract: ExecutionContract;
}

export function validateCandidatePlan(args: {
  readonly candidate: CandidatePlan;
  readonly projection: PlanningProjection;
  readonly detected: readonly CapabilityRequirement[];
  readonly providers: readonly CapabilityProvider[];
  readonly baseRequired?: readonly CapabilityRequirement[];
}): PlanValidationResult {
  const { candidate, projection } = args;
  const findings: PlanValidationFinding[] = [];
  const error = (code: PlanValidationFindingCode, message: string, itemId?: string) => {
    findings.push({ code, severity: 'error', ...(itemId ? { itemId } : {}), message });
  };

  if (candidate.specId !== projection.specId) {
    error(
      'spec_id_mismatch',
      `Candidate spec id ${candidate.specId} does not match planning projection ${projection.specId}.`,
    );
  }

  const epicIds = new Set<string>();
  for (const epic of candidate.epics) {
    if (epicIds.has(epic.id)) error('duplicate_id', `Epic id ${epic.id} is duplicated.`, epic.id);
    epicIds.add(epic.id);
  }
  const sliceIds = new Set<string>();
  for (const slice of candidate.slices) {
    if (sliceIds.has(slice.id) || epicIds.has(slice.id)) {
      error('duplicate_id', `Slice id ${slice.id} is duplicated.`, slice.id);
    }
    sliceIds.add(slice.id);
  }

  const requirementIds = new Set(projection.requirements.map((item) => item.itemId));
  const criterionIds = new Set(projection.criteria.map((item) => item.itemId));
  const scopeById = new Map(projection.scopes.map((scope) => [scope.itemId, scope]));
  const scopeDesignIds = new Set(
    projection.scopes.flatMap((scope) => scope.design.map((item) => item.itemId)),
  );
  const knownVerificationIds = new Set([
    ...projection.scopes.flatMap((scope) => scope.verification.map((item) => item.itemId)),
    ...projection.commitments.verification.map((item) => item.itemId),
  ]);
  const commitmentIds = new Set(
    [
      ...projection.commitments.constraints,
      ...projection.commitments.invariants,
      ...projection.commitments.decisions,
      ...projection.commitments.verification,
    ].map((item) => item.itemId),
  );

  for (const epic of candidate.epics) {
    if (!candidate.slices.some((slice) => slice.epicId === epic.id)) {
      error('epic_empty', `Epic ${epic.id} has no member slices.`, epic.id);
    }
    for (const dependency of epic.dependsOn) {
      if (!epicIds.has(dependency)) {
        error('epic_dependency_unknown', `Epic ${epic.id} depends on unknown epic ${dependency}.`, epic.id);
      }
    }
    for (const criterionId of epic.verificationCriterionIds) {
      if (!criterionIds.has(criterionId)) {
        error('unknown_criterion', `Epic ${epic.id} cites unknown criterion ${criterionId}.`, epic.id);
      }
    }
  }

  for (const slice of candidate.slices) {
    if (!epicIds.has(slice.epicId)) {
      error('slice_epic_unknown', `Slice ${slice.id} belongs to unknown epic ${slice.epicId}.`, slice.id);
    }
    if (projection.scopes.length > 0) {
      if (slice.scopeId === undefined) {
        error(
          'slice_scope_missing',
          `Slice ${slice.id} is not assigned to a committed scope while scopes exist.`,
          slice.id,
        );
      } else if (!scopeById.has(slice.scopeId)) {
        error('slice_scope_unknown', `Slice ${slice.id} cites unknown scope ${slice.scopeId}.`, slice.id);
      }
    }
    if (slice.requirementIds.length === 0) {
      error('slice_without_requirement', `Slice ${slice.id} covers no requirement.`, slice.id);
    }
    for (const requirementId of slice.requirementIds) {
      if (!requirementIds.has(requirementId)) {
        error(
          'unknown_requirement',
          `Slice ${slice.id} cites unknown requirement ${requirementId}.`,
          slice.id,
        );
      }
    }
    for (const criterionId of slice.criterionIds) {
      if (!criterionIds.has(criterionId)) {
        error('unknown_criterion', `Slice ${slice.id} cites unknown criterion ${criterionId}.`, slice.id);
      }
    }
    for (const designItemId of slice.designItemIds) {
      if (!scopeDesignIds.has(designItemId)) {
        error(
          'unknown_design_item',
          `Slice ${slice.id} cites unknown design item ${designItemId}.`,
          slice.id,
        );
      }
    }
    for (const verificationItemId of slice.verificationItemIds) {
      if (!knownVerificationIds.has(verificationItemId)) {
        error(
          'unknown_verification_item',
          `Slice ${slice.id} cites unknown verification item ${verificationItemId}.`,
          slice.id,
        );
      }
    }
    for (const dependency of slice.dependsOn) {
      if (!sliceIds.has(dependency)) {
        error('dependency_unknown', `Slice ${slice.id} depends on unknown slice ${dependency}.`, slice.id);
      }
    }
  }

  for (const cyclic of findDependencyCycleMembers(
    candidate.slices.map((slice) => slice.id),
    new Map(candidate.slices.map((slice) => [slice.id, slice.dependsOn])),
  )) {
    error('dependency_cycle', `Slice ${cyclic} participates in a dependency cycle.`, cyclic);
  }
  for (const cyclic of findDependencyCycleMembers(
    candidate.epics.map((epic) => epic.id),
    new Map(candidate.epics.map((epic) => [epic.id, epic.dependsOn])),
  )) {
    error('dependency_cycle', `Epic ${cyclic} participates in a dependency cycle.`, cyclic);
  }

  for (const scope of projection.scopes) {
    const memberSlices = candidate.slices.filter((slice) => slice.scopeId === scope.itemId);
    const coveredRequirements = new Set(memberSlices.flatMap((slice) => slice.requirementIds));
    for (const requirementId of scope.requirementIds) {
      if (!coveredRequirements.has(requirementId)) {
        error(
          'scope_requirement_uncovered',
          `Scope ${scope.itemId} requirement ${requirementId} is covered by no slice.`,
          requirementId,
        );
      }
    }
    const carriedCriteria = new Set(memberSlices.flatMap((slice) => slice.criterionIds));
    for (const criterion of scope.criteria) {
      if (!carriedCriteria.has(criterion.itemId)) {
        error(
          'criterion_dropped',
          `Scope ${scope.itemId} criterion ${criterion.itemId} is carried by no slice.`,
          criterion.itemId,
        );
      }
    }
    const carriedDesign = new Set(memberSlices.flatMap((slice) => slice.designItemIds));
    for (const item of scope.design) {
      if (!carriedDesign.has(item.itemId)) {
        error(
          'design_dropped',
          `Scope ${scope.itemId} design anchor ${item.itemId} is carried by no slice.`,
          item.itemId,
        );
      }
    }
    const carriedVerification = new Set(memberSlices.flatMap((slice) => slice.verificationItemIds));
    for (const item of scope.verification) {
      if (!carriedVerification.has(item.itemId)) {
        error(
          'verification_dropped',
          `Scope ${scope.itemId} verification anchor ${item.itemId} is carried by no slice.`,
          item.itemId,
        );
      }
    }
  }

  if (
    projection.requirements.length > 0 &&
    !candidate.slices.some((slice) => slice.requirementIds.some((id) => requirementIds.has(id)))
  ) {
    error('zero_coverage', 'Candidate covers no projected requirement.');
  }

  for (const capability of candidate.requiredCapabilities) {
    if (!commitmentIds.has(capability.sourceItemId)) {
      error(
        'unknown_commitment_source',
        `Capability ${capability.id} cites unknown commitment ${capability.sourceItemId}.`,
        capability.id,
      );
    }
  }

  const candidateRequired = candidate.requiredCapabilities.map((capability) => ({
    id: capability.id,
    source: { kind: 'elicited' as const, itemId: capability.sourceItemId },
  }));
  const baseRequired = args.baseRequired ?? [];
  const baseIds = new Set(baseRequired.map((requirement) => requirement.id));
  const executionContract = deriveExecutionContract({
    required: [...baseRequired, ...candidateRequired.filter((requirement) => !baseIds.has(requirement.id))],
    detected: args.detected,
    providers: args.providers,
  });
  for (const blocked of executionContract.blocked) {
    error(
      'capability_unsupported',
      blocked.message ??
        `Capability ${blocked.id} has no provider; declare execute.verify/build/setup on the settled Project execution harness V&V method, or drop the id.`,
      blocked.id,
    );
  }
  for (const conflict of executionContract.conflicts) {
    error('capability_conflict', conflict.message, conflict.requiredId);
  }
  if (
    executionContract.resolvedActions.verify.length === 0 &&
    executionContract.blocked.length === 0 &&
    executionContract.conflicts.length === 0
  ) {
    error('no_verification_capability', 'Candidate resolves no verification capability.');
  }

  return { findings, executionContract };
}
