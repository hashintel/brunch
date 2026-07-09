import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { completeSlice, type SliceCompleteResult } from '../../../../executor/slice-complete.js';
import { BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSliceCompleteParams = Type.Object({
  runId: Type.String({ description: 'Run id whose active slice has ingested test results.' }),
});

type ExecuteSliceCompleteParams = Static<typeof ExecuteSliceCompleteParams>;

interface ExecuteSliceCompleteDetails {
  readonly result: SliceCompleteResult;
  readonly sideEffects: SliceCompleteResult['sideEffects'];
}

export function createExecuteSliceCompleteTool(): ToolDefinition<
  typeof ExecuteSliceCompleteParams,
  ExecuteSliceCompleteDetails
> {
  return {
    name: BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL,
    label: 'execute_slice_complete',
    description:
      'Mark the active slice complete after ingested test results. Does not create Petri artifacts, promote, or land.',
    parameters: toolParameters(ExecuteSliceCompleteParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_slice_complete requires an active cwd');
      }
      const result = await completeSlice({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_slice_complete: ${result.status}`,
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

export function registerBrunchExecuteSliceComplete(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteSliceCompleteTool() as never);
}

export default registerBrunchExecuteSliceComplete;
