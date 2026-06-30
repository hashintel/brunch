import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  ingestCookAgentResult,
  type CookAgentResultIngestResult,
} from '../../../../orchestration/cook-agent-result.js';
import { BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookAgentResultParams = Type.Object({
  runId: Type.String({ description: 'Cook run id with a requested active slice.' }),
});

type ExecuteCookAgentResultParams = Static<typeof ExecuteCookAgentResultParams>;

interface ExecuteCookAgentResultDetails {
  readonly result: CookAgentResultIngestResult;
  readonly sideEffects: CookAgentResultIngestResult['sideEffects'];
}

export function createExecuteCookAgentResultTool(): ToolDefinition<
  typeof ExecuteCookAgentResultParams,
  ExecuteCookAgentResultDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL,
    label: 'execute_cook_agent_result',
    description:
      'Ingest a prewritten agent result for the active slice. Does not launch agents, run tests, or create Petri artifacts.',
    parameters: ExecuteCookAgentResultParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_agent_result requires an active cwd');
      }
      const result = await ingestCookAgentResult({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_agent_result: ${result.status}`,
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

export function registerBrunchExecuteCookAgentResult(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookAgentResultTool() as never);
}

export default registerBrunchExecuteCookAgentResult;
