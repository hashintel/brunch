import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { ExecutionPorts } from '../../../../executor/execution-ports.js';
import { drive, type DriveOutcome } from '../../../../executor/orchestrate.js';
import { BRUNCH_EXECUTE_ORCHESTRATE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_ORCHESTRATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteOrchestrateParams = Type.Object({
  runId: Type.String({ description: 'Run id to drive to completion.' }),
});

type ExecuteOrchestrateParams = Static<typeof ExecuteOrchestrateParams>;

interface ExecuteOrchestrateDetails {
  readonly outcome: DriveOutcome;
}

export function createExecuteOrchestrateTool(
  ports: ExecutionPorts,
): ToolDefinition<typeof ExecuteOrchestrateParams, ExecuteOrchestrateDetails> {
  return {
    name: BRUNCH_EXECUTE_ORCHESTRATE_TOOL,
    label: 'execute_orchestrate',
    description:
      'Drive an executor run end-to-end to run_completed by advancing each lifecycle step the scheduler reports ready. Halts without advancing if a step cannot execute. Does not promote or land.',
    parameters: ExecuteOrchestrateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_orchestrate requires an active cwd');
      }
      const outcome = await drive({
        cwd,
        runId: params.runId,
        ports,
        runtime: {
          ...(ctx.modelRegistry ? { modelRegistry: ctx.modelRegistry } : {}),
          ...(ctx.model ? { model: ctx.model } : {}),
          ...(_signal ? { signal: _signal } : {}),
        },
        ...(_signal ? { signal: _signal } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_orchestrate: ${outcome.status}`,
              `run status: ${'runStatus' in outcome ? outcome.runStatus : 'not_started'}`,
              `run id: ${params.runId}`,
              ...(outcome.status === 'halted' ? [`halted at: ${outcome.step} (${outcome.reason})`] : []),
            ].join('\n'),
          },
        ],
        details: { outcome },
      };
    },
  };
}

export function registerBrunchExecuteOrchestrate(pi: ExtensionAPI, ports: ExecutionPorts): void {
  pi.registerTool(createExecuteOrchestrateTool(ports) as never);
}

export default registerBrunchExecuteOrchestrate;
