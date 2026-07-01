import { previewCookPlan, type CookPlanPreview } from './cook-plan-preview.js';
import { draftExecutablePlan, type ExecutablePlanDraft } from './executable-plan-draft.js';
import { checkExecutionSpecForPlan, type ExecutePlanCheckResult } from './execute-plan-check.js';
import { outlineExecutionPlan, type ExecutionPlanOutline } from './execute-plan-outline.js';
import {
  projectExecutionSpecSnapshot,
  type ExecutionSpecMode,
  type ExecutionSpecSnapshot,
  type ProjectExecutionSpecSnapshotInput,
} from './execution-spec-snapshot.js';

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
  readonly cookPlanPreview: CookPlanPreview;
}

export interface ProjectExecuteGraphInput extends Omit<ProjectExecutionSpecSnapshotInput, 'mode'> {
  readonly graphLsn: number;
  readonly mode?: ExecutionSpecMode;
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

  return {
    source: { graphLsn: input.graphLsn, visibility: 'active' },
    snapshot,
    check: checkExecutionSpecForPlan(snapshot),
    outline,
    draft,
    cookPlanPreview: previewCookPlan(draft),
  };
}
