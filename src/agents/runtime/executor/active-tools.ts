export interface ExecutorToolPolicyInput {
  readonly registeredToolNames: readonly string[];
}

export const EXECUTOR_ALLOWED_TOOL_NAMES = [
  'read',
  'grep',
  'find',
  'ls',
  'read_workspace_context',
  'read_specification_context',
  'read_session_context',
  'read_graph',
  'orchestrator_stub',
  // Execute-mode orchestration footholds (FE-1089). Registered-but-inactive
  // unless the executor admits them; side-effect-bounded per I52-L.
  'execute_status',
  'execute_snapshot',
  'execute_plan_check',
  'execute_plan_outline',
  'execute_plan_outline_artifact',
  'execute_plan_draft',
  'execute_plan_draft_artifact',
  'execute_cook_plan_preview',
  'execute_cook_plan_file',
  'execute_cook_launch',
  'execute_cook_run_create',
  'execute_cook_worktree_create',
  'execute_cook_populate',
  'execute_cook_source_policy',
  'execute_cook_source_copy',
  'execute_cook_report_init',
  'execute_cook_slice_start',
  'execute_cook_slice_execute',
  'execute_cook_agent_result',
  'execute_cook_test_result',
  'execute_cook_slice_complete',
  'execute_cook_run_complete',
  'execute_cook_petri_export',
  'execute_cook_promotion_prepare',
] as const;

export function activeToolNamesForExecutor({ registeredToolNames }: ExecutorToolPolicyInput): string[] {
  const allowed = new Set<string>(EXECUTOR_ALLOWED_TOOL_NAMES);
  return registeredToolNames.filter((toolName) => allowed.has(toolName));
}
