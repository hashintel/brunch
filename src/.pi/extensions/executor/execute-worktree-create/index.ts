import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { GitWorktreePort } from '../../../../executor/execution-ports.js';
import { createWorktree, type WorktreeCreateResult } from '../../../../executor/worktree.js';
import { BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL } from '../../../../session/schema/tool-names.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteWorktreeCreateParams = Type.Object({
  runId: Type.String({ description: 'Run id whose metadata already exists.' }),
});

type ExecuteWorktreeCreateParams = Static<typeof ExecuteWorktreeCreateParams>;

interface ExecuteWorktreeCreateDetails {
  readonly result: WorktreeCreateResult;
  readonly sideEffects: WorktreeCreateResult['sideEffects'];
}

export function createExecuteWorktreeCreateTool(
  gitWorktree: GitWorktreePort,
): ToolDefinition<typeof ExecuteWorktreeCreateParams, ExecuteWorktreeCreateDetails> {
  return {
    name: BRUNCH_EXECUTE_WORKTREE_CREATE_TOOL,
    label: 'execute_worktree_create',
    description:
      'Create the git worktree for an existing cook run. Does not populate it, execute slices, or create Petri artifacts.',
    parameters: toolParameters(ExecuteWorktreeCreateParams),
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_worktree_create requires an active cwd');
      }
      const result = await createWorktree({ cwd, runId: params.runId, gitWorktree, signal });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_worktree_create: ${result.status}`,
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

export function registerBrunchExecuteWorktreeCreate(pi: ExtensionAPI, gitWorktree: GitWorktreePort): void {
  pi.registerTool(createExecuteWorktreeCreateTool(gitWorktree) as never);
}

export default registerBrunchExecuteWorktreeCreate;
