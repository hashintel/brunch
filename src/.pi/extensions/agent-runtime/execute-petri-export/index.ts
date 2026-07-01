import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { exportCookPetri, type CookPetriExportResult } from '../../../../executor/petri.js';
import { BRUNCH_EXECUTE_PETRI_EXPORT_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_PETRI_EXPORT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookPetriExportParams = Type.Object({ runId: Type.String() });
type ExecuteCookPetriExportParams = Static<typeof ExecuteCookPetriExportParams>;
interface ExecuteCookPetriExportDetails {
  readonly result: CookPetriExportResult;
  readonly sideEffects: CookPetriExportResult['sideEffects'];
}

export function createExecuteCookPetriExportTool(): ToolDefinition<
  typeof ExecuteCookPetriExportParams,
  ExecuteCookPetriExportDetails
> {
  return {
    name: BRUNCH_EXECUTE_PETRI_EXPORT_TOOL,
    label: 'execute_petri_export',
    description: 'Export a minimal Petri artifact for a completed cook run. Does not promote or land.',
    parameters: ExecuteCookPetriExportParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_petri_export requires an active cwd');
      const result = await exportCookPetri({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_petri_export: ${result.status}`,
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

export function registerBrunchExecuteCookPetriExport(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteCookPetriExportTool() as never);
}
export default registerBrunchExecuteCookPetriExport;
