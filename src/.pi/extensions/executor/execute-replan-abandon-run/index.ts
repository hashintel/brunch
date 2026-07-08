import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { abandonRun, type RunAbandonResult } from '../../../../executor/run-abandon.js';
import { BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteReplanAbandonRunParams = Type.Object({
  runId: Type.String({ description: 'Executor run id to mark abandoned.' }),
  reason: Type.Optional(Type.String({ description: 'Optional human reason for abandoning the run.' })),
});

type ExecuteReplanAbandonRunParams = Static<typeof ExecuteReplanAbandonRunParams>;

interface ExecuteReplanAbandonRunDetails {
  readonly result: RunAbandonResult;
  readonly sideEffects: RunAbandonResult['sideEffects'];
}

export function createExecuteReplanAbandonRunTool(): ToolDefinition<
  typeof ExecuteReplanAbandonRunParams,
  ExecuteReplanAbandonRunDetails
> {
  return {
    name: BRUNCH_EXECUTE_REPLAN_ABANDON_RUN_TOOL,
    label: 'execute_replan_abandon_run',
    description:
      'Mark an active executor run abandoned without deleting worktrees, reports, Petri artifacts, promotions, or graph state.',
    parameters: ExecuteReplanAbandonRunParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_replan_abandon_run requires an active cwd');
      }

      const result = await abandonRun({
        cwd,
        runId: params.runId,
        ...(params.reason ? { reason: params.reason } : {}),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_replan_abandon_run: ${result.status}`,
              `run status: ${result.runStatus}`,
              `run id: ${params.runId}`,
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  };
}

export function registerBrunchExecuteReplanAbandonRun(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteReplanAbandonRunTool() as never);
}

export default registerBrunchExecuteReplanAbandonRun;
