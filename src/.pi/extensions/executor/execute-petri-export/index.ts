import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { petrinautLaunchPathForRun, petrinautStreamPathForRun } from '../../../../executor/observer-read.js';
import { exportPetri, type PetriExportResult } from '../../../../executor/petri.js';
import { BRUNCH_EXECUTE_PETRI_EXPORT_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PETRI_EXPORT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePetriExportParams = Type.Object({ runId: Type.String() });
type ExecutePetriExportParams = Static<typeof ExecutePetriExportParams>;
interface ExecutePetriExportDetails {
  readonly result: PetriExportResult;
  readonly sideEffects: PetriExportResult['sideEffects'];
}

export function createExecutePetriExportTool() {
  return defineBrunchTool<typeof ExecutePetriExportParams, ExecutePetriExportDetails>({
    name: BRUNCH_EXECUTE_PETRI_EXPORT_TOOL,
    label: 'execute_petri_export',
    description: 'Export a minimal Petri artifact for a completed cook run. Does not promote or land.',
    parameters: toolParameters(ExecutePetriExportParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0)
        throw new Error('execute_petri_export requires an active cwd');
      const result = await exportPetri({ cwd, runId: params.runId });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_petri_export: ${result.status}`,
              `run status: ${result.runStatus}`,
              `run id: ${result.runId}`,
              ...petriArtifactLines(result),
              `side effects: ${result.sideEffects.map((effect) => effect.kind).join(', ') || 'none'}`,
            ].join('\n'),
          },
        ],
        details: { result, sideEffects: result.sideEffects },
      };
    },
  });
}

function petriArtifactLines(result: PetriExportResult): readonly string[] {
  if (result.status !== 'petri_exported') return [];
  return [
    `net: ${result.petriPath}`,
    `sdcpn: ${result.petriSdcpnPath}`,
    `sse: ${petrinautStreamPathForRun(result.runId)}`,
    `launch: ${petrinautLaunchPathForRun(result.runId)}`,
  ];
}

export function registerBrunchExecutePetriExport(pi: ExtensionAPI): void {
  pi.registerTool(createExecutePetriExportTool() as never);
}
export default registerBrunchExecutePetriExport;
