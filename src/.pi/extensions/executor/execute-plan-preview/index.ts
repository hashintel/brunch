import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../../executor/execute-projection.js';
import type { PlanPreview } from '../../../../executor/plan-preview.js';
import { BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanPreviewParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the preview. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanPreviewParams = Static<typeof ExecutePlanPreviewParams>;

interface ExecutePlanPreviewDetails {
  readonly preview: PlanPreview;
  readonly source: { readonly graphLsn: number; readonly visibility: 'active' };
  readonly sideEffects: readonly [];
}

export interface ExecutePlanPreviewDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanPreviewTool(
  deps: ExecutePlanPreviewDeps,
): ToolDefinition<typeof ExecutePlanPreviewParams, ExecutePlanPreviewDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_PREVIEW_TOOL,
    label: 'execute_plan_preview',
    description:
      'Preview the old cook-compatible plan shape derived from the selected specification graph. Does not write plan files or create cook runs.',
    parameters: toolParameters(ExecutePlanPreviewParams),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      assertExecuteProjectionPlanReady(projection);
      const preview = projection.planPreview;
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_preview: ${preview.mode}`,
              `epics: ${preview.epics.length}`,
              `slices: ${preview.slices.length}`,
              `graph lsn: ${graph.lsn}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: { preview, source: projection.source, sideEffects: [] },
      };
    },
  };
}

export function registerBrunchExecutePlanPreview(pi: ExtensionAPI, deps: ExecutePlanPreviewDeps): void {
  pi.registerTool(createExecutePlanPreviewTool(deps) as never);
}

export default registerBrunchExecutePlanPreview;
