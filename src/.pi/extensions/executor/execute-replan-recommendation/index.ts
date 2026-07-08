import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  recommendRunReplan,
  type RunReplanRecommendation,
} from '../../../../executor/run-replan-recommendation.js';
import { BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { buildCurrentProjectionForRun } from '../current-projection.js';

export { BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteReplanRecommendationParams = Type.Object({
  runId: Type.String({ description: 'Executor run id to diagnose for retry/replanning.' }),
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode expected for the selected plan file. Defaults to greenfield.',
    }),
  ),
});

type ExecuteReplanRecommendationParams = Static<typeof ExecuteReplanRecommendationParams>;

interface ExecuteReplanRecommendationDetails {
  readonly recommendation: RunReplanRecommendation;
  readonly sideEffects: readonly [];
}

export interface ExecuteReplanRecommendationDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteReplanRecommendationTool(
  deps: ExecuteReplanRecommendationDeps,
): ToolDefinition<typeof ExecuteReplanRecommendationParams, ExecuteReplanRecommendationDetails> {
  return {
    name: BRUNCH_EXECUTE_REPLAN_RECOMMENDATION_TOOL,
    label: 'execute_replan_recommendation',
    description:
      'Diagnose whether an executor run can be retried or should be replanned. Side-effect free: does not mutate plans, runs, worktrees, or graph state.',
    parameters: ExecuteReplanRecommendationParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_replan_recommendation requires an active cwd');
      }

      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const { current } = await buildCurrentProjectionForRun({
        cwd,
        runId: params.runId,
        fallbackSpecId: deps.specId,
        graph,
        mode: params.mode,
      });
      const recommendation = await recommendRunReplan({
        cwd,
        runId: params.runId,
        current,
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_replan_recommendation: ${recommendation.status}`,
              `run status: ${recommendation.runStatus}`,
              `recommended action: ${recommendation.recommendedAction}`,
              `allowed actions: ${recommendation.allowedActions.join(', ')}`,
              `diagnosis: ${recommendation.diagnosis}`,
              `graph lsn: ${graph.lsn}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: { recommendation, sideEffects: recommendation.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteReplanRecommendation(
  pi: ExtensionAPI,
  deps: ExecuteReplanRecommendationDeps,
): void {
  pi.registerTool(createExecuteReplanRecommendationTool(deps) as never);
}

export default registerBrunchExecuteReplanRecommendation;
