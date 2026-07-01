import type { ExtensionAPI, ToolDefinition } from '@earendil-works/pi-coding-agent';
import { Type, type Static } from 'typebox';

import { BRUNCH_EXECUTE_STATUS_TOOL } from '../../../../session/schema/tool-names.js';

export { BRUNCH_EXECUTE_STATUS_TOOL } from '../../../../session/schema/tool-names.js';

const ExecuteStatusParams = Type.Object({
  discipline: Type.Optional(
    Type.Union([Type.Literal('strict'), Type.Literal('interpretive')], {
      description: 'Execution posture to inspect. Defaults to strict.',
    }),
  ),
});

type ExecuteStatusParams = Static<typeof ExecuteStatusParams>;

interface ExecuteStatusDetails {
  readonly discipline: 'strict' | 'interpretive';
  readonly availableDisciplines: readonly ['strict', 'interpretive'];
  readonly portedTools: readonly [
    'execute_status',
    'execute_snapshot',
    'execute_plan_preview',
    'execute_plan_check',
    'execute_plan_draft',
    'execute_plan_outline',
  ];
  readonly inactiveRegisteredTools: readonly string[];
  readonly pendingTools: readonly ['cook', 'land'];
  readonly sideEffects: readonly [];
}

export function createExecuteStatusTool(): ToolDefinition<typeof ExecuteStatusParams, ExecuteStatusDetails> {
  return {
    name: BRUNCH_EXECUTE_STATUS_TOOL,
    label: 'execute_status',
    description:
      'Report the current native execute-mode orchestration foothold. Side-effect free: creates no plans, runs, worktrees, or graph mutations.',
    parameters: ExecuteStatusParams,
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      const discipline = params.discipline ?? 'strict';
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `execute_status: ${discipline}`,
              'available disciplines: strict, interpretive',
              'ported active tools: execute_status, execute_snapshot, execute_plan_check, execute_plan_outline, execute_plan_draft, execute_plan_preview',
              'inactive registered tools: execute_plan_outline_artifact, execute_plan_draft_artifact, execute_plan_file, execute_launch, execute_run_create, execute_worktree_create, execute_populate, execute_source_policy, execute_source_copy, execute_report_init, execute_slice_start, execute_slice_execute, execute_agent_result, execute_test_result, execute_slice_complete, execute_run_complete, execute_petri_export, execute_promotion_prepare',
              'pending tools: cook, land',
              'cook execution: descriptive scaffold registered but inactive until the real-execution stack lands',
              'side effects: none',
            ].join('\n'),
          },
        ],
        details: {
          discipline,
          availableDisciplines: ['strict', 'interpretive'],
          portedTools: [
            'execute_status',
            'execute_snapshot',
            'execute_plan_preview',
            'execute_plan_check',
            'execute_plan_draft',
            'execute_plan_outline',
          ],
          inactiveRegisteredTools: [
            'execute_plan_outline_artifact',
            'execute_plan_draft_artifact',
            'execute_plan_file',
            'execute_launch',
            'execute_run_create',
            'execute_worktree_create',
            'execute_populate',
            'execute_source_policy',
            'execute_source_copy',
            'execute_report_init',
            'execute_slice_start',
            'execute_slice_execute',
            'execute_agent_result',
            'execute_test_result',
            'execute_slice_complete',
            'execute_run_complete',
            'execute_petri_export',
            'execute_promotion_prepare',
          ],
          pendingTools: ['cook', 'land'],
          sideEffects: [],
        },
      };
    },
  };
}

export function registerBrunchExecuteStatus(pi: ExtensionAPI): void {
  pi.registerTool(createExecuteStatusTool() as never);
}

export default registerBrunchExecuteStatus;
