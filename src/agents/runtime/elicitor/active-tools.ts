import { withoutBrunchBlockedToolNames } from '../shared/blocked-tools.js';

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
  'read_elicitation_scratchpad',
  'update_elicitation_scratchpad',
  'read_reconciliation_needs',
  'update_reconciliation_needs',
  'ask',
  'present_candidates',
  'present_digest',
  'present_review_set',
  'subagent',
] as const;

export function activeToolNamesForLiveElicitor({
  registeredToolNames,
  devAllowedToolNames = [],
}: LiveElicitorToolPolicyInput): string[] {
  const allowed = new Set<string>(LIVE_ELICITOR_ALLOWED_TOOL_NAMES);
  for (const toolName of devAllowedToolNames) {
    allowed.add(toolName);
  }
  return withoutBrunchBlockedToolNames(registeredToolNames.filter((toolName) => allowed.has(toolName)));
}
