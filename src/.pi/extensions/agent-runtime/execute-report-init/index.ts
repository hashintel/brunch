import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { initializeReports, type ReportInitResult } from '../../../../executor/report.js';
import { BRUNCH_EXECUTE_REPORT_INIT_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_REPORT_INIT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteReportInitParams = Type.Object({
  runId: Type.String({ description: 'Run id whose host source has been copied.' }),
});

type ExecuteReportInitParams = Static<typeof ExecuteReportInitParams>;

interface ExecuteReportInitDetails {
  readonly result: ReportInitResult;
  readonly sideEffects: ReportInitResult['sideEffects'];
}

export function createExecuteReportInitTool(): ToolDefinition<
  typeof ExecuteReportInitParams,
  ExecuteReportInitDetails
> {
  return {
    name: BRUNCH_EXECUTE_REPORT_INIT_TOOL,
    label: 'execute_report_init',
    description:
      'Initialize reports.jsonl for a source-copied cook run. Does not execute slices or create Petri artifacts.',
    parameters: ExecuteReportInitParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_report_init requires an active cwd');
      }
      const result = await initializeReports({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_report_init: ${result.status}`,
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

export function registerBrunchExecuteReportInit(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteReportInitTool() as never);
}

export default registerBrunchExecuteReportInit;
