import { LIVE_ELICITOR_ALLOWED_TOOL_NAMES } from '../elicitor/active-tools.js';
import { withoutBrunchBlockedToolNames } from '../shared/blocked-tools.js';

export interface ExecutorToolPolicyInput {
  readonly registeredToolNames: readonly string[];
}

export const EXECUTOR_ALLOWED_TOOL_NAMES = [
  ...LIVE_ELICITOR_ALLOWED_TOOL_NAMES,
  // Execute-mode orchestration tools (FE-1089..FE-1118). Registered tools are
  // inactive unless admitted here; side-effect-bounded per I58-L.
  'execute_status',
  // Run driver over the lifecycle steps (FE-1125, D112-L).
  'execute_orchestrate',
  'execute_snapshot',
  'execute_plan_check',
  'execute_plan_outline',
  'execute_plan_draft',
  'execute_plan_preview',
  'execute_plan_file',
  'execute_launch',
  'execute_run_create',
  'execute_replan_recommendation',
  'execute_replan_start_new_run',
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
  'execute_host_promotion_preflight',
  'execute_host_promotion_apply',
] as const;

export function activeToolNamesForExecutor({ registeredToolNames }: ExecutorToolPolicyInput): string[] {
  const allowed = new Set<string>(EXECUTOR_ALLOWED_TOOL_NAMES);
  return withoutBrunchBlockedToolNames(registeredToolNames.filter((toolName) => allowed.has(toolName)));
}
