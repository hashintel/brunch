import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  outlineExecutionPlan,
  type ExecutionPlanOutline,
} from '../../../../orchestration/execute-plan-outline.js';
import { projectExecutionSpecSnapshot } from '../../../../orchestration/execution-spec-snapshot.js';
import { writePlanOutlineArtifact } from '../../../../orchestration/plan-outline-artifact.js';
import { BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export { BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanOutlineArtifactParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the artifact outline. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanOutlineArtifactParams = Static<typeof ExecutePlanOutlineArtifactParams>;

interface ExecutePlanOutlineArtifactDetails {
  readonly outline: ExecutionPlanOutline;
  readonly artifact: {
    readonly path: string;
  };
  readonly source: {
    readonly graphLsn: number;
    readonly visibility: 'active';
  };
  readonly sideEffects: readonly [{ readonly kind: 'write_file'; readonly path: string }];
}

export interface ExecutePlanOutlineArtifactDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanOutlineArtifactTool(
  deps: ExecutePlanOutlineArtifactDeps,
): ToolDefinition<typeof ExecutePlanOutlineArtifactParams, ExecutePlanOutlineArtifactDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
    label: 'execute_plan_outline_artifact',
    description:
      'Write the current reviewable plan outline artifact under .brunch/execution-reports. Does not create cook runs or worktrees.',
    parameters: ExecutePlanOutlineArtifactParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_plan_outline_artifact requires an active cwd');
      }
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const snapshot = projectExecutionSpecSnapshot({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const outline = outlineExecutionPlan(snapshot);
      const artifact = await writePlanOutlineArtifact({ cwd, outline });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_outline_artifact: ${artifact.path}`,
              `frontiers: ${outline.frontiers.length}`,
              `tasks: ${outline.frontiers.reduce((sum, frontier) => sum + frontier.tasks.length, 0)}`,
              `graph lsn: ${graph.lsn}`,
              `side effects: ${artifact.sideEffects.map((effect) => effect.kind).join(', ')}`,
            ].join('\n'),
          },
        ],
        details: {
          outline,
          artifact: { path: artifact.path },
          source: { graphLsn: graph.lsn, visibility: 'active' },
          sideEffects: artifact.sideEffects,
        },
      };
    },
  };
}

export function registerBrunchExecutePlanOutlineArtifact(
  pi: ExtensionAPI,
  deps: ExecutePlanOutlineArtifactDeps,
): void {
  pi.registerTool(createExecutePlanOutlineArtifactTool(deps) as never);
}

export default registerBrunchExecutePlanOutlineArtifact;
