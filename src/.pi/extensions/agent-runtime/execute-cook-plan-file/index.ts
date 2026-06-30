import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { writeCookPlanFile } from '../../../../orchestration/cook-plan-file.js';
import type { CookPlanPreview } from '../../../../orchestration/cook-plan-preview.js';
import { projectExecuteGraph } from '../../../../orchestration/execute-projection.js';
import { BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

export { BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteCookPlanFileParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the cook plan file. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecuteCookPlanFileParams = Static<typeof ExecuteCookPlanFileParams>;

interface ExecuteCookPlanFileDetails {
  readonly preview: CookPlanPreview;
  readonly artifact: { readonly path: string; readonly writeMode: 'overwrite' };
  readonly source: { readonly graphLsn: number; readonly visibility: 'active' };
  readonly sideEffects: readonly [{ readonly kind: 'write_file'; readonly path: string }];
}

export interface ExecuteCookPlanFileDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecuteCookPlanFileTool(
  deps: ExecuteCookPlanFileDeps,
): ToolDefinition<typeof ExecuteCookPlanFileParams, ExecuteCookPlanFileDetails> {
  return {
    name: BRUNCH_EXECUTE_COOK_PLAN_FILE_TOOL,
    label: 'execute_cook_plan_file',
    description:
      'Write an old-cook-compatible plan.yaml under .brunch/cook/specs/<specId>. Does not create cook runs or worktrees.',
    parameters: ExecuteCookPlanFileParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_cook_plan_file requires an active cwd');
      }
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const preview = projection.cookPlanPreview;
      const artifact = await writeCookPlanFile({ cwd, preview });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_cook_plan_file: ${artifact.path}`,
              `epics: ${preview.epics.length}`,
              `slices: ${preview.slices.length}`,
              `graph lsn: ${graph.lsn}`,
              `side effects: ${artifact.sideEffects.map((effect) => effect.kind).join(', ')}`,
            ].join('\n'),
          },
        ],
        details: {
          preview,
          artifact: { path: artifact.path, writeMode: artifact.writeMode },
          source: projection.source,
          sideEffects: artifact.sideEffects,
        },
      };
    },
  };
}

export function registerBrunchExecuteCookPlanFile(pi: ExtensionAPI, deps: ExecuteCookPlanFileDeps): void {
  pi.registerTool(createExecuteCookPlanFileTool(deps) as never);
}

export default registerBrunchExecuteCookPlanFile;
