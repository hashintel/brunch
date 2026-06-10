import { fileURLToPath } from 'node:url';

import type { ReadinessGrade } from '../../graph/index.js';
import {
  AUTO_EXCLUDED_STRATEGIES,
  GOAL_MIN_GRADE,
  LENS_MIN_GRADE,
  STRATEGY_MIN_GRADE,
  isGradeLegal,
  toolPolicyForRuntimeState,
  type ResolvedBrunchAgentState,
} from '../../projections/session/runtime-policy.js';
import type { AgentGoalId, AgentLensId, AgentRoleId, AgentStrategyId } from '../../session/runtime-state.js';

export type { ReadinessGrade };
type PromptResourceFamily = 'goals' | 'strategies' | 'lenses' | 'methods' | 'definitions';
export type MethodId =
  | 'run-structured-exchange'
  | 'infer-and-capture'
  | 'commit-graph'
  | 'read-context'
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
  devAllowedToolNames?: readonly string[] | undefined;
}

const METHOD_MIN_GRADE: Record<MethodId, ReadinessGrade> = {
  'run-structured-exchange': 'grounding_onboarding',
  'infer-and-capture': 'grounding_onboarding',
  'read-context': 'grounding_onboarding',
  'commit-graph': 'elicitation_ready',
  'generate-proposal': 'commitments_ready',
  'review-for-gaps': 'commitments_ready',
};

const METHOD_TOOL_NAMES: Partial<Record<MethodId, readonly string[]>> = {
  'run-structured-exchange': [
    'present_question',
    'present_options',
    'request_answer',
    'request_choice',
    'request_choices',
  ],
  'read-context': ['read_graph', 'read_session_context'],
  'commit-graph': ['mutate_graph'],
  'generate-proposal': ['present_review_set', 'request_review'],
};

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
      'freestyle',
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
      'read-context',
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
  freestyle: resource(
    'strategies',
    'freestyle',
    'Let the user drive with ordinary turns while keeping structured exchanges available as needed.',
  ),
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
  'read-context': resource(
    'methods',
    'read-context',
    'Use pushed context handles and read-only context tools for selected-spec context.',
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
      autoExcluded: AUTO_EXCLUDED_STRATEGIES,
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
  devAllowedToolNames = [],
}: BrunchPostureToolPolicyInput): string[] {
  const toolPolicy = toolPolicyForRuntimeState(state);
  const legalTools = new Set<string>(toolPolicy.baseAllowedToolNames);
  for (const method of methodIdsForState(state, readinessGrade)) {
    for (const toolName of METHOD_TOOL_NAMES[method] ?? []) {
      legalTools.add(toolName);
    }
  }
  for (const toolName of devAllowedToolNames) {
    legalTools.add(toolName);
  }

  const blockedTools = new Set<string>(toolPolicy.blockedToolNames);

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
  autoExcluded,
}: {
  label: 'goal' | 'strategy' | 'lens';
  selection: 'auto' | TId;
  allowed: readonly TId[];
  resources: Record<TId, PromptResourceManifestEntry>;
  minGrades: Record<TId, ReadinessGrade>;
  readinessGrade: ReadinessGrade;
  state: ResolvedBrunchAgentState;
  autoExcluded?: ReadonlySet<TId>;
}): readonly PromptResourceManifestEntry[] {
  const legal = allowed.filter((id) => isGradeLegal(id, readinessGrade, minGrades));
  if (selection === 'auto') {
    return legal.filter((id) => !autoExcluded?.has(id)).map((id) => resources[id]);
  }
  if (!legal.includes(selection)) {
    throw new Error(
      `Pinned ${label} "${selection}" is not legal for ${state.agentRole} in ${state.operationalMode} at readiness grade ${readinessGrade}.`,
    );
  }
  return [resources[selection]];
}

function promptResourceLocation(family: PromptResourceFamily, id: string): string {
  const root = family === 'definitions' ? './agents' : './skills';
  return fileURLToPath(new URL(`../${root}/${family}/${id}.md`, import.meta.url));
}

function resource(
  family: PromptResourceFamily,
  id: string,
  description: string,
): PromptResourceManifestEntry {
  return {
    name: id,
    description,
    location: promptResourceLocation(family, id),
  };
}
