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
] as const;

export function activeToolNamesForExecutor({ registeredToolNames }: ExecutorToolPolicyInput): string[] {
  const allowed = new Set<string>(EXECUTOR_ALLOWED_TOOL_NAMES);
  return registeredToolNames.filter((toolName) => allowed.has(toolName));
}
