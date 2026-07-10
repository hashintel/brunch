import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { ExecutionPlanOutline } from '../../../../executor/execute-plan-outline.js';
import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../../executor/execute-projection.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanOutlineParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the outlined snapshot. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanOutlineParams = Static<typeof ExecutePlanOutlineParams>;

interface ExecutePlanOutlineDetails {
  readonly outline: ExecutionPlanOutline;
  readonly source: {
    readonly graphLsn: number;
    readonly visibility: 'active';
  };
  readonly sideEffects: readonly [];
}

export interface ExecutePlanOutlineDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanOutlineTool(deps: ExecutePlanOutlineDeps) {
  return defineBrunchTool<typeof ExecutePlanOutlineParams, ExecutePlanOutlineDetails>({
    name: BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
    label: 'execute_plan_outline',
    description:
      'Create a side-effect-free reviewable plan outline from the selected specification graph. Does not create plan files or cook runs.',
    parameters: toolParameters(ExecutePlanOutlineParams),
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
      const outline = projection.outline;
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_outline: spec ${outline.specId} (${outline.mode})`,
              `frontiers: ${outline.frontiers.length}`,
              `tasks: ${outline.frontiers.reduce((sum, frontier) => sum + frontier.tasks.length, 0)}`,
              `graph lsn: ${graph.lsn}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: {
          outline,
          source: projection.source,
          sideEffects: [],
        },
      };
    },
  });
}

export function registerBrunchExecutePlanOutline(pi: ExtensionAPI, deps: ExecutePlanOutlineDeps): void {
  pi.registerTool(createExecutePlanOutlineTool(deps) as never);
}

export default registerBrunchExecutePlanOutline;
