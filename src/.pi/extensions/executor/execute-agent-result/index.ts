import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { ingestAgentResult, type AgentResultIngestResult } from '../../../../executor/agent-result.js';
import type { AgentRunnerPort } from '../../../../executor/execution-ports.js';
import { BRUNCH_EXECUTE_AGENT_RESULT_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_AGENT_RESULT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteAgentResultParams = Type.Object({
  runId: Type.String({ description: 'Run id with a requested active slice.' }),
});

type ExecuteAgentResultParams = Static<typeof ExecuteAgentResultParams>;

interface ExecuteAgentResultDetails {
  readonly result: AgentResultIngestResult;
  readonly sideEffects: AgentResultIngestResult['sideEffects'];
}

export function createExecuteAgentResultTool(agentRunner: AgentRunnerPort) {
  return defineBrunchTool<typeof ExecuteAgentResultParams, ExecuteAgentResultDetails>({
    name: BRUNCH_EXECUTE_AGENT_RESULT_TOOL,
    label: 'execute_agent_result',
    description:
      'Run the agent runner for the active slice in its worktree and ingest the true result. Does not run tests or create Petri artifacts.',
    parameters: toolParameters(ExecuteAgentResultParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_agent_result requires an active cwd');
      }
      const result = await ingestAgentResult({
        cwd,
        runId: params.runId,
        agentRunner,
        runtime: {
          ...(ctx.modelRegistry ? { modelRegistry: ctx.modelRegistry } : {}),
          ...(ctx.model ? { model: ctx.model } : {}),
          ...(_signal ? { signal: _signal } : {}),
        },
      });
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
  });
}

export function registerBrunchExecuteAgentResult(pi: ExtensionAPI, agentRunner: AgentRunnerPort): void {
  pi.registerTool(createExecuteAgentResultTool(agentRunner) as never);
}

export default registerBrunchExecuteAgentResult;
