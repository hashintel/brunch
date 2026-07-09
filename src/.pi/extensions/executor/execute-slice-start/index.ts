import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { startSlice, type SliceStartResult } from '../../../../executor/slice-start.js';
import { BRUNCH_EXECUTE_SLICE_START_TOOL } from '../../../../session/schema/tool-names.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_SLICE_START_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSliceStartParams = Type.Object({
  runId: Type.String({ description: 'Run id whose report log is initialized.' }),
  sliceId: Type.Optional(Type.String({ description: 'Optional slice id. Defaults to the first slice.' })),
});

type ExecuteSliceStartParams = Static<typeof ExecuteSliceStartParams>;

interface ExecuteSliceStartDetails {
  readonly result: SliceStartResult;
  readonly sideEffects: SliceStartResult['sideEffects'];
}

export function createExecuteSliceStartTool(): ToolDefinition<
  typeof ExecuteSliceStartParams,
  ExecuteSliceStartDetails
> {
  return {
    name: BRUNCH_EXECUTE_SLICE_START_TOOL,
    label: 'execute_slice_start',
    description:
      'Append a slice-start marker for a ready cook run. Does not execute agents, tests, or Petri transitions.',
    parameters: toolParameters(ExecuteSliceStartParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_slice_start requires an active cwd');
      }
      const result = await startSlice({
        cwd,
        runId: params.runId,
        ...(params.sliceId ? { sliceId: params.sliceId } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_slice_start: ${result.status}`,
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

export function registerBrunchExecuteSliceStart(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteSliceStartTool() as never);
}

export default registerBrunchExecuteSliceStart;
