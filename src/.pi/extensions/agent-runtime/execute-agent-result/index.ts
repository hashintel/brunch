import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { ingestAgentResult, type AgentResultIngestResult } from '../../../../executor/agent-result.js';
import { BRUNCH_EXECUTE_AGENT_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_AGENT_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteAgentResultParams = Type.Object({
  runId: Type.String({ description: 'Run id with a requested active slice.' }),
});

type ExecuteAgentResultParams = Static<typeof ExecuteAgentResultParams>;

interface ExecuteAgentResultDetails {
  readonly result: AgentResultIngestResult;
  readonly sideEffects: AgentResultIngestResult['sideEffects'];
}

export function createExecuteAgentResultTool(): ToolDefinition<
  typeof ExecuteAgentResultParams,
  ExecuteAgentResultDetails
> {
  return {
    name: BRUNCH_EXECUTE_AGENT_RESULT_TOOL,
    label: 'execute_agent_result',
    description:
      'Ingest a prewritten agent result for the active slice. Does not launch agents, run tests, or create Petri artifacts.',
    parameters: ExecuteAgentResultParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_agent_result requires an active cwd');
      }
      const result = await ingestAgentResult({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_agent_result: ${result.status}`,
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

export function registerBrunchExecuteAgentResult(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteAgentResultTool() as never);
}

export default registerBrunchExecuteAgentResult;
