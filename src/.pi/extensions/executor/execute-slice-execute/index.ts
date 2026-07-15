import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { GitSliceIntegrationPort } from '../../../../executor/execution-ports.js';
import {
  requestSliceExecution,
  type SliceExecutionRequestResult,
} from '../../../../executor/slice-execute.js';
import { BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSliceExecuteParams = Type.Object({
  runId: Type.String({ description: 'Run id whose active slice has been marked started.' }),
});

type ExecuteSliceExecuteParams = Static<typeof ExecuteSliceExecuteParams>;

interface ExecuteSliceExecuteDetails {
  readonly result: SliceExecutionRequestResult;
  readonly sideEffects: SliceExecutionRequestResult['sideEffects'];
}

export function createExecuteSliceExecuteTool(gitSliceIntegration: GitSliceIntegrationPort) {
  return defineBrunchTool<typeof ExecuteSliceExecuteParams, ExecuteSliceExecuteDetails>({
    name: BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL,
    label: 'execute_slice_execute',
    description:
      'Create an execution request artifact for the active slice. Does not run agents, tests, or Petri transitions.',
    parameters: toolParameters(ExecuteSliceExecuteParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_slice_execute requires an active cwd');
      }
      const result = await requestSliceExecution({
        cwd,
        runId: params.runId,
        gitSliceIntegration,
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_slice_execute: ${result.status}`,
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

export function registerBrunchExecuteSliceExecute(
  pi: ExtensionAPI,
  gitSliceIntegration: GitSliceIntegrationPort,
): void {
  pi.registerTool(createExecuteSliceExecuteTool(gitSliceIntegration) as never);
}

export default registerBrunchExecuteSliceExecute;
