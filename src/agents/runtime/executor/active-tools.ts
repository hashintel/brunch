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
  'execute_plan_draft',
  'execute_plan_preview',
] as const;

export function activeToolNamesForExecutor({ registeredToolNames }: ExecutorToolPolicyInput): string[] {
  const allowed = new Set<string>(EXECUTOR_ALLOWED_TOOL_NAMES);
  return registeredToolNames.filter((toolName) => allowed.has(toolName));
}
