import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { completeRun, type RunCompleteResult } from '../../../../executor/run-complete.js';
import { BRUNCH_EXECUTE_RUN_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_RUN_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteRunCompleteParams = Type.Object({ runId: Type.String() });
type ExecuteRunCompleteParams = Static<typeof ExecuteRunCompleteParams>;
interface ExecuteRunCompleteDetails {
  readonly result: RunCompleteResult;
  readonly sideEffects: RunCompleteResult['sideEffects'];
}

export function createExecuteRunCompleteTool() {
  return defineBrunchTool<typeof ExecuteRunCompleteParams, ExecuteRunCompleteDetails>({
    name: BRUNCH_EXECUTE_RUN_COMPLETE_TOOL,
    label: 'execute_run_complete',
    description:
      'Mark a cook run complete after all slices are complete. Does not create Petri artifacts, promote, or land.',
    parameters: toolParameters(ExecuteRunCompleteParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_run_complete requires an active cwd');
      const result = await completeRun({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_run_complete: ${result.status}`,
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

export function registerBrunchExecuteRunComplete(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteRunCompleteTool() as never);
}

export default registerBrunchExecuteRunComplete;
