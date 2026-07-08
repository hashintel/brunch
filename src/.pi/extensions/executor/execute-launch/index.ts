import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { prepareLaunch, type LaunchResult } from '../../../../executor/launch.js';
import { BRUNCH_EXECUTE_LAUNCH_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { buildCurrentProjectionForSpec } from '../current-projection.js';

export { BRUNCH_EXECUTE_LAUNCH_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteLaunchParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description: 'Execution mode expected for the selected plan file. Defaults to greenfield.',
    }),
  ),
  planPath: Type.Optional(
    Type.String({
      description: 'Optional explicit plan file path. Defaults to .brunch/cook/specs/<specId>/plan.yaml.',
    }),
  ),
});

type ExecuteLaunchParams = Static<typeof ExecuteLaunchParams>;

interface ExecuteLaunchDetails {
  readonly result: LaunchResult;
  readonly sideEffects: readonly [];
}

export interface ExecuteLaunchDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteLaunchTool(
  deps: ExecuteLaunchDeps,
): ToolDefinition<typeof ExecuteLaunchParams, ExecuteLaunchDetails> {
  return {
    name: BRUNCH_EXECUTE_LAUNCH_TOOL,
    label: 'execute_launch',
    description:
      'Validate the selected spec cook plan path and report cook launch readiness. Does not create cook runs or worktrees.',
    parameters: ExecuteLaunchParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_launch requires an active cwd');
      }
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const { current } = await buildCurrentProjectionForSpec({
        cwd,
        specId: deps.specId,
        graph,
        mode: params.mode,
      });
      const result = await prepareLaunch({
        cwd,
        specId: String(deps.specId),
        current,
        ...(params.planPath ? { planPath: params.planPath } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_launch: ${result.status}`,
              `run status: ${result.runStatus}`,
              `plan path: ${result.planPath}`,
              `graph lsn: ${graph.lsn}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteLaunch(pi: ExtensionAPI, deps: ExecuteLaunchDeps): void {
  pi.registerTool(createExecuteLaunchTool(deps) as never);
}

export default registerBrunchExecuteLaunch;
