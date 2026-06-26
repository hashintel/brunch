import type { ElicitationGap } from '../../graph/schema/elicitation-gaps.js';
import type { BrunchAgentState, ToolPolicyId } from '../../session/runtime-state.js';
import type { ForegroundAgentManifest } from '../../session/schema/agent-manifest.js';
import type {
  AgentLensId,
  AgentLensSelection,
  AgentStrategyId,
  AgentStrategySelection,
  OperationalModeId,
} from '../../session/schema/kinds.js';
import { AGENT_METHOD_IDS } from '../../session/schema/kinds.js';
import { BRUNCH_ORCHESTRATOR_STUB_TOOL } from '../../session/schema/tool-names.js';
import { bundledAgentBodyRepoPath } from '../registry.js';
import { evaluateCapabilityReadiness, type CapabilityId } from './capability-readiness.js';

export interface ToolPolicyDefinition {
  id: ToolPolicyId;
  baseAllowedToolNames: readonly string[];
  blockedToolNames: readonly string[];
}

export interface OperationalModeDefinition {
  id: OperationalModeId;
  foregroundAgent: ForegroundAgentManifest;
  toolPolicy: ToolPolicyDefinition;
}

export type AgentRoleDefinition = ForegroundAgentManifest;

export interface ResolvedBrunchAgentState extends BrunchAgentState {
  agentRole: ForegroundAgentManifest['id'];
  operationalModeDefinition: OperationalModeDefinition;
  agentRoleDefinition: AgentRoleDefinition;
}

const ELICIT_DELEGATABLE_AGENTS = ['explorer', 'researcher', 'projector', 'reviewer'] as const;

export const FOREGROUND_AGENT_ROSTER: Record<OperationalModeId, OperationalModeDefinition> = {
  elicit: {
    id: 'elicit',
    foregroundAgent: {
      kind: 'foreground',
      id: 'elicitor',
      operationalMode: 'elicit',
      description:
        'Foreground Brunch session agent that elicits, disambiguates, and captures selected-spec intent.',
      model: 'default',
      thinking: 'medium',
      body: {
        source: 'file',
        location: bundledAgentBodyRepoPath('elicitor'),
      },
      skills: {
        strategies: ['freestyle', 'step-wise-decision-tree', 'step-wise-disambiguate'],
        lenses: ['intent', 'design', 'oracle'],
        methods: AGENT_METHOD_IDS,
      },
      tools: ['read', 'grep', 'find', 'ls', 'web_fetch', 'web_search'],
      canDelegate: ELICIT_DELEGATABLE_AGENTS,
      defaultStrategy: 'auto',
      defaultLens: 'auto',
      toolAuthority:
        'elicit read-only; graph writes only through Brunch graph tools when legal methods allow them',
    },
    toolPolicy: {
      id: 'elicit-read-only',
      baseAllowedToolNames: ['read', 'grep', 'find', 'ls', 'web_fetch', 'web_search'],
      blockedToolNames: ['bash', 'edit', 'write'],
    },
  },
  execute: {
    id: 'execute',
    foregroundAgent: {
      kind: 'foreground',
      id: 'orchestrator',
      operationalMode: 'execute',
      description:
        'Foreground Brunch execute-mode agent that coordinates task execution through code-owned tools.',
      model: 'default',
      thinking: 'medium',
      body: {
        source: 'file',
        location: bundledAgentBodyRepoPath('orchestrator'),
      },
      skills: {
        strategies: [],
        lenses: [],
        methods: [],
      },
      tools: ['read', 'grep', 'find', 'ls', 'web_fetch', 'web_search', BRUNCH_ORCHESTRATOR_STUB_TOOL],
      canDelegate: [],
      defaultStrategy: 'auto',
      defaultLens: 'auto',
      toolAuthority:
        'execute orchestrator read-only plus a code-owned stub tool; direct shell and file writes are blocked',
    },
    toolPolicy: {
      id: 'execute-orchestrator',
      baseAllowedToolNames: [
        'read',
        'grep',
        'find',
        'ls',
        'web_fetch',
        'web_search',
        BRUNCH_ORCHESTRATOR_STUB_TOOL,
      ],
      blockedToolNames: ['bash', 'edit', 'write'],
    },
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
    return state.agentRoleDefinition.skills.strategies;
  }
  return state.agentRoleDefinition.skills.lenses.filter((id) =>
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
  return state.operationalModeDefinition.toolPolicy;
}

export function delegatableAgentsForRuntimeState(state: ResolvedBrunchAgentState): readonly string[] {
  return state.agentRoleDefinition.canDelegate;
}

export function isToolBlockedForRuntimeState(state: ResolvedBrunchAgentState, toolName: string): boolean {
  return toolPolicyForRuntimeState(state).blockedToolNames.includes(toolName);
}
