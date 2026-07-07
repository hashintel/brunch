import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { createRun, type RunCreateResult } from '../../../../executor/run.js';
import { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteRunCreateParams = Type.Object({
  runId: Type.Optional(
    Type.String({ description: 'Optional deterministic run id. Defaults to a generated id.' }),
  ),
});

type ExecuteRunCreateParams = Static<typeof ExecuteRunCreateParams>;

interface ExecuteRunCreateDetails {
  readonly result: RunCreateResult;
  readonly sideEffects: RunCreateResult['sideEffects'];
}

export interface ExecuteRunCreateDeps {
  readonly specId: number;
}

export function createExecuteRunCreateTool(
  deps: ExecuteRunCreateDeps,
): ToolDefinition<typeof ExecuteRunCreateParams, ExecuteRunCreateDetails> {
  return {
    name: BRUNCH_EXECUTE_RUN_CREATE_TOOL,
    label: 'execute_run_create',
    description:
      'Create metadata for a cook run from the selected spec plan. Does not create worktrees, Petri artifacts, or execute slices.',
    parameters: ExecuteRunCreateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_run_create requires an active cwd');
      }
      const result = await createRun({
        cwd,
        specId: String(deps.specId),
        ...(params.runId ? { runId: params.runId } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_run_create: ${result.status}`,
              `run status: ${result.runStatus}`,
              `plan path: ${result.planPath}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteRunCreate(pi: ExtensionAPI, deps: ExecuteRunCreateDeps): void {
  pi.registerTool(createExecuteRunCreateTool(deps) as never);
}

export default registerBrunchExecuteRunCreate;
