export const OPERATIONAL_MODE_IDS = ['elicit'] as const;

export const AGENT_ROLE_IDS = ['elicitor'] as const;

export const AGENT_KINDS = ['foreground', 'background'] as const;

export const AGENT_STRATEGY_IDS = ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'] as const;

export const AGENT_LENS_IDS = ['intent', 'design', 'oracle'] as const;

export const AGENT_METHOD_IDS = [
  'run-structured-exchange',
  'capture',
  'commit-graph',
  'elicit-by-question',
  'ingest-paste',
  'read-referenced-documents',
  'explore-and-characterize',
  'read-context',
  'generate-proposal',
  'review-for-gaps',
] as const;

export const AGENT_THINKING_LEVELS = ['low', 'medium', 'high'] as const;

export type OperationalModeId = (typeof OPERATIONAL_MODE_IDS)[number];
export type AgentRoleId = (typeof AGENT_ROLE_IDS)[number];
export type AgentKind = (typeof AGENT_KINDS)[number];
export type AutoAxisSelection = 'auto';
export type AgentStrategyId = (typeof AGENT_STRATEGY_IDS)[number];
export type AgentStrategySelection = AutoAxisSelection | AgentStrategyId;
export type AgentLensId = (typeof AGENT_LENS_IDS)[number];
export type AgentLensSelection = AutoAxisSelection | AgentLensId;
export type AgentMethodId = (typeof AGENT_METHOD_IDS)[number];
export type AgentThinkingLevel = (typeof AGENT_THINKING_LEVELS)[number];

/**
 * Planned operational modes shown (disabled) on display surfaces such as the
 * mode picker. Not valid runtime state: deliberately outside OperationalModeId
 * until implemented.
 */
export const PLANNED_OPERATIONAL_MODE_IDS = ['execute', 'code'] as const;
export type PlannedOperationalModeId = (typeof PLANNED_OPERATIONAL_MODE_IDS)[number];
export type OperationalModeChoice = OperationalModeId | PlannedOperationalModeId;
