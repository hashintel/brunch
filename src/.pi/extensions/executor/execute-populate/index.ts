import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { populateWorktree, type PopulateResult } from '../../../../executor/populate.js';
import { BRUNCH_EXECUTE_POPULATE_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_POPULATE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePopulateParams = Type.Object({
  runId: Type.String({ description: 'Run id whose empty worktree already exists.' }),
});

type ExecutePopulateParams = Static<typeof ExecutePopulateParams>;

interface ExecutePopulateDetails {
  readonly result: PopulateResult;
  readonly sideEffects: PopulateResult['sideEffects'];
}

export function createExecutePopulateTool() {
  return defineBrunchTool<typeof ExecutePopulateParams, ExecutePopulateDetails>({
    name: BRUNCH_EXECUTE_POPULATE_TOOL,
    label: 'execute_populate',
    description:
      'Populate an existing cook worktree with the selected plan source only. Does not copy host source, execute slices, or create Petri artifacts.',
    parameters: toolParameters(ExecutePopulateParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_populate requires an active cwd');
      }
      const result = await populateWorktree({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_populate: ${result.status}`,
              `run status: ${result.runStatus}`,
              `run id: ${result.runId}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  });
}

export function registerBrunchExecutePopulate(pi: ExtensionAPI): void {
  pi.registerTool(createExecutePopulateTool() as never);
}

export default registerBrunchExecutePopulate;
