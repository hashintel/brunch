import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { writePlanFile, type PlanFileWriteResult } from '../../../../executor/plan-file.js';
import {
  runExecutionActive,
  withRunExecutionAuthority,
  type RunExecutionActiveResult,
} from '../../../../executor/run-execution-authority.js';
import {
  assessRunRetryEligibility,
  type RunRetryEligibilityResult,
} from '../../../../executor/run-retry-eligibility.js';
import { BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';
import { buildCurrentProjectionForRun } from '../current-projection.js';

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
  | RunExecutionActiveResult
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

export function createExecuteReplanRegeneratePlanTool(deps: ExecuteReplanRegeneratePlanDeps) {
  return defineBrunchTool<typeof ExecuteReplanRegeneratePlanParams, ExecuteReplanRegeneratePlanDetails>({
    name: BRUNCH_EXECUTE_REPLAN_REGENERATE_PLAN_TOOL,
    label: 'execute_replan_regenerate_plan',
    description:
      'Regenerate plan.yaml and provenance for a stale early executor run when current graph projection is plan-ready. Does not mutate run metadata.',
    parameters: toolParameters(ExecuteReplanRegeneratePlanParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_replan_regenerate_plan requires an active cwd');
      }

      return withRunExecutionAuthority({
        cwd,
        runId: params.runId,
        onContended: () => {
          const result = runExecutionActive(params.runId);
          return {
            content: [
              { type: 'text' as const, text: 'execute_replan_regenerate_plan: run_execution_active' },
            ],
            details: { result, sideEffects: result.sideEffects },
          };
        },
        execute: async () => {
          const { current, projection } = await buildCurrentProjectionForRun({
            cwd,
            runId: params.runId,
            fallbackSpecId: deps.specId,
            reads: deps.reads,
            mode: params.mode,
          });
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
                  `graph lsn: ${current.source.graphLsn}`,
                  `side effects: ${finalResult.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
                ]
                  .filter((line): line is string => typeof line === 'string')
                  .join('\n'),
              },
            ],
            details: { result: finalResult, sideEffects: finalResult.sideEffects },
          };
        },
      });
    },
  });
}

export function registerBrunchExecuteReplanRegeneratePlan(
  pi: ExtensionAPI,
  deps: ExecuteReplanRegeneratePlanDeps,
): void {
  pi.registerTool(createExecuteReplanRegeneratePlanTool(deps) as never);
}

export default registerBrunchExecuteReplanRegeneratePlan;
