import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { GitSliceIntegrationPort } from '../../../../executor/execution-ports.js';
import { completeSlice, type SliceCompleteResult } from '../../../../executor/slice-complete.js';
import { integrateSlice, type SliceIntegrationResult } from '../../../../executor/slice-integration.js';
import { BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteSliceCompleteParams = Type.Object({
  runId: Type.String({ description: 'Run id whose active slice has ingested test results.' }),
});

type ExecuteSliceCompleteParams = Static<typeof ExecuteSliceCompleteParams>;

interface ExecuteSliceCompleteDetails {
  readonly result: SliceCompleteResult | SliceIntegrationResult;
  readonly sideEffects: readonly { readonly kind: string }[];
}

export function createExecuteSliceCompleteTool(gitSliceIntegration: GitSliceIntegrationPort) {
  return defineBrunchTool<typeof ExecuteSliceCompleteParams, ExecuteSliceCompleteDetails>({
    name: BRUNCH_EXECUTE_SLICE_COMPLETE_TOOL,
    label: 'execute_slice_complete',
    description:
      'Integrate verified slice output into the run workspace, then mark the active slice complete. Conflicts halt without mutating the run workspace.',
    parameters: toolParameters(ExecuteSliceCompleteParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_slice_complete requires an active cwd');
      }
      const integration = await integrateSlice({
        cwd,
        runId: params.runId,
        gitSliceIntegration,
      });
      const completion =
        integration.status === 'slice_integrated' || integration.status === 'slice_not_ready'
          ? await completeSlice({ cwd, runId: params.runId })
          : undefined;
      const result = completion ?? integration;
      const sideEffects = completion
        ? [...integration.sideEffects, ...completion.sideEffects]
        : integration.sideEffects;
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_slice_complete: ${result.status}`,
              `run status: ${result.runStatus}`,
              `run id: ${params.runId}`,
              `side effects: ${sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects },
      };
    },
  });
}

export function registerBrunchExecuteSliceComplete(
  pi: ExtensionAPI,
  gitSliceIntegration: GitSliceIntegrationPort,
): void {
  pi.registerTool(createExecuteSliceCompleteTool(gitSliceIntegration) as never);
}

export default registerBrunchExecuteSliceComplete;
