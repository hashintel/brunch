import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { copyHostSource, type SourceCopyResult } from '../../../../executor/source-copy.js';
import { BRUNCH_EXECUTE_SOURCE_COPY_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_SOURCE_COPY_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSourceCopyParams = Type.Object({
  runId: Type.String({ description: 'Run id with selected host source policy.' }),
});

type ExecuteSourceCopyParams = Static<typeof ExecuteSourceCopyParams>;

interface ExecuteSourceCopyDetails {
  readonly result: SourceCopyResult;
  readonly sideEffects: SourceCopyResult['sideEffects'];
}

export function createExecuteSourceCopyTool(): ToolDefinition<
  typeof ExecuteSourceCopyParams,
  ExecuteSourceCopyDetails
> {
  return {
    name: BRUNCH_EXECUTE_SOURCE_COPY_TOOL,
    label: 'execute_source_copy',
    description:
      'Copy bounded host source entries into the cook worktree. Does not execute slices or create Petri/report artifacts.',
    parameters: ExecuteSourceCopyParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_source_copy requires an active cwd');
      }
      const result = await copyHostSource({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_source_copy: ${result.status}`,
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

export function registerBrunchExecuteSourceCopy(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteSourceCopyTool() as never);
}

export default registerBrunchExecuteSourceCopy;
