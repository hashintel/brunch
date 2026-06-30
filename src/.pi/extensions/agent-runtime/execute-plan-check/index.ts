import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import {
  checkExecutionSpecForPlan,
  type ExecutePlanCheckResult,
} from '../../../../orchestration/execute-plan-check.js';
import { projectExecutionSpecSnapshot } from '../../../../orchestration/execution-spec-snapshot.js';
import { BRUNCH_EXECUTE_PLAN_CHECK_TOOL } from '../../../../session/schema/tool-names.js';
import type { GraphReaders } from '../../brunch-data/graph/index.js';

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

export function createExecutePlanCheckTool(
  deps: ExecutePlanCheckDeps,
): ToolDefinition<typeof ExecutePlanCheckParams, ExecutePlanCheckDetails> {
  return {
    name: BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
    label: 'execute_plan_check',
    description:
      'Check whether the selected specification graph has enough ExecutionSpecSnapshot coverage to become plan input. Side-effect free.',
    parameters: ExecutePlanCheckParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const graph = deps.reads.queryGraph(undefined, { visibility: 'active' });
      const snapshot = projectExecutionSpecSnapshot({
        specId: deps.specId,
        mode: params.mode ?? 'greenfield',
        nodes: graph.nodes,
        edges: graph.edges,
      });
      const check = checkExecutionSpecForPlan(snapshot);
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
          source: { graphLsn: graph.lsn, visibility: 'active' },
          sideEffects: [],
        },
      };
    },
  };
}

export function registerBrunchExecutePlanCheck(pi: ExtensionAPI, deps: ExecutePlanCheckDeps): void {
  pi.registerTool(createExecutePlanCheckTool(deps) as never);
}

export default registerBrunchExecutePlanCheck;
