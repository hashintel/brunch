import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  selectSourcePolicy,
  type SourcePolicyKind,
  type SourcePolicyResult,
} from '../../../../executor/source-policy.js';
import { BRUNCH_EXECUTE_SOURCE_POLICY_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_SOURCE_POLICY_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSourcePolicyParams = Type.Object({
  runId: Type.String({ description: 'Run id whose worktree has been populated with the plan.' }),
  policy: Type.Union([Type.Literal('plan_only'), Type.Literal('host_source_deferred')], {
    description: 'Host source policy to record. This tool never copies host source files.',
  }),
});

type ExecuteSourcePolicyParams = Static<typeof ExecuteSourcePolicyParams>;

interface ExecuteSourcePolicyDetails {
  readonly result: SourcePolicyResult;
  readonly sideEffects: SourcePolicyResult['sideEffects'];
}

export function createExecuteSourcePolicyTool() {
  return defineBrunchTool<typeof ExecuteSourcePolicyParams, ExecuteSourcePolicyDetails>({
    name: BRUNCH_EXECUTE_SOURCE_POLICY_TOOL,
    label: 'execute_source_policy',
    description:
      'Record the source population policy for a cook run. Does not copy host source, execute slices, or create Petri artifacts.',
    parameters: toolParameters(ExecuteSourcePolicyParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_source_policy requires an active cwd');
      }
      const result = await selectSourcePolicy({
        cwd,
        runId: params.runId,
        policy: params.policy as SourcePolicyKind,
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
  });
}

export function registerBrunchExecuteSourcePolicy(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteSourcePolicyTool() as never);
}

export default registerBrunchExecuteSourcePolicy;
