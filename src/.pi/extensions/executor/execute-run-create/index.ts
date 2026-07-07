import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { projectExecuteGraph } from '../../../../executor/execute-projection.js';
import { createRun, type RunCreateResult } from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteRunCreateParams = Type.Object({
  runId: Type.Optional(
    Type.String({ description: 'Optional deterministic run id. Defaults to a generated id.' }),
  ),
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode expected for the selected plan file. Defaults to greenfield.',
    }),
  ),
});

type ExecuteRunCreateParams = Static<typeof ExecuteRunCreateParams>;

interface ExecuteRunCreateDetails {
  readonly result: RunCreateResult;
  readonly sideEffects: RunCreateResult['sideEffects'];
}

export interface ExecuteRunCreateDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteRunCreateTool(
  deps: ExecuteRunCreateDeps,
): ToolDefinition<typeof ExecuteRunCreateParams, ExecuteRunCreateDetails> {
  return {
    name: BRUNCH_EXECUTE_RUN_CREATE_TOOL,
    label: 'execute_run_create',
    description:
      'Create metadata for a cook run from the selected spec plan. Does not create worktrees, Petri artifacts, or execute slices.',
    parameters: ExecuteRunCreateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_run_create requires an active cwd');
      }
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const mode = params.mode ?? 'greenfield';
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode,
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const result = await createRun({
        cwd,
        specId: String(deps.specId),
        current: {
          specId: String(deps.specId),
          mode,
          source: projection.source,
          checkStatus: projection.check.status,
        },
        ...(params.runId ? { runId: params.runId } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_run_create: ${result.status}`,
              `run status: ${result.runStatus}`,
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

export function registerBrunchExecuteRunCreate(pi: ExtensionAPI, deps: ExecuteRunCreateDeps): void {
  pi.registerTool(createExecuteRunCreateTool(deps) as never);
}

export default registerBrunchExecuteRunCreate;
