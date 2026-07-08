import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { createSupersedingRun, type RunSupersessionResult } from '../../../../executor/run-supersession.js';
import { BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { buildCurrentProjectionForRun } from '../current-projection.js';

export { BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteReplanStartNewRunParams = Type.Object({
  previousRunId: Type.String({ description: 'Existing executor run id that the new run supersedes.' }),
  runId: Type.Optional(Type.String({ description: 'Optional deterministic new run id.' })),
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode expected for the selected plan file. Defaults to greenfield.',
    }),
  ),
});

type ExecuteReplanStartNewRunParams = Static<typeof ExecuteReplanStartNewRunParams>;

interface ExecuteReplanStartNewRunDetails {
  readonly result: RunSupersessionResult;
  readonly sideEffects: RunSupersessionResult['sideEffects'];
}

export interface ExecuteReplanStartNewRunDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteReplanStartNewRunTool(
  deps: ExecuteReplanStartNewRunDeps,
): ToolDefinition<typeof ExecuteReplanStartNewRunParams, ExecuteReplanStartNewRunDetails> {
  return {
    name: BRUNCH_EXECUTE_REPLAN_START_NEW_RUN_TOOL,
    label: 'execute_replan_start_new_run',
    description:
      'Create a fresh executor run that supersedes a prior run when the current plan is launch-ready. Does not mutate the prior run or execute the new run.',
    parameters: ExecuteReplanStartNewRunParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_replan_start_new_run requires an active cwd');
      }

      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const { current } = await buildCurrentProjectionForRun({
        cwd,
        runId: params.previousRunId,
        fallbackSpecId: deps.specId,
        graph,
        mode: params.mode,
      });
      const result = await createSupersedingRun({
        cwd,
        previousRunId: params.previousRunId,
        current,
        ...(params.runId ? { runId: params.runId } : {}),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_replan_start_new_run: ${result.status}`,
              `run status: ${result.runStatus}`,
              `previous run id: ${params.previousRunId}`,
              'runId' in result ? `run id: ${result.runId}` : undefined,
              'planPath' in result ? `plan path: ${result.planPath}` : undefined,
              `graph lsn: ${graph.lsn}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ]
              .filter((line): line is string => typeof line === 'string')
              .join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteReplanStartNewRun(
  pi: ExtensionAPI,
  deps: ExecuteReplanStartNewRunDeps,
): void {
  pi.registerTool(createExecuteReplanStartNewRunTool(deps) as never);
}

export default registerBrunchExecuteReplanStartNewRun;
