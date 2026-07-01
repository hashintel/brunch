import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { initializeCookReports, type CookReportInitResult } from '../../../../executor/report.js';
import { BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookReportInitParams = Type.Object({
  runId: Type.String({ description: 'Cook run id whose host source has been copied.' }),
});

type ExecuteCookReportInitParams = Static<typeof ExecuteCookReportInitParams>;

interface ExecuteCookReportInitDetails {
  readonly result: CookReportInitResult;
  readonly sideEffects: CookReportInitResult['sideEffects'];
}

export function createExecuteCookReportInitTool(): ToolDefinition<
  typeof ExecuteCookReportInitParams,
  ExecuteCookReportInitDetails
> {
  return {
    name: BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL,
    label: 'execute_cook_report_init',
    description:
      'Initialize reports.jsonl for a source-copied cook run. Does not execute slices or create Petri artifacts.',
    parameters: ExecuteCookReportInitParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_report_init requires an active cwd');
      }
      const result = await initializeCookReports({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_report_init: ${result.status}`,
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

export function registerBrunchExecuteCookReportInit(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookReportInitTool() as never);
}

export default registerBrunchExecuteCookReportInit;
