import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { createCookRun, type CookRunCreateResult } from '../../../../executor/cook-run.js';
import { BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookRunCreateParams = Type.Object({
  runId: Type.Optional(
    Type.String({ description: 'Optional deterministic run id. Defaults to a generated id.' }),
  ),
});

type ExecuteCookRunCreateParams = Static<typeof ExecuteCookRunCreateParams>;

interface ExecuteCookRunCreateDetails {
  readonly result: CookRunCreateResult;
  readonly sideEffects: CookRunCreateResult['sideEffects'];
}

export interface ExecuteCookRunCreateDeps {
  readonly specId: number;
}

export function createExecuteCookRunCreateTool(
  deps: ExecuteCookRunCreateDeps,
): ToolDefinition<typeof ExecuteCookRunCreateParams, ExecuteCookRunCreateDetails> {
  return {
    name: BRUNCH_EXECUTE_COOK_RUN_CREATE_TOOL,
    label: 'execute_cook_run_create',
    description:
      'Create metadata for a cook run from the selected spec plan. Does not create worktrees, Petri artifacts, or execute slices.',
    parameters: ExecuteCookRunCreateParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_run_create requires an active cwd');
      }
      const result = await createCookRun({
        cwd,
        specId: String(deps.specId),
        ...(params.runId ? { runId: params.runId } : {}),
      });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_run_create: ${result.status}`,
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

export function registerBrunchExecuteCookRunCreate(pi: ExtensionAPI, deps: ExecuteCookRunCreateDeps): void {
  pi.registerTool(createExecuteCookRunCreateTool(deps) as never);
}

export default registerBrunchExecuteCookRunCreate;
