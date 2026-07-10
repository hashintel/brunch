import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { writeExecutablePlanDraftArtifact } from '../../../../executor/executable-plan-draft-artifact.js';
import type { ExecutablePlanDraft } from '../../../../executor/executable-plan-draft.js';
import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../../executor/execute-projection.js';
import { BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanDraftArtifactParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the draft artifact. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanDraftArtifactParams = Static<typeof ExecutePlanDraftArtifactParams>;

interface ExecutePlanDraftArtifactDetails {
  readonly draft: ExecutablePlanDraft;
  readonly artifact: { readonly path: string; readonly writeMode: 'overwrite' };
  readonly source: { readonly graphLsn: number; readonly visibility: 'active' };
  readonly sideEffects: readonly [{ readonly kind: 'write_file'; readonly path: string }];
}

export interface ExecutePlanDraftArtifactDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanDraftArtifactTool(
  deps: ExecutePlanDraftArtifactDeps,
): ToolDefinition<typeof ExecutePlanDraftArtifactParams, ExecutePlanDraftArtifactDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
    label: 'execute_plan_draft_artifact',
    description:
      'Write the current executable-plan draft artifact under .brunch/execution-reports. Does not create cook runs or worktrees.',
    parameters: toolParameters(ExecutePlanDraftArtifactParams),
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const cwd = ctx?.cwd;
      if (typeof cwd !== 'string' || cwd.trim().length === 0) {
        throw new Error('execute_plan_draft_artifact requires an active cwd');
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
      const draft = projection.draft;
      const artifact = await writeExecutablePlanDraftArtifact({ cwd, draft });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_draft_artifact: ${artifact.path}`,
              `epics: ${draft.epics.length}`,
              `slices: ${draft.slices.length}`,
              `graph lsn: ${graph.lsn}`,
              `side effects: ${artifact.sideEffects.map((effect) => effect.kind).join(', ')}`,
            ].join('\n'),
          },
        ],
        details: {
          draft,
          artifact: { path: artifact.path, writeMode: artifact.writeMode },
          source: projection.source,
          sideEffects: artifact.sideEffects,
        },
      };
    },
  };
}

export function registerBrunchExecutePlanDraftArtifact(
  pi: ExtensionAPI,
  deps: ExecutePlanDraftArtifactDeps,
): void {
  pi.registerTool(createExecutePlanDraftArtifactTool(deps) as never);
}

export default registerBrunchExecutePlanDraftArtifact;
