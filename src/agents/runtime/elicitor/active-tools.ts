export interface LiveElicitorToolPolicyInput {
  readonly registeredToolNames: readonly string[];
  readonly devAllowedToolNames?: readonly string[] | undefined;
}

export const LIVE_ELICITOR_ALLOWED_TOOL_NAMES = [
  'read',
  'grep',
  'find',
  'ls',
  'web_fetch',
  'web_search',
  'read_workspace_context',
  'read_specification_context',
  'read_session_context',
  'read_graph',
  'mutate_graph',
  'read_elicitation_gaps',
  'update_elicitation_gaps',
  'read_reconciliation_needs',
  'update_reconciliation_needs',
  'present_question',
  'present_candidates',
  'present_review_set',
  'request_response',
] as const;

export function activeToolNamesForLiveElicitor({
  registeredToolNames,
  devAllowedToolNames = [],
}: LiveElicitorToolPolicyInput): string[] {
  const allowed = new Set<string>(LIVE_ELICITOR_ALLOWED_TOOL_NAMES);
  for (const toolName of devAllowedToolNames) {
    allowed.add(toolName);
  }
  return registeredToolNames.filter((toolName) => allowed.has(toolName));
}
