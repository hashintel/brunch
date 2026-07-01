import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  selectCookSourcePolicy,
  type CookSourcePolicyKind,
  type CookSourcePolicyResult,
} from '../../../../executor/source-policy.js';
import { BRUNCH_EXECUTE_SOURCE_POLICY_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_SOURCE_POLICY_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookSourcePolicyParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose worktree has been populated with the plan.' }),
  policy: Type.Union([Type.Literal('plan_only'), Type.Literal('host_source_deferred')], {
    description: 'Host source policy to record. This tool never copies host source files.',
  }),
});

type ExecuteCookSourcePolicyParams = Static<typeof ExecuteCookSourcePolicyParams>;

interface ExecuteCookSourcePolicyDetails {
  readonly result: CookSourcePolicyResult;
  readonly sideEffects: CookSourcePolicyResult['sideEffects'];
}

export function createExecuteCookSourcePolicyTool(): ToolDefinition<
  typeof ExecuteCookSourcePolicyParams,
  ExecuteCookSourcePolicyDetails
> {
  return {
    name: BRUNCH_EXECUTE_SOURCE_POLICY_TOOL,
    label: 'execute_source_policy',
    description:
      'Record the source population policy for a cook run. Does not copy host source, execute slices, or create Petri artifacts.',
    parameters: ExecuteCookSourcePolicyParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_source_policy requires an active cwd');
      }
      const result = await selectCookSourcePolicy({
        cwd,
        runId: params.runId,
        policy: params.policy as CookSourcePolicyKind,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_source_policy: ${result.status}`,
              `run status: ${result.runStatus}`,
              `run id: ${result.runId}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteCookSourcePolicy(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookSourcePolicyTool() as never);
}

export default registerBrunchExecuteCookSourcePolicy;
