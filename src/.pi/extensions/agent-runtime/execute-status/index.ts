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
    'execute_cook_agent_result',
    'execute_cook_launch',
    'execute_cook_plan_file',
    'execute_cook_plan_preview',
    'execute_cook_populate',
    'execute_cook_report_init',
    'execute_cook_run_complete',
    'execute_cook_run_create',
    'execute_cook_source_policy',
    'execute_cook_source_copy',
    'execute_cook_slice_complete',
    'execute_cook_slice_start',
    'execute_cook_slice_execute',
    'execute_cook_worktree_create',
    'execute_plan_check',
    'execute_plan_draft',
    'execute_plan_draft_artifact',
    'execute_plan_outline',
    'execute_plan_outline_artifact',
  ];
  readonly pendingTools: readonly ['cook_petri', 'land'];
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
              'ported tools: execute_status, execute_snapshot, execute_cook_agent_result, execute_cook_launch, execute_cook_plan_file, execute_cook_plan_preview, execute_cook_populate, execute_cook_report_init, execute_cook_run_complete, execute_cook_run_create, execute_cook_source_policy, execute_cook_source_copy, execute_cook_slice_complete, execute_cook_slice_start, execute_cook_slice_execute, execute_cook_worktree_create, execute_plan_check, execute_plan_draft, execute_plan_draft_artifact, execute_plan_outline, execute_plan_outline_artifact',
              'pending tools: cook_petri, land',
              'cook execution: slice completion only; Petri not ported',
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
            'execute_cook_agent_result',
            'execute_cook_launch',
            'execute_cook_plan_file',
            'execute_cook_plan_preview',
            'execute_cook_populate',
            'execute_cook_report_init',
            'execute_cook_run_complete',
            'execute_cook_run_create',
            'execute_cook_source_policy',
            'execute_cook_source_copy',
            'execute_cook_slice_complete',
            'execute_cook_slice_start',
            'execute_cook_slice_execute',
            'execute_cook_worktree_create',
            'execute_plan_check',
            'execute_plan_draft',
            'execute_plan_draft_artifact',
            'execute_plan_outline',
            'execute_plan_outline_artifact',
          ],
          pendingTools: ['cook_petri', 'land'],
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
