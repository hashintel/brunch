import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { startCookSlice, type CookSliceStartResult } from '../../../../executor/slice-start.js';
import { BRUNCH_EXECUTE_COOK_SLICE_START_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_SLICE_START_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookSliceStartParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose report log is initialized.' }),
  sliceId: Type.Optional(Type.String({ description: 'Optional slice id. Defaults to the first slice.' })),
});

type ExecuteCookSliceStartParams = Static<typeof ExecuteCookSliceStartParams>;

interface ExecuteCookSliceStartDetails {
  readonly result: CookSliceStartResult;
  readonly sideEffects: CookSliceStartResult['sideEffects'];
}

export function createExecuteCookSliceStartTool(): ToolDefinition<
  typeof ExecuteCookSliceStartParams,
  ExecuteCookSliceStartDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_SLICE_START_TOOL,
    label: 'execute_cook_slice_start',
    description:
      'Append a slice-start marker for a ready cook run. Does not execute agents, tests, or Petri transitions.',
    parameters: ExecuteCookSliceStartParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_slice_start requires an active cwd');
      }
      const result = await startCookSlice({
        cwd,
        runId: params.runId,
        ...(params.sliceId ? { sliceId: params.sliceId } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_slice_start: ${result.status}`,
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

export function registerBrunchExecuteCookSliceStart(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookSliceStartTool() as never);
}

export default registerBrunchExecuteCookSliceStart;
