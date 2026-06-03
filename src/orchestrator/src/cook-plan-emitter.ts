// FE-800 slice 4: end-to-end composition.
//
// Glue function that walks one `CompletedSpecSnapshot` through all
// three FE-800 stages — deterministic projection (slice 1), LLM
// planning (slice 2), deterministic reconciliation (slice 3) — and
// returns the cook-runnable Plan plus every warning surfaced along
// the way. Pure modulo the injected `runModel`; defaults to the
// production anthropic seam (`defaultRunModel`) but tests pass a stub.
//
// On LLM failure the planning result is preserved as
// `{ status: 'failed', reason }` AND we still call reconciliation with
// an empty enrichment so the caller can emit a usable plan with no
// inferred ordering, rather than failing the whole emit.

import {
  defaultRunModel,
  planExecutionOrdering,
  type PlanningEnrichment,
  type PlanningResult,
  type RunModel,
} from './cook-plan-llm-planning.js';
import { projectCookPlanFromSpec, type CompletedSpecSnapshot } from './cook-plan-projection.js';
import { reconcileCookPlan, type ReconciliationWarning } from './cook-plan-reconciliation.js';
import type { Plan } from './types.js';

const EMPTY_ENRICHMENT: PlanningEnrichment = {
  sliceDependencies: [],
  epics: [],
  nonBuildableSliceIds: [],
};

export type EmitCookPlanResult = {
  plan: Plan;
  warnings: ReconciliationWarning[];
  planningResult: PlanningResult;
};

export type EmitCookPlanOptions = {
  /**
   * LLM seam used by the planning stage. Defaults to the production
   * anthropic adapter (`defaultRunModel`). Tests inject a stub.
   */
  runModel?: RunModel;
};

export async function emitCookPlanFromSnapshot(
  snapshot: CompletedSpecSnapshot,
  options: EmitCookPlanOptions = {},
): Promise<EmitCookPlanResult> {
  const runModel = options.runModel ?? defaultRunModel;

  const projected = projectCookPlanFromSpec(snapshot);
  const planningResult = await planExecutionOrdering(projected, runModel);
  const enrichment = planningResult.status === 'succeeded' ? planningResult.enrichment : EMPTY_ENRICHMENT;
  const { plan, warnings } = reconcileCookPlan(projected, enrichment);

  return { plan, warnings, planningResult };
}
