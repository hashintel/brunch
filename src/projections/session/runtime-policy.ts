import type { ReadinessGrade } from '../../graph/index.js';
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

export interface ToolPolicyDefinition {
  id: ToolPolicyId;
  baseAllowedToolNames: readonly string[];
  blockedToolNames: readonly string[];
}

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
      'freestyle',
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

export const TOOL_POLICY_DEFINITIONS: Record<ToolPolicyId, ToolPolicyDefinition> = {
  'elicit-read-only': {
    id: 'elicit-read-only',
    baseAllowedToolNames: ['read', 'grep', 'find', 'ls'],
    blockedToolNames: ['bash', 'edit', 'write'],
  },
};

export const GRADE_RANK: Record<ReadinessGrade, number> = {
  grounding_onboarding: 0,
  elicitation_ready: 1,
  commitments_ready: 2,
  planning_ready: 3,
};

export const GOAL_MIN_GRADE: Record<AgentGoalId, ReadinessGrade> = {
  'grounding-advance': 'grounding_onboarding',
  'elicit-expand': 'elicitation_ready',
  'commit-converge': 'commitments_ready',
  'capture-posture': 'grounding_onboarding',
};

export const STRATEGY_MIN_GRADE: Record<AgentStrategyId, ReadinessGrade> = {
  freestyle: 'grounding_onboarding',
  'step-wise-decision-tree': 'grounding_onboarding',
  'step-wise-disambiguate': 'grounding_onboarding',
  'propose-graph': 'elicitation_ready',
  'project-graph': 'commitments_ready',
};

export const AUTO_EXCLUDED_STRATEGIES = new Set<AgentStrategyId>(['freestyle']);

export const LENS_MIN_GRADE: Record<AgentLensId, ReadinessGrade> = {
  intent: 'grounding_onboarding',
  design: 'elicitation_ready',
  oracle: 'elicitation_ready',
};

export type RuntimeAffordanceAxis = 'goal' | 'strategy' | 'lens';

export function isGradeLegal<TId extends string>(
  id: TId,
  readinessGrade: ReadinessGrade,
  minGrades: Record<TId, ReadinessGrade>,
): boolean {
  return GRADE_RANK[readinessGrade] >= GRADE_RANK[minGrades[id]];
}

export function axisOptionsForRuntimeState(
  axis: 'goal',
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): readonly AgentGoalId[];
export function axisOptionsForRuntimeState(
  axis: 'strategy',
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): readonly AgentStrategyId[];
export function axisOptionsForRuntimeState(
  axis: 'lens',
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): readonly AgentLensId[];
export function axisOptionsForRuntimeState(
  axis: RuntimeAffordanceAxis,
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): readonly (AgentGoalId | AgentStrategyId | AgentLensId)[] {
  if (axis === 'goal') {
    return state.agentRoleDefinition.allowedGoals.filter((id) =>
      isGradeLegal(id, readinessGrade, GOAL_MIN_GRADE),
    );
  }
  if (axis === 'strategy') {
    const legal = state.agentRoleDefinition.allowedStrategies.filter((id) =>
      isGradeLegal(id, readinessGrade, STRATEGY_MIN_GRADE),
    );
    return state.agentStrategy === 'auto' ? legal.filter((id) => !AUTO_EXCLUDED_STRATEGIES.has(id)) : legal;
  }
  return state.agentRoleDefinition.allowedLenses.filter((id) =>
    isGradeLegal(id, readinessGrade, LENS_MIN_GRADE),
  );
}

export function defaultGoalForRuntimeState(state: ResolvedBrunchAgentState): AgentGoalSelection {
  return state.agentRoleDefinition.defaultGoal;
}

export function defaultStrategyForRuntimeState(state: ResolvedBrunchAgentState): AgentStrategySelection {
  return state.agentRoleDefinition.defaultStrategy;
}

export function defaultLensForRuntimeState(state: ResolvedBrunchAgentState): AgentLensSelection {
  return state.agentRoleDefinition.defaultLens;
}

export function toolPolicyForRuntimeState(state: ResolvedBrunchAgentState): ToolPolicyDefinition {
  return TOOL_POLICY_DEFINITIONS[state.operationalModeDefinition.toolPolicyId];
}

export function isToolBlockedForRuntimeState(state: ResolvedBrunchAgentState, toolName: string): boolean {
  return toolPolicyForRuntimeState(state).blockedToolNames.includes(toolName);
}
