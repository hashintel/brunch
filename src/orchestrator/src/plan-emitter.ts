// FE-800 slice 4: end-to-end composition.
// FE-800 slice 5: single warning stream (`EmitterWarning` widens
// `ReconciliationWarning` with `planning-failed` so callers have one
// audit-ready source instead of forking on `planningResult.status`).
//
// Glue function that walks one `CompletedSpecSnapshot` through all
// three FE-800 stages — deterministic projection (slice 1), LLM
// planning (slice 2), deterministic reconciliation (slice 3) — and
// returns the cook-runnable Plan plus every warning surfaced along
// the way. Pure modulo the injected `runModel`; defaults to the
// production anthropic seam (`defaultRunModel`) but tests pass a stub.
//
// On LLM failure the planning result is preserved as
// `{ status: 'failed', reason }` for callers that want the raw stage
// status, AND a `{ code: 'planning-failed', reason }` warning is
// pushed onto `warnings` so iterating one stream is sufficient.
// Reconciliation still runs against an empty enrichment so the caller
// receives a usable orderless plan rather than no plan at all.

import { repairPlan } from './plan-contract.js';
import {
  defaultRunModel,
  planExecutionOrdering,
  type PlanningEnrichment,
  type PlanningResult,
  type RunModel,
} from './plan-llm-planning.js';
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
 * Single warning union for the emitter. Widens `ReconciliationWarning`
 * with `planning-failed` so a caller iterating `warnings` sees both
 * reconciliation transformations and LLM-stage failures in one stream.
 */
export type EmitterWarning =
  | ReconciliationWarning
  | { code: 'synthesized-integration-seam'; epicId: string; target: string }
  | { code: 'planning-failed'; reason: string };

export type EmitPlanResult = {
  plan: Plan;
  warnings: EmitterWarning[];
  planningResult: PlanningResult;
};

export type EmitPlanOptions = {
  /**
   * LLM seam used by the planning stage. Defaults to the production
   * anthropic adapter (`defaultRunModel`). Tests inject a stub.
   */
  runModel?: RunModel;
  /**
   * Toolchain descriptor that shapes verification targets. Defaults to the
   * one resolved from the spec's `profile` (`resolveToolchain`). Threaded
   * through reconciliation and the contract repair so synthesized targets
   * are derived, not hardcoded.
   */
  toolchain?: Toolchain;
};

export async function emitPlanFromSnapshot(
  snapshot: CompletedSpecSnapshot,
  options: EmitPlanOptions = {},
): Promise<EmitPlanResult> {
  const runModel = options.runModel ?? defaultRunModel;

  const projected = projectPlanFromSpec(snapshot);
  const planningContext = projectPlanningContext(snapshot);
  const toolchain = options.toolchain ?? resolveToolchain(projected.profile);
  const planningResult = await planExecutionOrdering(projected, runModel, planningContext);
  const enrichment = planningResult.status === 'succeeded' ? planningResult.enrichment : EMPTY_ENRICHMENT;
  const { plan: candidate, warnings: reconciliationWarnings } = reconcilePlan(
    projected,
    enrichment,
    toolchain,
  );

  // Gate output on the executability contract: deterministic repair
  // synthesizes the per-epic integration seam reconciliation does not,
  // so every emitted plan satisfies the strict `emitted` profile.
  const { plan, repairs } = repairPlan(candidate, toolchain);

  const warnings: EmitterWarning[] = [];
  if (planningResult.status === 'failed') {
    warnings.push({ code: 'planning-failed', reason: planningResult.reason });
  }
  warnings.push(...reconciliationWarnings);
  warnings.push(...repairs);

  return { plan, warnings, planningResult };
}

/**
 * Audit-weight classification for an `EmitterWarning`. Mirrors
 * `reconciliationWarningCategory` and adds `'failure'` for
 * `planning-failed`. Exhaustive — adding a new emitter-level warning
 * forces an update here.
 */
export function emitterWarningCategory(warning: EmitterWarning): 'transformation' | 'synthesis' | 'failure' {
  if (warning.code === 'planning-failed') return 'failure';
  if (warning.code === 'synthesized-integration-seam') return 'synthesis';
  return reconciliationWarningCategory(warning);
}

/**
 * Render an `EmitterWarning` as one human-readable line. Delegates
 * to `formatReconciliationWarning` for reconciliation codes.
 */
export function formatEmitterWarning(warning: EmitterWarning): string {
  if (warning.code === 'planning-failed') {
    return `planning-failed  ${warning.reason}`;
  }
  if (warning.code === 'synthesized-integration-seam') {
    return `synthesized-integration-seam  ${warning.epicId} → ${warning.target}`;
  }
  return formatReconciliationWarning(warning);
}
