export const OPERATIONAL_MODE_IDS = ['elicit'] as const;

export const AGENT_ROLE_IDS = ['elicitor'] as const;

export const AGENT_STRATEGY_IDS = ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'] as const;

export const AGENT_LENS_IDS = ['intent', 'design', 'oracle'] as const;

export type OperationalModeId = (typeof OPERATIONAL_MODE_IDS)[number];
export type AgentRoleId = (typeof AGENT_ROLE_IDS)[number];
export type AutoAxisSelection = 'auto';
export type AgentStrategyId = (typeof AGENT_STRATEGY_IDS)[number];
export type AgentStrategySelection = AutoAxisSelection | AgentStrategyId;
export type AgentLensId = (typeof AGENT_LENS_IDS)[number];
export type AgentLensSelection = AutoAxisSelection | AgentLensId;

/**
 * Planned operational modes shown (disabled) on display surfaces such as the
 * mode picker. Not valid runtime state: deliberately outside OperationalModeId
 * until implemented.
 */
export const PLANNED_OPERATIONAL_MODE_IDS = ['execute'] as const;
export type PlannedOperationalModeId = (typeof PLANNED_OPERATIONAL_MODE_IDS)[number];
export type OperationalModeChoice = OperationalModeId | PlannedOperationalModeId;
