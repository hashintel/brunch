import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  outlineExecutionPlan,
  type ExecutionPlanOutline,
} from '../../../../orchestration/execute-plan-outline.js';
import { projectExecutionSpecSnapshot } from '../../../../orchestration/execution-spec-snapshot.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

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

export function createExecutePlanOutlineTool(
  deps: ExecutePlanOutlineDeps,
): ToolDefinition<typeof ExecutePlanOutlineParams, ExecutePlanOutlineDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
    label: 'execute_plan_outline',
    description:
      'Create a side-effect-free reviewable plan outline from the selected specification graph. Does not create plan files or cook runs.',
    parameters: ExecutePlanOutlineParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const snapshot = projectExecutionSpecSnapshot({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const outline = outlineExecutionPlan(snapshot);
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
          source: { graphLsn: graph.lsn, visibility: 'active' },
          sideEffects: [],
        },
      };
    },
  };
}

export function registerBrunchExecutePlanOutline(pi: ExtensionAPI, deps: ExecutePlanOutlineDeps): void {
  pi.registerTool(createExecutePlanOutlineTool(deps) as never);
}

export default registerBrunchExecutePlanOutline;
