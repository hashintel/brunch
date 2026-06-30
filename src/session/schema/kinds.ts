export const OPERATIONAL_MODE_IDS = ['elicit', 'execute'] as const;

export const OPERATIONAL_MODE_LABELS = {
  elicit: 'Specify',
  execute: 'Execute',
} as const;

export const AGENT_ROLE_IDS = ['elicitor', 'executor'] as const;

export const AGENT_KINDS = ['foreground', 'background'] as const;

export const AGENT_THINKING_LEVELS = ['low', 'medium', 'high'] as const;

export type OperationalModeId = (typeof OPERATIONAL_MODE_IDS)[number];
export type AgentRoleId = (typeof AGENT_ROLE_IDS)[number];
export type AgentKind = (typeof AGENT_KINDS)[number];
export type AgentThinkingLevel = (typeof AGENT_THINKING_LEVELS)[number];

export function operationalModeLabel(
  mode: OperationalModeId,
): (typeof OPERATIONAL_MODE_LABELS)[OperationalModeId] {
  return OPERATIONAL_MODE_LABELS[mode];
}
