import { fileURLToPath } from 'node:url';

import type { ReadinessGrade } from '../graph/index.js';
import type {
  AgentGoalId,
  AgentLensId,
  AgentRoleId,
  AgentStrategyId,
  ResolvedBrunchAgentState,
} from '../session/runtime-state.js';

export type { ReadinessGrade };
export type PromptResourceFamily = 'goals' | 'strategies' | 'lenses' | 'methods' | 'definitions';
export type MethodId =
  | 'run-structured-exchange'
  | 'infer-and-capture'
  | 'commit-graph'
  | 'read-snapshot'
  | 'generate-proposal'
  | 'review-for-gaps';

export interface PromptResourceManifestEntry {
  name: string;
  description: string;
  location: string;
}

export interface AgentPromptDefinition {
  id: AgentRoleId;
  description: string;
  model: string;
  thinking: 'low' | 'medium' | 'high';
  toolAuthority: string;
  allowedGoals: readonly AgentGoalId[];
  allowedStrategies: readonly AgentStrategyId[];
  allowedLenses: readonly AgentLensId[];
  allowedMethods: readonly MethodId[];
}

export interface PromptManifests {
  goals: readonly PromptResourceManifestEntry[];
  strategies: readonly PromptResourceManifestEntry[];
  lenses: readonly PromptResourceManifestEntry[];
  methods: readonly PromptResourceManifestEntry[];
}

export interface BrunchPostureToolPolicyInput {
  registeredToolNames: readonly string[];
  state: ResolvedBrunchAgentState;
  readinessGrade: ReadinessGrade;
}

const GRADE_RANK: Record<ReadinessGrade, number> = {
  grounding_onboarding: 0,
  elicitation_ready: 1,
  commitments_ready: 2,
  planning_ready: 3,
};

const GOAL_MIN_GRADE: Record<AgentGoalId, ReadinessGrade> = {
  'grounding-advance': 'grounding_onboarding',
  'elicit-expand': 'elicitation_ready',
  'commit-converge': 'commitments_ready',
  'capture-posture': 'grounding_onboarding',
};

const STRATEGY_MIN_GRADE: Record<AgentStrategyId, ReadinessGrade> = {
  'step-wise-decision-tree': 'grounding_onboarding',
  'step-wise-disambiguate': 'grounding_onboarding',
  'propose-graph': 'elicitation_ready',
  'project-graph': 'commitments_ready',
};

const LENS_MIN_GRADE: Record<AgentLensId, ReadinessGrade> = {
  intent: 'grounding_onboarding',
  design: 'elicitation_ready',
  oracle: 'elicitation_ready',
};

const METHOD_MIN_GRADE: Record<MethodId, ReadinessGrade> = {
  'run-structured-exchange': 'grounding_onboarding',
  'infer-and-capture': 'grounding_onboarding',
  'read-snapshot': 'grounding_onboarding',
  'commit-graph': 'elicitation_ready',
  'generate-proposal': 'commitments_ready',
  'review-for-gaps': 'commitments_ready',
};

const METHOD_TOOL_NAMES: Partial<Record<MethodId, readonly string[]>> = {
  'run-structured-exchange': ['present_question', 'present_options'],
  'read-snapshot': ['read_graph'],
  'commit-graph': ['commit_graph'],
};

const ELICIT_BASE_TOOL_NAMES = ['read', 'grep', 'find', 'ls'] as const;
const ELICIT_BLOCKED_TOOL_NAMES = ['bash', 'edit', 'write'] as const;

export const AGENT_PROMPT_DEFINITIONS: Record<AgentRoleId, AgentPromptDefinition> = {
  elicitor: {
    id: 'elicitor',
    description:
      'Foreground Brunch session agent that elicits, disambiguates, and captures selected-spec intent.',
    model: 'default',
    thinking: 'medium',
    toolAuthority:
      'elicit read-only; graph writes only through Brunch graph tools when a legal strategy allows them',
    allowedGoals: ['grounding-advance', 'elicit-expand', 'commit-converge', 'capture-posture'],
    allowedStrategies: [
      'step-wise-decision-tree',
      'step-wise-disambiguate',
      'propose-graph',
      'project-graph',
    ],
    allowedLenses: ['intent', 'design', 'oracle'],
    allowedMethods: [
      'run-structured-exchange',
      'infer-and-capture',
      'commit-graph',
      'read-snapshot',
      'generate-proposal',
      'review-for-gaps',
    ],
  },
};

export const GOAL_RESOURCES: Record<AgentGoalId, PromptResourceManifestEntry> = {
  'grounding-advance': resource(
    'goals',
    'grounding-advance',
    'Establish the basic initiative frame and readiness evidence for moving beyond onboarding.',
  ),
  'elicit-expand': resource(
    'goals',
    'elicit-expand',
    'Expand the selected spec while ambiguity remains productive.',
  ),
  'commit-converge': resource(
    'goals',
    'commit-converge',
    'Converge on reviewable commitments once the spec is ready for commitments.',
  ),
  'capture-posture': resource(
    'goals',
    'capture-posture',
    'Confirm workspace posture without storing it as spec or graph truth.',
  ),
};

export const STRATEGY_RESOURCES: Record<AgentStrategyId, PromptResourceManifestEntry> = {
  'step-wise-decision-tree': resource(
    'strategies',
    'step-wise-decision-tree',
    'Ask one structured question at a time and branch from the answer.',
  ),
  'step-wise-disambiguate': resource(
    'strategies',
    'step-wise-disambiguate',
    'Use contrastive examples to collapse meaningful ambiguity.',
  ),
  'propose-graph': resource(
    'strategies',
    'propose-graph',
    'Offer a concept-level graph proposal and commit only through Brunch graph tools after acceptance.',
  ),
  'project-graph': resource(
    'strategies',
    'project-graph',
    'Generate a dry-run-valid review-set proposal for user approval.',
  ),
};

