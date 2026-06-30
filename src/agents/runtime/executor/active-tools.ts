import {
  BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
  BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_SNAPSHOT_TOOL,
  BRUNCH_EXECUTE_STATUS_TOOL,
  BRUNCH_ORCHESTRATOR_STUB_TOOL,
} from '../../../session/schema/tool-names.js';

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
  BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
  BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_SNAPSHOT_TOOL,
  BRUNCH_EXECUTE_STATUS_TOOL,
  BRUNCH_ORCHESTRATOR_STUB_TOOL,
] as const;

export function activeToolNamesForExecutor({ registeredToolNames }: ExecutorToolPolicyInput): string[] {
  const allowed = new Set<string>(EXECUTOR_ALLOWED_TOOL_NAMES);
  return registeredToolNames.filter((toolName) => allowed.has(toolName));
}
