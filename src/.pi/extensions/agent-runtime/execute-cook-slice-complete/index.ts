import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  completeCookSlice,
  type CookSliceCompleteResult,
} from '../../../../orchestration/cook-slice-complete.js';
import { BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookSliceCompleteParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose active slice has ingested test results.' }),
});

type ExecuteCookSliceCompleteParams = Static<typeof ExecuteCookSliceCompleteParams>;

interface ExecuteCookSliceCompleteDetails {
  readonly result: CookSliceCompleteResult;
  readonly sideEffects: CookSliceCompleteResult['sideEffects'];
}

export function createExecuteCookSliceCompleteTool(): ToolDefinition<
  typeof ExecuteCookSliceCompleteParams,
  ExecuteCookSliceCompleteDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL,
    label: 'execute_cook_slice_complete',
    description:
      'Mark the active slice complete after ingested test results. Does not create Petri artifacts, promote, or land.',
    parameters: ExecuteCookSliceCompleteParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_slice_complete requires an active cwd');
      }
      const result = await completeCookSlice({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_slice_complete: ${result.status}`,
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

export function registerBrunchExecuteCookSliceComplete(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookSliceCompleteTool() as never);
}

export default registerBrunchExecuteCookSliceComplete;
