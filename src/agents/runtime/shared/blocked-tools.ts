export const BRUNCH_BLOCKED_TOOL_NAMES = ['bash', 'edit', 'write'] as const;

export type BrunchBlockedToolName = (typeof BRUNCH_BLOCKED_TOOL_NAMES)[number];

const BLOCKED_TOOL_NAME_SET = new Set<string>(BRUNCH_BLOCKED_TOOL_NAMES);

export function isBrunchBlockedToolName(toolName: string): toolName is BrunchBlockedToolName {
  return BLOCKED_TOOL_NAME_SET.has(toolName);
}

export function withoutBrunchBlockedToolNames(toolNames: readonly string[]): string[] {
  return toolNames.filter((toolName) => !isBrunchBlockedToolName(toolName));
}
