// FE-800 slices 4-5 + FE-829 slice 4B: end-to-end plan emission.
//
// Walks one `CompletedSpecSnapshot` through:
//   1. deterministic projection (the requirement universe + criteria),
//   2. the build-architect AUTHORING LLM call (`architectPlan`) — decomposes
//      requirements into file-disjoint scaffold/behaviour/join slices with
//      `writes` + `derivedFrom`,
//   3. deterministic materialization (`materializeArchitectedPlan`) +
//      contract repair (`repairPlan`),
//   4. a generalized executability + coverage gate (`checkPlan`, `emitted`
//      profile).
//
// If authoring fails (thrown/parse) OR the authored plan is unusable after
// repair (e.g. a requirement is left uncovered), the emitter FALLS BACK to a
// purely deterministic plan: `reconcilePlan(projected, ∅)` + `repairPlan`.
// The fallback never makes a second LLM call, so callers always receive a
// usable, contract-satisfying plan plus one audit-ready warning stream.

import {
  architectPlan,
  defaultArchitectRunModel,
  type ArchitectResult,
  type RunModel,
} from './plan-architect.js';
import { checkPlan, repairPlan, type ContractResult } from './plan-contract.js';
import { type PlanningEnrichment } from './plan-llm-planning.js';
import { materializeArchitectedPlan, type MaterializeWarning } from './plan-materialize.js';
import { projectPlanningContext } from './plan-planning-context.js';
import { projectPlanFromSpec, type CompletedSpecSnapshot } from './plan-projection.js';
import {
  formatReconciliationWarning,
  reconcilePlan,
  reconciliationWarningCategory,
  type ReconciliationWarning,
} from './plan-reconciliation.js';
import { resolveToolchain, type Toolchain } from './project-profile.js';
import type { Plan } from './types.js';

const EMPTY_ENRICHMENT: PlanningEnrichment = {
  sliceDependencies: [],
  epics: [],
  nonBuildableSliceIds: [],
};

/**
 * Single warning union for the emitter. Widens `ReconciliationWarning` and
 * the materializer's warnings with the emitter-level seam + fallback codes,
 * so a caller iterating `warnings` sees one stream.
 */
export type EmitterWarning =
  | ReconciliationWarning
  | { code: 'synthesized-integration-seam'; epicId: string; target: string }
  | { code: 'dropped-unknown-requirement-ref'; sliceId: string; requirementId: string }
  | { code: 'file-write-conflict'; severity: 'warning'; path: string; sliceIds: string[] }
  | { code: 'architect-failed-fallback-to-projection'; reason: string };

export type EmitPlanResult = {
  plan: Plan;
  warnings: EmitterWarning[];
  /** Raw architect-stage status for callers that want the un-collapsed result. */
  architectResult: ArchitectResult;
};

export type EmitPlanOptions = {
  /**
   * LLM seam for the architect stage. Defaults to the production anthropic
   * adapter (`defaultArchitectRunModel`). Tests inject a stub.
   */
  runModel?: RunModel;
  /**
   * Toolchain descriptor that shapes verification targets. Defaults to the
   * one resolved from the spec's `profile` (`resolveToolchain`).
   */
  toolchain?: Toolchain;
};

export async function emitPlanFromSnapshot(
  snapshot: CompletedSpecSnapshot,
  options: EmitPlanOptions = {},
): Promise<EmitPlanResult> {
  const runModel = options.runModel ?? defaultArchitectRunModel;

  const projected = projectPlanFromSpec(snapshot);
  const planningContext = projectPlanningContext(snapshot);
  const toolchain = options.toolchain ?? resolveToolchain(projected.profile);

  const architectResult = await architectPlan(projected, runModel, planningContext);

  if (architectResult.status === 'failed') {
    return fallback(projected, toolchain, architectResult, architectResult.reason);
  }

  const {
    plan: materialized,
    coverage,
    warnings: materializeWarnings,
  } = materializeArchitectedPlan(projected, architectResult.draft, toolchain);
  const { plan: repaired, repairs } = repairPlan(materialized, toolchain);
  const check = checkPlan(repaired, {
    profile: 'emitted',
    requirementIds: coverage.requirementIds,
    coveredRequirementIds: coverage.coveredRequirementIds,
    nonBuildableRequirementIds: coverage.nonBuildableRequirementIds,
  });

  if (!check.ok) {
    return fallback(projected, toolchain, architectResult, describeCheckFailure(check));
  }

  // Surface design-class contract warnings (e.g. a file-write-conflict) so an
  // authored plan never ships an unresolved file-ownership clash silently.
  const warnings: EmitterWarning[] = [...materializeWarnings, ...repairs];
  for (const finding of check.findings) {
    if (finding.code === 'file-write-conflict') {
      warnings.push({
        code: 'file-write-conflict',
        severity: 'warning',
        path: finding.path,
        sliceIds: finding.sliceIds,
      });
    }
  }
  return { plan: repaired, warnings, architectResult };
}

/**
 * Deterministic fallback: reconcile the projected plan against an empty
 * enrichment, then repair. No LLM call. Used when the architect throws,
 * returns malformed output, or produces a plan that fails the contract.
 */
function fallback(
  projected: Plan,
  toolchain: Toolchain,
  architectResult: ArchitectResult,
  reason: string,
): EmitPlanResult {
  const { plan: candidate, warnings: reconciliationWarnings } = reconcilePlan(
    projected,
    EMPTY_ENRICHMENT,
    toolchain,
  );
  const { plan, repairs } = repairPlan(candidate, toolchain);
  const warnings: EmitterWarning[] = [
    { code: 'architect-failed-fallback-to-projection', reason },
    ...reconciliationWarnings,
    ...repairs,
  ];
  return { plan, warnings, architectResult };
}

function describeCheckFailure(check: ContractResult): string {
  const errors = check.findings.filter((finding) => finding.severity === 'error');
  const codes = [...new Set(errors.map((finding) => finding.code))].join(', ');
  return `authored plan failed the executability contract: ${codes}`;
}

/**
 * Audit-weight classification for an `EmitterWarning`. Adds `'failure'`
 * for the architect fallback; delegates reconciliation/materializer codes.
 * Exhaustive — a new emitter-level warning forces an update here.
 */
export function emitterWarningCategory(warning: EmitterWarning): 'transformation' | 'synthesis' | 'failure' {
  if (warning.code === 'architect-failed-fallback-to-projection') return 'failure';
  if (warning.code === 'synthesized-integration-seam') return 'synthesis';
  if (warning.code === 'dropped-unknown-requirement-ref' || warning.code === 'file-write-conflict') {
    return 'transformation';
  }
  return reconciliationWarningCategory(warning);
}

/**
 * Render an `EmitterWarning` as one human-readable line. Delegates to
 * `formatReconciliationWarning` for reconciliation codes.
 */
export function formatEmitterWarning(warning: EmitterWarning): string {
  if (warning.code === 'architect-failed-fallback-to-projection') {
    return `architect-failed-fallback-to-projection  ${warning.reason}`;
  }
  if (warning.code === 'synthesized-integration-seam') {
    return `synthesized-integration-seam  ${warning.epicId} → ${warning.target}`;
  }
  if (warning.code === 'dropped-unknown-requirement-ref') {
    return `dropped-unknown-requirement-ref  ${warning.sliceId} → ${warning.requirementId}`;
  }
  if (warning.code === 'file-write-conflict') {
    return `file-write-conflict  ${warning.path} ← ${warning.sliceIds.join(', ')}`;
  }
  return formatReconciliationWarning(warning);
}

export type { MaterializeWarning };