export const LENS_RESOURCES: Record<AgentLensId, PromptResourceManifestEntry> = {
  intent: resource(
    'lenses',
    'intent',
    'Focus on intent-plane claims: goals, terms, assumptions, constraints, and decisions.',
  ),
  design: resource('lenses', 'design', 'Focus on design implications and module/interface boundaries.'),
  oracle: resource(
    'lenses',
    'oracle',
    'Focus on verification obligations, checks, evidence, and blind spots.',
  ),
};

export const METHOD_RESOURCES: Record<MethodId, PromptResourceManifestEntry> = {
  'run-structured-exchange': resource(
    'methods',
    'run-structured-exchange',
    'Present typed Brunch exchanges and request typed responses.',
  ),
  'infer-and-capture': resource(
    'methods',
    'infer-and-capture',
    'Extract only high-confidence facts from a completed exchange.',
  ),
  'commit-graph': resource(
    'methods',
    'commit-graph',
    'Commit graph truth only through Brunch graph tools and CommandExecutor-backed results.',
  ),
  'read-snapshot': resource(
    'methods',
    'read-snapshot',
    'Use pushed context handles and snapshot tools for selected-spec context.',
  ),
  'generate-proposal': resource(
    'methods',
    'generate-proposal',
    'Generate reviewable candidate graph material without committing it directly.',
  ),
  'review-for-gaps': resource(
    'methods',
    'review-for-gaps',
    'Review commitments for gaps, conflicts, and verification debt.',
  ),
};

export function manifestsForState(
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): PromptManifests {
  const definition = AGENT_PROMPT_DEFINITIONS[state.agentRole];
  if (!definition) {
    throw new Error(`Unknown Brunch agent "${state.agentRole}".`);
  }
  if (definition.id !== state.agentRole || state.operationalMode !== 'elicit') {
    throw new Error(
      `Agent "${state.agentRole}" is not legal in operational mode "${state.operationalMode}".`,
    );
  }

  return {
    goals: selectAxisResources({
      label: 'goal',
      selection: state.agentGoal,
      allowed: definition.allowedGoals,
      resources: GOAL_RESOURCES,
      minGrades: GOAL_MIN_GRADE,
      readinessGrade,
      state,
    }),
    strategies: selectAxisResources({
      label: 'strategy',
      selection: state.agentStrategy,
      allowed: definition.allowedStrategies,
      resources: STRATEGY_RESOURCES,
      minGrades: STRATEGY_MIN_GRADE,
      readinessGrade,
      state,
    }),
    lenses: selectAxisResources({
      label: 'lens',
      selection: state.agentLens,
      allowed: definition.allowedLenses,
      resources: LENS_RESOURCES,
      minGrades: LENS_MIN_GRADE,
      readinessGrade,
      state,
    }),
    methods: methodIdsForState(state, readinessGrade).map((method) => METHOD_RESOURCES[method]),
  };
}

export function methodIdsForState(
  state: ResolvedBrunchAgentState,
  readinessGrade: ReadinessGrade,
): readonly MethodId[] {
  const definition = AGENT_PROMPT_DEFINITIONS[state.agentRole];
  if (!definition || definition.id !== state.agentRole || state.operationalMode !== 'elicit') return [];
  return definition.allowedMethods.filter((method) => isGradeLegal(method, readinessGrade, METHOD_MIN_GRADE));
}

export function activeToolNamesForPosture({
  registeredToolNames,
  state,
  readinessGrade,
}: BrunchPostureToolPolicyInput): string[] {
  if (state.operationalModeDefinition.toolPolicyId !== 'elicit-read-only') return [];

  const legalTools = new Set<string>(ELICIT_BASE_TOOL_NAMES);
  for (const method of methodIdsForState(state, readinessGrade)) {
    for (const toolName of METHOD_TOOL_NAMES[method] ?? []) {
      legalTools.add(toolName);
    }
  }

  const blockedTools = new Set<string>(ELICIT_BLOCKED_TOOL_NAMES);

  return registeredToolNames.filter((toolName) => legalTools.has(toolName) && !blockedTools.has(toolName));
}

function selectAxisResources<TId extends string>({
  label,
  selection,
  allowed,
  resources,
  minGrades,
  readinessGrade,
  state,
}: {
  label: 'goal' | 'strategy' | 'lens';
  selection: 'auto' | TId;
  allowed: readonly TId[];
  resources: Record<TId, PromptResourceManifestEntry>;
  minGrades: Record<TId, ReadinessGrade>;
  readinessGrade: ReadinessGrade;
  state: ResolvedBrunchAgentState;
}): readonly PromptResourceManifestEntry[] {
  const legal = allowed.filter((id) => isGradeLegal(id, readinessGrade, minGrades));
  if (selection === 'auto') return legal.map((id) => resources[id]);
  if (!legal.includes(selection)) {
    throw new Error(
      `Pinned ${label} "${selection}" is not legal for ${state.agentRole} in ${state.operationalMode} at readiness grade ${readinessGrade}.`,
    );
  }
  return [resources[selection]];
}

function isGradeLegal<TId extends string>(
  id: TId,
  readinessGrade: ReadinessGrade,
  minGrades: Record<TId, ReadinessGrade>,
): boolean {
  return GRADE_RANK[readinessGrade] >= GRADE_RANK[minGrades[id]];
}

function resource(
  family: PromptResourceFamily,
  id: string,
  description: string,
): PromptResourceManifestEntry {
  return {
    name: id,
    description,
    location: fileURLToPath(new URL(`./${family}/${id}.md`, import.meta.url)),
  };
}
