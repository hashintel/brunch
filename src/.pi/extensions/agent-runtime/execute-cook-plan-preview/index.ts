import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { CookPlanPreview } from '../../../../orchestration/cook-plan-preview.js';
import { projectExecuteGraph } from '../../../../orchestration/execute-projection.js';
import { BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export { BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookPlanPreviewParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the preview. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecuteCookPlanPreviewParams = Static<typeof ExecuteCookPlanPreviewParams>;

interface ExecuteCookPlanPreviewDetails {
  readonly preview: CookPlanPreview;
  readonly source: { readonly graphLsn: number; readonly visibility: 'active' };
  readonly sideEffects: readonly [];
}

export interface ExecuteCookPlanPreviewDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteCookPlanPreviewTool(
  deps: ExecuteCookPlanPreviewDeps,
): ToolDefinition<typeof ExecuteCookPlanPreviewParams, ExecuteCookPlanPreviewDetails> {
  return {
    name: BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
    label: 'execute_cook_plan_preview',
    description:
      'Preview the old cook-compatible plan shape derived from the selected specification graph. Does not write plan files or create cook runs.',
    parameters: ExecuteCookPlanPreviewParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const preview = projection.cookPlanPreview;
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_plan_preview: ${preview.mode}`,
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

export function registerBrunchExecuteCookPlanPreview(
  pi: ExtensionAPI,
  deps: ExecuteCookPlanPreviewDeps,
): void {
  pi.registerTool(createExecuteCookPlanPreviewTool(deps) as never);
}

export default registerBrunchExecuteCookPlanPreview;
