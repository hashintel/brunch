import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { copyCookHostSource, type CookSourceCopyResult } from '../../../../orchestration/cook-source-copy.js';
import { BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookSourceCopyParams = Type.Object({
  runId: Type.String({ description: 'Cook run id with selected host source policy.' }),
});

type ExecuteCookSourceCopyParams = Static<typeof ExecuteCookSourceCopyParams>;

interface ExecuteCookSourceCopyDetails {
  readonly result: CookSourceCopyResult;
  readonly sideEffects: CookSourceCopyResult['sideEffects'];
}

export function createExecuteCookSourceCopyTool(): ToolDefinition<
  typeof ExecuteCookSourceCopyParams,
  ExecuteCookSourceCopyDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL,
    label: 'execute_cook_source_copy',
    description:
      'Copy bounded host source entries into the cook worktree. Does not execute slices or create Petri/report artifacts.',
    parameters: ExecuteCookSourceCopyParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_source_copy requires an active cwd');
      }
      const result = await copyCookHostSource({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_source_copy: ${result.status}`,
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

export function registerBrunchExecuteCookSourceCopy(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookSourceCopyTool() as never);
}

export default registerBrunchExecuteCookSourceCopy;
