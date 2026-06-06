import type {
  AgentGoalId,
  AgentGoalSelection,
  AgentLensId,
  AgentLensSelection,
  AgentRoleId,
  AgentStrategyId,
  AgentStrategySelection,
  BrunchAgentState,
  ModelPreference,
  OperationalModeId,
  PromptPackId,
  ThinkingLevel,
  ToolPolicyId,
} from '../../session/runtime-state.js';

export interface OperationalModeDefinition {
  id: OperationalModeId;
  defaultRole: AgentRoleId;
  allowedRoles: readonly AgentRoleId[];
  toolPolicyId: ToolPolicyId;
  promptPackIds: readonly PromptPackId[];
}

export interface AgentRoleDefinition {
  id: AgentRoleId;
  operationalMode: OperationalModeId;
  defaultStrategy: AgentStrategySelection;
  allowedStrategies: readonly AgentStrategyId[];
  defaultLens: AgentLensSelection;
  allowedLenses: readonly AgentLensId[];
  defaultGoal: AgentGoalSelection;
  allowedGoals: readonly AgentGoalId[];
  promptPackIds: readonly PromptPackId[];
  modelPreference?: ModelPreference;
  thinkingLevel?: ThinkingLevel;
}

export interface ResolvedBrunchAgentState extends BrunchAgentState {
  agentRole: AgentRoleId;
  operationalModeDefinition: OperationalModeDefinition;
  agentRoleDefinition: AgentRoleDefinition;
}

export const OPERATIONAL_MODE_DEFINITIONS: Record<OperationalModeId, OperationalModeDefinition> = {
  elicit: {
    id: 'elicit',
    defaultRole: 'elicitor',
    allowedRoles: ['elicitor'],
    toolPolicyId: 'elicit-read-only',
    promptPackIds: ['brunch-base', 'elicit'],
  },
};

export const AGENT_ROLE_DEFINITIONS: Record<AgentRoleId, AgentRoleDefinition> = {
  elicitor: {
    id: 'elicitor',
    operationalMode: 'elicit',
    defaultStrategy: 'auto',
    allowedStrategies: [
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
      'project-graph',
    ],
    defaultLens: 'auto',
    allowedLenses: ['intent', 'design', 'oracle'],
    defaultGoal: 'grounding-advance',
    allowedGoals: ['grounding-advance', 'elicit-expand', 'commit-converge', 'capture-posture'],
    promptPackIds: ['elicitor'],
  },
};
