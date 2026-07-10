import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../../executor/execute-projection.js';
import { writePlanFile } from '../../../../executor/plan-file.js';
import type { PlanPreview } from '../../../../executor/plan-preview.js';
import { BRUNCH_EXECUTE_PLAN_FILE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_FILE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanFileParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the cook plan file. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanFileParams = Static<typeof ExecutePlanFileParams>;

interface ExecutePlanFileDetails {
  readonly preview: PlanPreview;
  readonly artifact: {
    readonly path: string;
    readonly provenancePath: string;
    readonly writeMode: 'overwrite';
  };
  readonly source: { readonly graphLsn: number; readonly visibility: 'active' };
  readonly sideEffects: readonly { readonly kind: 'write_file'; readonly path: string }[];
}

export interface ExecutePlanFileDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanFileTool(
  deps: ExecutePlanFileDeps,
): ToolDefinition<typeof ExecutePlanFileParams, ExecutePlanFileDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_FILE_TOOL,
    label: 'execute_plan_file',
    description:
      'Write an old-cook-compatible plan.yaml under .brunch/cook/specs/<specId>. Does not create cook runs or worktrees.',
    parameters: toolParameters(ExecutePlanFileParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_plan_file requires an active cwd');
      }
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      assertExecuteProjectionPlanReady(projection);
      const preview = projection.planPreview;
      const artifact = await writePlanFile({ cwd, preview, source: projection.source });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_file: ${artifact.path}`,
              `epics: ${preview.epics.length}`,
              `slices: ${preview.slices.length}`,
              `graph lsn: ${graph.lsn}`,
              `side effects: ${artifact.sideEffects.map((effect) => effect.kind).join(', ')}`,
            ].join('\n'),
          },
        ],
        details: {
          preview,
          artifact: {
            path: artifact.path,
            provenancePath: artifact.provenancePath,
            writeMode: artifact.writeMode,
          },
          source: projection.source,
          sideEffects: artifact.sideEffects,
        },
      };
    },
  };
}

export function registerBrunchExecutePlanFile(pi: ExtensionAPI, deps: ExecutePlanFileDeps): void {
  pi.registerTool(createExecutePlanFileTool(deps) as never);
}

export default registerBrunchExecutePlanFile;
