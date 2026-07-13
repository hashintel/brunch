import { defaultCapabilityProviders } from './capability-providers.js';
import { draftExecutablePlan, type ExecutablePlanDraft } from './executable-plan-draft.js';
import { checkExecutionSpecForPlan, type ExecutePlanCheckResult } from './execute-plan-check.js';
import { outlineExecutionPlan, type ExecutionPlanOutline } from './execute-plan-outline.js';
import {
  deriveExecutionContract,
  type CapabilityRequirement,
  type ExecutionContract,
} from './execution-contract.js';
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
  const providers = defaultCapabilityProviders();
  // ceiling: deterministic lowering has no elicited-capability source yet; the FE-1197
  // slice B planner replaces this explicit default-provenance requirement with
  // capabilities projected from approved commitments.
  const required: readonly CapabilityRequirement[] =
    detected.length === 0 ? [{ id: 'node.npm-verify', source: { kind: 'default' } }] : [];
  const executionContract = deriveExecutionContract({ required, detected, providers });

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
