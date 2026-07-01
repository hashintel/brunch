import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { populateCookWorktree, type CookPopulateResult } from '../../../../executor/cook-populate.js';
import { BRUNCH_EXECUTE_COOK_POPULATE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_POPULATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookPopulateParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose empty worktree already exists.' }),
});

type ExecuteCookPopulateParams = Static<typeof ExecuteCookPopulateParams>;

interface ExecuteCookPopulateDetails {
  readonly result: CookPopulateResult;
  readonly sideEffects: CookPopulateResult['sideEffects'];
}

export function createExecuteCookPopulateTool(): ToolDefinition<
  typeof ExecuteCookPopulateParams,
  ExecuteCookPopulateDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_POPULATE_TOOL,
    label: 'execute_cook_populate',
    description:
      'Populate an existing cook worktree with the selected plan source only. Does not copy host source, execute slices, or create Petri artifacts.',
    parameters: ExecuteCookPopulateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_populate requires an active cwd');
      }
      const result = await populateCookWorktree({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_populate: ${result.status}`,
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

export function registerBrunchExecuteCookPopulate(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookPopulateTool() as never);
}

export default registerBrunchExecuteCookPopulate;
