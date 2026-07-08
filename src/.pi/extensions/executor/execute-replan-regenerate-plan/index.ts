import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { projectExecuteGraph } from '../../../../executor/execute-projection.js';
import { writePlanFile, type PlanFileWriteResult } from '../../../../executor/plan-file.js';
import {
  assessRunRetryEligibility,
  type RunRetryEligibilityResult,
} from '../../../../executor/run-retry-eligibility.js';
import { readRunMetadata, runMetadataPath } from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export { BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteReplanRegeneratePlanParams = Type.Object({
  runId: Type.String({ description: 'Executor run id whose stale early plan should be regenerated.' }),
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode to write onto the regenerated plan. Defaults to greenfield.',
    }),
  ),
});

type ExecuteReplanRegeneratePlanParams = Static<typeof ExecuteReplanRegeneratePlanParams>;

type ExecuteReplanRegeneratePlanResult =
  | {
      readonly status: 'regenerate_not_allowed';
      readonly eligibility: RunRetryEligibilityResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'projection_blocked';
      readonly eligibility: RunRetryEligibilityResult;
      readonly sideEffects: readonly [];
    }
  | {
      readonly status: 'regenerated_plan';
      readonly eligibility: RunRetryEligibilityResult;
      readonly artifact: PlanFileWriteResult;
      readonly sideEffects: PlanFileWriteResult['sideEffects'];
    };

interface ExecuteReplanRegeneratePlanDetails {
  readonly result: ExecuteReplanRegeneratePlanResult;
  readonly sideEffects: ExecuteReplanRegeneratePlanResult['sideEffects'];
}

export interface ExecuteReplanRegeneratePlanDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteReplanRegeneratePlanTool(
  deps: ExecuteReplanRegeneratePlanDeps,
): ToolDefinition<typeof ExecuteReplanRegeneratePlanParams, ExecuteReplanRegeneratePlanDetails> {
  return {
    name: BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL,
    label: 'execute_replan_regenerate_plan',
    description:
      'Regenerate plan.yaml and provenance for a stale early executor run when current graph projection is plan-ready. Does not mutate run metadata.',
    parameters: ExecuteReplanRegeneratePlanParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_replan_regenerate_plan requires an active cwd');
      }

      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const metadata = await readRunMetadata(runMetadataPath(cwd, params.runId));
      const targetSpecId = Number(metadata?.specId ?? deps.specId);
      const mode = params.mode ?? 'greenfield';
      const projection = projectExecuteGraph({
        specId: targetSpecId,
        mode,
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const current = {
        specId: String(targetSpecId),
        mode,
        source: projection.source,
        checkStatus: projection.check.status,
      } as const;
      const eligibility = await assessRunRetryEligibility({ cwd, runId: params.runId, current });

      let finalResult: ExecuteReplanRegeneratePlanResult;
      if (eligibility.status !== 'replan_before_retry') {
        finalResult = { status: 'regenerate_not_allowed', eligibility, sideEffects: [] };
      } else if (projection.check.status !== 'ok') {
        finalResult = { status: 'projection_blocked', eligibility, sideEffects: [] };
      } else {
        const artifact = await writePlanFile({
          cwd,
          preview: projection.planPreview,
          source: projection.source,
        });
        finalResult = {
          status: 'regenerated_plan',
          eligibility,
          artifact,
          sideEffects: artifact.sideEffects,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_replan_regenerate_plan: ${finalResult.status}`,
              `eligibility: ${eligibility.status}`,
              `run status: ${eligibility.runStatus}`,
              finalResult.status === 'regenerated_plan'
                ? `plan path: ${finalResult.artifact.path}`
                : undefined,
              `graph lsn: ${graph.lsn}`,
              `side effects: ${finalResult.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ]
              .filter((line): line is string => typeof line === 'string')
              .join('\n'),
          },
        ],
        details: { result: finalResult, sideEffects: finalResult.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteReplanRegeneratePlan(
  pi: ExtensionAPI,
  deps: ExecuteReplanRegeneratePlanDeps,
): void {
  pi.registerTool(createExecuteReplanRegeneratePlanTool(deps) as never);
}

export default registerBrunchExecuteReplanRegeneratePlan;
