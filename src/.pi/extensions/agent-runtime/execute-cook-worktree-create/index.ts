import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { createCookWorktree, type CookWorktreeCreateResult } from '../../../../executor/cook-worktree.js';
import { BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookWorktreeCreateParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose metadata already exists.' }),
});

type ExecuteCookWorktreeCreateParams = Static<typeof ExecuteCookWorktreeCreateParams>;

interface ExecuteCookWorktreeCreateDetails {
  readonly result: CookWorktreeCreateResult;
  readonly sideEffects: CookWorktreeCreateResult['sideEffects'];
}

export function createExecuteCookWorktreeCreateTool(): ToolDefinition<
  typeof ExecuteCookWorktreeCreateParams,
  ExecuteCookWorktreeCreateDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL,
    label: 'execute_cook_worktree_create',
    description:
      'Create the empty worktree directory for an existing cook run. Does not populate it, execute slices, or create Petri artifacts.',
    parameters: ExecuteCookWorktreeCreateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_worktree_create requires an active cwd');
      }
      const result = await createCookWorktree({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_worktree_create: ${result.status}`,
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

export function registerBrunchExecuteCookWorktreeCreate(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookWorktreeCreateTool() as never);
}

export default registerBrunchExecuteCookWorktreeCreate;
