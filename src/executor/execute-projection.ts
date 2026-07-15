import { draftExecutablePlan, type ExecutablePlanDraft } from './executable-plan-draft.js';
import { checkExecutionSpecForPlan, type ExecutePlanCheckResult } from './execute-plan-check.js';
import { outlineExecutionPlan, type ExecutionPlanOutline } from './execute-plan-outline.js';
import {
  deriveExecutionContract,
  type BlockedCapability,
  type CapabilityRequirement,
  type ExecutionContract,
} from './execution-contract.js';
import { extractSpecRecipe, type SpecRecipeExtraction } from './execution-recipe.js';
import {
  projectExecutionSpecSnapshot,
  type ExecutionSpecMode,
  type ExecutionSpecSnapshot,
  type ProjectExecutionSpecSnapshotInput,
} from './execution-spec-snapshot.js';
import { previewPlan, type PlanPreview } from './plan-preview.js';

export interface ExecuteGraphProjectionSource {
  readonly graphLsn: number;
  readonly visibility: 'active';
}

export interface ExecuteGraphProjection {
  readonly source: ExecuteGraphProjectionSource;
  readonly snapshot: ExecutionSpecSnapshot;
  readonly check: ExecutePlanCheckResult;
  readonly outline: ExecutionPlanOutline;
  readonly draft: ExecutablePlanDraft;
  readonly executionContract: ExecutionContract;
  readonly planPreview: PlanPreview;
}

export interface ProjectExecuteGraphInput extends Omit<ProjectExecutionSpecSnapshotInput, 'mode'> {
  readonly graphLsn: number;
  readonly mode?: ExecutionSpecMode;
  readonly detectedCapabilities?: readonly CapabilityRequirement[];
}

export function projectExecuteGraph(input: ProjectExecuteGraphInput): ExecuteGraphProjection {
  const snapshot = projectExecutionSpecSnapshot({
    specId: input.specId,
    mode: input.mode ?? 'greenfield',
    nodes: input.nodes,
    edges: input.edges,
  });
  const outline = outlineExecutionPlan(snapshot);
  const draft = draftExecutablePlan(outline);
  const detected = input.detectedCapabilities ?? [];
  const recipe = extractSpecRecipe({
    constraints: snapshot.context.constraints,
    invariants: snapshot.context.invariants,
    decisions: snapshot.context.decisions,
    verification: snapshot.context.oracle,
    executionHarnesses: snapshot.context.executionHarnesses,
  });
  const providers = recipe.provider ? [recipe.provider] : [];
  const required: readonly CapabilityRequirement[] = recipe.required;
  const executionContract = withRecipeIssues(
    deriveExecutionContract({ required, detected, providers }),
    recipe,
  );

  return {
    source: { graphLsn: input.graphLsn, visibility: 'active' },
    snapshot,
    check: checkExecutionSpecForPlan(snapshot),
    outline,
    draft,
    executionContract,
    planPreview: previewPlan(draft, { executionContract }),
  };
}

export function assertExecuteProjectionPlanReady(projection: ExecuteGraphProjection): void {
  if (projection.check.status === 'ok') return;

  const errors = projection.check.findings.filter((finding) => finding.severity === 'error');
  const summary =
    errors.length > 0 ? errors.map((finding) => finding.message).join('; ') : 'unknown plan-input error';
  throw new Error(`Execution plan projection is blocked: ${summary}`);
}

function withRecipeIssues(contract: ExecutionContract, recipe: SpecRecipeExtraction): ExecutionContract {
  if (recipe.issues.length === 0) return contract;
  const blocked: readonly BlockedCapability[] = recipe.issues.map((issue) => ({
    id: 'spec.recipe',
    source: { kind: 'elicited', itemId: issue.itemId },
    reason: 'malformed_recipe',
    message: `${issue.itemId}: ${issue.line} — ${issue.reason}`,
  }));
  return { ...contract, blocked: [...blocked, ...contract.blocked] };
}
