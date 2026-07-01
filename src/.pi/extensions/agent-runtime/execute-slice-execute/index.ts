import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  requestCookSliceExecution,
  type CookSliceExecutionRequestResult,
} from '../../../../executor/slice-execute.js';
import { BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookSliceExecuteParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose active slice has been marked started.' }),
});

type ExecuteCookSliceExecuteParams = Static<typeof ExecuteCookSliceExecuteParams>;

interface ExecuteCookSliceExecuteDetails {
  readonly result: CookSliceExecutionRequestResult;
  readonly sideEffects: CookSliceExecutionRequestResult['sideEffects'];
}

export function createExecuteCookSliceExecuteTool(): ToolDefinition<
  typeof ExecuteCookSliceExecuteParams,
  ExecuteCookSliceExecuteDetails
> {
  return {
    name: BRUNCH_EXECUTE_SLICE_EXECUTE_TOOL,
    label: 'execute_slice_execute',
    description:
      'Create an execution request artifact for the active slice. Does not run agents, tests, or Petri transitions.',
    parameters: ExecuteCookSliceExecuteParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_slice_execute requires an active cwd');
      }
      const result = await requestCookSliceExecution({ cwd, runId: params.runId });
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
  };
}

export function registerBrunchExecuteCookSliceExecute(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookSliceExecuteTool() as never);
}

export default registerBrunchExecuteCookSliceExecute;
