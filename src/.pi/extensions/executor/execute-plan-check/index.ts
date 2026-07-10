import { Type, type Static } from 'typebox';

import type { ExecutePlanCheckResult } from '../../../../executor/execute-plan-check.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { GraphReaders } from '../../brunch-data/graph/index.js';
import { BRUNCH_EXECUTE_PLAN_CHECK_TOOL } from '../../../../session/schema/tool-names.js';
import { defineBrunchTool } from '../../shared/define-brunch-tool.js';
import { projectExecuteGraph } from '../../../../executor/execute-projection.js';
import { renderExecutePlanCheckResult } from '../rendering.js';
import { toolParameters } from '../../shared/tool-schema.js';

export { BRUNCH_EXECUTE_PLAN_CHECK_TOOL } from '../../../../session/schema/tool-names.js';

const ExecutePlanCheckParams = Type.Object({
  mode: Type.Optional(
    Type.Union([Type.Literal('greenfield'), Type.Literal('brownfield')], {
      description:
        'Execution mode carried onto the checked snapshot. Defaults to greenfield until spec mode is modeled on alpha.',
    }),
  ),
});

type ExecutePlanCheckParams = Static<typeof ExecutePlanCheckParams>;

interface ExecutePlanCheckDetails {
  readonly check: ExecutePlanCheckResult;
  readonly source: {
    readonly graphLsn: number;
    readonly visibility: 'active';
  };
  readonly sideEffects: readonly [];
}

export interface ExecutePlanCheckDeps {
  readonly specId: number;
  readonly reads: Pick<GraphReaders, 'queryGraph'>;
}

export function createExecutePlanCheckTool(deps: ExecutePlanCheckDeps) {
  return defineBrunchTool<typeof ExecutePlanCheckParams, ExecutePlanCheckDetails>({
    name: BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
    label: 'execute_plan_check',
    description:
      'Check whether the selected specification graph has enough ExecutionSpecSnapshot coverage to become plan input. Side-effect free.',
    parameters: toolParameters(ExecutePlanCheckParams),
    renderResult(result, options, theme, context) {
      return renderExecutePlanCheckResult(result, options, theme as never, context);
    },
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const projection = projectExecuteGraph({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        graphLsn: graph.lsn,
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const check = projection.check;
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_plan_check: ${check.status}`,
              `requirements: ${check.counts.requirements}`,
              `criteria: ${check.counts.criteria}`,
              `verified requirements: ${check.counts.verifiedRequirements}`,
              `findings: ${check.findings.length}`,
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: {
          check,
          source: projection.source,
          sideEffects: [],
        },
      };
    },
  });
}

export function registerBrunchExecutePlanCheck(pi: ExtensionAPI, deps: ExecutePlanCheckDeps): void {
  pi.registerTool(createExecutePlanCheckTool(deps) as never);
}

export default registerBrunchExecutePlanCheck;
