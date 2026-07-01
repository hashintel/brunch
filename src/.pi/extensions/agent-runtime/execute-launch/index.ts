import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { prepareCookLaunch, type CookLaunchResult } from '../../../../executor/launch.js';
import { BRUNCH_EXECUTE_LAUNCH_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_LAUNCH_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookLaunchParams = Type.Object({
  planPath: Type.Optional(
    Type.String({
      description: 'Optional explicit plan file path. Defaults to .brunch/cook/specs/<specId>/plan.yaml.',
    }),
  ),
});

type ExecuteCookLaunchParams = Static<typeof ExecuteCookLaunchParams>;

interface ExecuteCookLaunchDetails {
  readonly result: CookLaunchResult;
  readonly sideEffects: readonly [];
}

export interface ExecuteCookLaunchDeps {
  readonly specId: number;
}

export function createExecuteCookLaunchTool(
  deps: ExecuteCookLaunchDeps,
): ToolDefinition<typeof ExecuteCookLaunchParams, ExecuteCookLaunchDetails> {
  return {
    name: BRUNCH_EXECUTE_LAUNCH_TOOL,
    label: 'execute_launch',
    description:
      'Validate the selected spec cook plan path and report cook launch readiness. Does not create cook runs or worktrees.',
    parameters: ExecuteCookLaunchParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_launch requires an active cwd');
      }
      const result = await prepareCookLaunch({
        cwd,
        specId: String(deps.specId),
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
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteCookLaunch(pi: ExtensionAPI, deps: ExecuteCookLaunchDeps): void {
  pi.registerTool(createExecuteCookLaunchTool(deps) as never);
}

export default registerBrunchExecuteCookLaunch;
