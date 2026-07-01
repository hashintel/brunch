import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { completeCookRun, type CookRunCompleteResult } from '../../../../executor/cook-run-complete.js';
import { BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookRunCompleteParams = Type.Object({ runId: Type.String() });
type ExecuteCookRunCompleteParams = Static<typeof ExecuteCookRunCompleteParams>;
interface ExecuteCookRunCompleteDetails {
  readonly result: CookRunCompleteResult;
  readonly sideEffects: CookRunCompleteResult['sideEffects'];
}

export function createExecuteCookRunCompleteTool(): ToolDefinition<
  typeof ExecuteCookRunCompleteParams,
  ExecuteCookRunCompleteDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_RUN_COMPLETE_TOOL,
    label: 'execute_cook_run_complete',
    description:
      'Mark a cook run complete after all slices are complete. Does not create Petri artifacts, promote, or land.',
    parameters: ExecuteCookRunCompleteParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_cook_run_complete requires an active cwd');
      const result = await completeCookRun({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_run_complete: ${result.status}`,
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

export function registerBrunchExecuteCookRunComplete(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookRunCompleteTool() as never);
}

export default registerBrunchExecuteCookRunComplete;
