import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import type { ExecutablePlanDraft } from '../../../../executor/executable-plan-draft.js';
import {
  assertExecuteProjectionPlanReady,
  projectExecuteGraph,
} from '../../../../executor/execute-projection.js';
import { BRUNCH_EXECUTE_PLAN_DRAFT_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_DRAFT_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanDraftParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the draft. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanDraftParams = Static<typeof ExecutePlanDraftParams>;

interface ExecutePlanDraftDetails {
  readonly draft: ExecutablePlanDraft;
  readonly source: {
    readonly graphLsn: number;
    readonly visibility: 'active';
  };
  readonly sideEffects: readonly [];
}

export interface ExecutePlanDraftDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanDraftTool(
  deps: ExecutePlanDraftDeps,
): ToolDefinition<typeof ExecutePlanDraftParams, ExecutePlanDraftDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
    label: 'execute_plan_draft',
    description:
      'Create a side-effect-free executable-plan draft from the selected specification graph. Does not write plan files or create cook runs.',
    parameters: toolParameters(ExecutePlanDraftParams),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
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
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_draft: spec ${draft.specId} (${draft.mode})`,
              `epics: ${draft.epics.length}`,
              `slices: ${draft.slices.length}`,
              `graph lsn: ${graph.lsn}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: {
          draft,
          source: projection.source,
          sideEffects: [],
        },
      };
    },
  };
}

export function registerBrunchExecutePlanDraft(pi: ExtensionAPI, deps: ExecutePlanDraftDeps): void {
  pi.registerTool(createExecutePlanDraftTool(deps) as never);
}

export default registerBrunchExecutePlanDraft;
