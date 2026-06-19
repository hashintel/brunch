import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type {
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
import { evaluateCapabilityReadiness, type CapabilityId } from './capability-readiness.js';

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
    allowedStrategies: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
    defaultLens: 'auto',
    allowedLenses: ['intent', 'design', 'oracle'],
    promptPackIds: ['elicitor'],
  },
};

export const TOOL_POLICY_DEFINITIONS: Record<ToolPolicyId, ToolPolicyDefinition> = {
  'elicit-read-only': {
    id: 'elicit-read-only',
    baseAllowedToolNames: ['read', 'grep', 'find', 'ls', 'web_fetch', 'web_search'],
    blockedToolNames: ['bash', 'edit', 'write'],
  },
};

export const AUTO_EXCLUDED_STRATEGIES = new Set<AgentStrategyId>(['freestyle']);

const LENS_CAPABILITY: Partial<Record<AgentLensId, CapabilityId>> = {
  design: 'generative-lens',
  oracle: 'generative-lens',
};

export function isCapabilityLegalForGaps(
  capability: CapabilityId | undefined,
  gaps: readonly ElicitationGap[],
): boolean {
  // Floor options carry no capability gate — always legal.
  if (!capability) return true;
  // A `negotiate` outcome omits the option (readiness, not a refusal — I31-L holds at the
  // execution boundary). A missing-register-kind throw is a seeding/config bug and must
  // fail loud (gaps-node-kind-reference: config bug ≠ uncovered) — do not swallow it.
  return evaluateCapabilityReadiness(capability, gaps).status !== 'negotiate';
}

export type RuntimeAffordanceAxis = 'strategy' | 'lens';

export function axisOptionsForRuntimeState(
  axis: 'strategy',
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly AgentStrategyId[];
export function axisOptionsForRuntimeState(
  axis: 'lens',
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly AgentLensId[];
export function axisOptionsForRuntimeState(
  axis: RuntimeAffordanceAxis,
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly (AgentStrategyId | AgentLensId)[] {
  if (axis === 'strategy') {
    const legal = pinnableAxisOptionsForRuntimeState('strategy', state, gaps);
    return state.agentStrategy === 'auto' ? legal.filter((id) => !AUTO_EXCLUDED_STRATEGIES.has(id)) : legal;
  }
  return pinnableAxisOptionsForRuntimeState('lens', state, gaps);
}

/**
 * Options a user may explicitly pin on a user-mutable axis: role-allowed and
 * capability-readiness-legal over the selected spec's gaps (D74-L). Unlike the
 * AUTO-manifest view (`axisOptionsForRuntimeState`), the pin surface never
 * applies the AUTO exclusion — `freestyle` is an explicit user pin (D66-L).
 * `goal` is not user-mutable (D59-L) and has no pin surface.
 */
export function pinnableAxisOptionsForRuntimeState(
  axis: 'strategy',
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly AgentStrategyId[];
export function pinnableAxisOptionsForRuntimeState(
  axis: 'lens',
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly AgentLensId[];
export function pinnableAxisOptionsForRuntimeState(
  axis: 'strategy' | 'lens',
  state: ResolvedBrunchAgentState,
  gaps: readonly ElicitationGap[],
): readonly (AgentStrategyId | AgentLensId)[] {
  if (axis === 'strategy') {
    return state.agentRoleDefinition.allowedStrategies;
  }
  return state.agentRoleDefinition.allowedLenses.filter((id) =>
    isCapabilityLegalForGaps(LENS_CAPABILITY[id], gaps),
  );
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
